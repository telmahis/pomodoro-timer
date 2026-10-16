// ===== Cloud Sync: Firestore =====
// Auth (sign in/up/out, the login modal, the profile popover) lives in
// login.js. This file only cares about loading/saving app state to
// Firestore once someone is signed in. It is wired in via two hooks that
// login.js calls: window.onPomodoroSignedIn(user) and
// window.onPomodoroSignedOut().
//
// Behaviour:
//  - Work done while signed out is MERGED into the account on first login
//    (tasks and history are combined instead of being overwritten).
//  - If a different account logs in on the same browser, the previous
//    account's leftover local data is NOT merged into it.
//  - Changes made on another device show up live (Firestore listener),
//    without interrupting a timer that is currently running.

import { db } from './firebase.js';
import {
    doc,
    getDoc,
    setDoc,
    onSnapshot
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

const LAST_UID_KEY = 'pomodoro-last-uid';

let currentUser = null;
let saveDebounceTimer = null;
let isApplyingCloudState = false; // guards against re-saving what we just loaded
let unsubscribeSnapshot = null;
let lastAppliedAt = 0;            // updatedAt of the newest state we have applied or written
let timerRunning = false;         // never reset a running timer from a remote update

window.addEventListener('pomodoro-timer-state', (e) => {
    timerRunning = !!(e.detail && e.detail.isRunning);
});

function setSyncStatus(text) {
    if (window.setAuthSyncStatus) window.setAuthSyncStatus(text);
}

// --- Gathering / Applying State ---
function getFullStateForCloud() {
    const core = window.pomodoroCore ? window.pomodoroCore.getState() : {};
    const history = window.pomodoroFeatures ? window.pomodoroFeatures.getHistory() : {};
    const tasks = window.pomodoroFeatures ? window.pomodoroFeatures.getTasks() : [];
    const soundEnabled = localStorage.getItem('pomodoro-sound-enabled') !== 'false';

    return {
        ...core,
        history,
        tasks,
        soundEnabled,
        updatedAt: Date.now()
    };
}

// opts.skipCore: leave the timer/settings alone (used for live updates while running)
function applyFullStateFromCloud(data, opts = {}) {
    if (!data) return;
    isApplyingCloudState = true;

    try {
        if (window.pomodoroCore && !opts.skipCore) window.pomodoroCore.applyState(data);
        if (window.pomodoroFeatures) {
            window.pomodoroFeatures.setHistory(data.history || {});
            window.pomodoroFeatures.setTasks(data.tasks || []);
        }
        if (typeof data.soundEnabled === 'boolean') {
            localStorage.setItem('pomodoro-sound-enabled', data.soundEnabled);
            if (window.updateMuteUI) window.updateMuteUI();
        }
    } finally {
        isApplyingCloudState = false;
    }
}

// --- Merging local (signed-out) work with an account's saved data ---
function mergeStates(local, cloud) {
    // Tasks: keep everything from the cloud, add local tasks it doesn't have
    const byId = new Map();
    (cloud.tasks || []).forEach((t) => byId.set(t.id, t));
    (local.tasks || []).forEach((t) => {
        if (!byId.has(t.id)) byId.set(t.id, t);
    });

    // History: per day, keep the larger session count
    const history = { ...(cloud.history || {}) };
    Object.entries(local.history || {}).forEach(([day, count]) => {
        history[day] = Math.max(history[day] || 0, count || 0);
    });

    return {
        ...cloud,
        tasks: Array.from(byId.values()),
        history,
        sessionsCompleted: Math.max(cloud.sessionsCompleted || 0, local.sessionsCompleted || 0),
        streakDays: Math.max(cloud.streakDays || 0, local.streakDays || 0)
    };
}

// --- Saving to Firestore (debounced so rapid changes don't spam writes) ---
function scheduleCloudSave() {
    if (!currentUser || isApplyingCloudState) return;

    setSyncStatus('Saving…');
    clearTimeout(saveDebounceTimer);
    saveDebounceTimer = setTimeout(async () => {
        try {
            const state = getFullStateForCloud();
            lastAppliedAt = state.updatedAt; // so our own write isn't "applied" again
            await setDoc(doc(db, 'users', currentUser.uid), state, { merge: true });
            setSyncStatus('Synced');
        } catch (err) {
            console.warn('Cloud save failed:', err);
            setSyncStatus('Sync failed — check connection');
        }
    }, 1000);
}
window.scheduleCloudSave = scheduleCloudSave;

// --- Live updates from other devices ---
function startListening(uid) {
    stopListening();
    unsubscribeSnapshot = onSnapshot(
        doc(db, 'users', uid),
        (snap) => {
            if (!snap.exists() || snap.metadata.hasPendingWrites) return; // ignore our own writes
            const data = snap.data();
            if (!data || (data.updatedAt || 0) <= lastAppliedAt) return;  // nothing newer

            lastAppliedAt = data.updatedAt || 0;
            applyFullStateFromCloud(data, { skipCore: timerRunning });
            setSyncStatus('Synced');
        },
        (err) => console.warn('Live sync listener error:', err)
    );
}

function stopListening() {
    if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
    }
}

// --- Hooks called by login.js on sign-in / sign-out ---
window.onPomodoroSignedIn = async (user) => {
    currentUser = user;
    setSyncStatus('Loading your data…');

    try {
        const lastUid = localStorage.getItem(LAST_UID_KEY);
        // Local data belongs to this account if it was made signed-out
        // (no last uid) or by this same account earlier.
        const localBelongsToUser = !lastUid || lastUid === user.uid;
        const snap = await getDoc(doc(db, 'users', user.uid));

        if (snap.exists()) {
            const cloud = snap.data();
            let finalState = cloud;

            if (localBelongsToUser) {
                const local = getFullStateForCloud();
                finalState = mergeStates(local, cloud);
            }

            applyFullStateFromCloud(finalState);

            // If merging added something the cloud didn't have, save it back
            const changed = JSON.stringify([finalState.tasks, finalState.history, finalState.sessionsCompleted, finalState.streakDays])
                !== JSON.stringify([cloud.tasks, cloud.history, cloud.sessionsCompleted, cloud.streakDays]);
            if (changed) {
                const toSave = { ...finalState, updatedAt: Date.now() };
                lastAppliedAt = toSave.updatedAt;
                await setDoc(doc(db, 'users', user.uid), toSave, { merge: true });
            } else {
                lastAppliedAt = cloud.updatedAt || 0;
            }
        } else if (localBelongsToUser) {
            // First time this account logs in: push the local data up
            const initial = getFullStateForCloud();
            lastAppliedAt = initial.updatedAt;
            await setDoc(doc(db, 'users', user.uid), initial);
        } else {
            // A different account used this browser before: start this one clean
            applyFullStateFromCloud({ tasks: [], history: {}, sessionsCompleted: 0, streakDays: 0 });
            const fresh = getFullStateForCloud();
            lastAppliedAt = fresh.updatedAt;
            await setDoc(doc(db, 'users', user.uid), fresh);
        }

        localStorage.setItem(LAST_UID_KEY, user.uid);
        startListening(user.uid);
        setSyncStatus('Synced');
    } catch (err) {
        console.warn('Cloud load failed:', err);
        setSyncStatus('Could not load your data');
    }
};

window.onPomodoroSignedOut = () => {
    currentUser = null;
    clearTimeout(saveDebounceTimer);
    stopListening();
};