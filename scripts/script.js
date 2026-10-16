// ===== Pomodoro Timer Logic =====

// --- DOM References ---
const timerBox = document.querySelector('.timer-box');
const timerDisplay = document.querySelector('.timer');
const focusTimeLabel = document.querySelector('.focus-time');
const ringBox = document.querySelector('.ring');
const ringImg = document.querySelector('.ring-img');
const ttt = document.querySelector('.ttt');

const ringProgress = document.querySelector('.ring-progress');
const RING_CIRCUMFERENCE = 2 * Math.PI * 45; // r=45 in the SVG viewBox

const startBtn = document.querySelector('.start');
const startLabel = document.querySelector('.start-p');
const playIcon = document.querySelector('.play-icon');
const restartBtn = document.querySelector('.restart');

const sessionNumberEl = document.querySelectorAll('.number-p')[0];
const streakNumberEl = document.querySelectorAll('.number-p')[1];

const focusBox = document.querySelector('.focus-box');
const shortBreakBox = document.querySelector('.short-break');
const longBreakBox = document.querySelector('.long-break');
const editBox = document.querySelector('.edit');

const mins0 = document.querySelector('.mins0'); // focus label
const mins1 = document.querySelector('.mins1'); // short break label
const mins2 = document.querySelector('.mins2'); // long break label
const mins3 = document.querySelector('.mins3'); // custom/edit label

const DEFAULT_TITLE = document.title;

// --- Durations (in minutes) ---
const DURATIONS = {
    focus: 25,
    short: 5,
    long: 15
};

// --- State ---
let mode = 'focus'; // 'focus' | 'short' | 'long'
let totalSeconds = DURATIONS.focus * 60;
let remainingSeconds = totalSeconds;
let timerInterval = null;
let isRunning = false;

let sessionsCompleted = 0;
let streakDays = Number(localStorage.getItem('pomodoro-streak')) || 0;

const STORAGE_KEY = 'pomodoro-state';

// --- Init ---
function init() {
    loadDurations();
    restoreState();
    updateTimerDisplay();
    updateStreakDisplay();
    updateSessionDisplay();
    updateRing();
    highlightSelectedBreak();
    mins0.textContent = `${DURATIONS.focus} min`;
    mins1.textContent = `${DURATIONS.short} min`;
    mins2.textContent = `${DURATIONS.long} min`;
    checkStreak();
    updateMuteUI();

    // If we restored a still-running timer, resume it live
    if (isRunning) {
        resumeInterval();
    }

    // Let the music module know the current mode/running state — on a plain
    // load this just preps the right track without playing anything.
    notifyMusicSync();
}

// --- Music Sync ---
// Single source of truth: music is only ever supposed to be playing while
// isRunning is true, and uses the break track/station during short/long
// break, the regular one during focus. features.js listens for this.
function notifyMusicSync() {
    window.dispatchEvent(new CustomEvent('pomodoro-timer-state', { detail: { mode, isRunning } }));
}

// --- Bell / Mute Toggle ---
function updateMuteUI() {
    const soundEnabled = localStorage.getItem('pomodoro-sound-enabled') !== 'false';
    ringBox.classList.toggle('muted', !soundEnabled);
    ringBox.title = soundEnabled
        ? 'Click to mute the alert sound'
        : 'Sound muted — click to unmute';
}

function toggleMute() {
    const soundEnabled = localStorage.getItem('pomodoro-sound-enabled') !== 'false';
    const newValue = !soundEnabled;
    localStorage.setItem('pomodoro-sound-enabled', newValue);
    updateMuteUI();

    // Give an audible preview when turning sound back on
    if (newValue) playCue('focusComplete');

    window.dispatchEvent(new CustomEvent('pomodoro-sound-changed'));
    if (window.scheduleCloudSave) window.scheduleCloudSave();
}
window.updateMuteUI = updateMuteUI;

// --- Progress Ring ---
function updateRing() {
    const progress = totalSeconds > 0 ? remainingSeconds / totalSeconds : 0;
    const offset = RING_CIRCUMFERENCE * (1 - progress);
    ringProgress.style.strokeDasharray = RING_CIRCUMFERENCE;
    ringProgress.style.strokeDashoffset = offset;
}

// --- Timer Display ---
function updateTimerDisplay() {
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    timerDisplay.textContent = formatted;

    // Live tab title so users can glance at the browser tab
    if (isRunning) {
        const modeLabel = mode === 'focus' ? 'Focus' : mode === 'short' ? 'Short Break' : 'Long Break';
        document.title = `${formatted} · ${modeLabel}`;
    } else {
        document.title = DEFAULT_TITLE;
    }

    updateRing();
}

function updateSessionDisplay() {
    sessionNumberEl.textContent = sessionsCompleted;
}

function updateStreakDisplay() {
    streakNumberEl.textContent = streakDays;
}

// --- Cloud Sync Bridge (used by cloud.js) ---
window.pomodoroCore = {
    getState: () => ({
        durations: { ...DURATIONS },
        sessionsCompleted,
        streakDays
    }),
    applyState: (data) => {
        if (!data) return;
        if (data.durations) {
            Object.assign(DURATIONS, data.durations);
            saveDurations();
            mins0.textContent = `${DURATIONS.focus} min`;
            mins1.textContent = `${DURATIONS.short} min`;
            mins2.textContent = `${DURATIONS.long} min`;
        }
        if (typeof data.sessionsCompleted === 'number') {
            sessionsCompleted = data.sessionsCompleted;
            updateSessionDisplay();
        }
        if (typeof data.streakDays === 'number') {
            streakDays = data.streakDays;
            localStorage.setItem('pomodoro-streak', streakDays);
            updateStreakDisplay();
        }
        setActiveMode(mode);
    }
};

// --- Mode Switching ---
function setActiveMode(newMode, { save = true } = {}) {
    mode = newMode;
    isRunning = false;
    clearInterval(timerInterval);
    resetPlayButton();

    timerBox.classList.remove('mode-focus', 'mode-short', 'mode-long');
    timerBox.classList.add(`mode-${mode}`);

    if (mode === 'focus') {
        totalSeconds = DURATIONS.focus * 60;
        focusTimeLabel.textContent = 'FOCUS TIME';
        ttt.textContent = 'Time to focus';
    } else if (mode === 'short') {
        totalSeconds = DURATIONS.short * 60;
        focusTimeLabel.textContent = 'SHORT BREAK';
        ttt.textContent = 'Time to relax';
    } else if (mode === 'long') {
        totalSeconds = DURATIONS.long * 60;
        focusTimeLabel.textContent = 'LONG BREAK';
        ttt.textContent = 'Time to recharge';
    }

    remainingSeconds = totalSeconds;
    updateTimerDisplay();
    highlightSelectedBreak();
    if (save) saveState();

    notifyMusicSync();
}

function highlightSelectedBreak() {
    focusBox.classList.remove('active-break');
    shortBreakBox.classList.remove('active-break');
    longBreakBox.classList.remove('active-break');

    if (mode === 'focus') focusBox.classList.add('active-break');
    if (mode === 'short') shortBreakBox.classList.add('active-break');
    if (mode === 'long') longBreakBox.classList.add('active-break');
}

// --- Start / Pause ---
function toggleStart() {
    if (isRunning) {
        pauseTimer();
    } else {
        startTimer();
    }
}

function startTimer() {
    isRunning = true;
    startLabel.textContent = 'PAUSE';
    playIcon.classList.add('paused');
    playCue('start');
    notifyMusicSync();
    saveState();
    resumeInterval();
}

function resumeInterval() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (remainingSeconds > 0) {
            remainingSeconds--;
            updateTimerDisplay();
            saveState();
        } else {
            handleTimerComplete();
        }
    }, 1000);
}

function pauseTimer() {
    isRunning = false;
    clearInterval(timerInterval);
    startLabel.textContent = 'START';
    playIcon.classList.remove('paused');
    document.title = DEFAULT_TITLE;
    notifyMusicSync();
    saveState();
}

function resetPlayButton() {
    startLabel.textContent = 'START';
    playIcon.classList.remove('paused');
}

// --- Restart ---
function restartTimer() {
    clearInterval(timerInterval);
    isRunning = false;
    remainingSeconds = totalSeconds;
    updateTimerDisplay();
    resetPlayButton();
    notifyMusicSync();
    saveState();
}

// --- Timer Complete ---
function handleTimerComplete() {
    clearInterval(timerInterval);
    isRunning = false;
    resetPlayButton();
    playCue(mode === 'focus' ? 'focusComplete' : 'breakComplete');
    sendBrowserNotification();
    ringBox.classList.add('ring-alert');
    ringImg.classList.add('ring-shake');
    setTimeout(() => {
        ringBox.classList.remove('ring-alert');
        ringImg.classList.remove('ring-shake');
    }, 2000);

    if (mode === 'focus') {
        sessionsCompleted++;
        updateSessionDisplay();
        registerStreakDay();
        if (window.recordPomodoroSession) window.recordPomodoroSession();
        if (window.scheduleCloudSave) window.scheduleCloudSave();

        // Auto switch: every 4th session -> long break, otherwise short break
        if (sessionsCompleted % 4 === 0) {
            setActiveMode('long');
        } else {
            setActiveMode('short');
        }
    } else {
        // Break finished, back to focus
        setActiveMode('focus');
    }
}

// --- Streak Handling ---
function registerStreakDay() {
    const today = new Date().toDateString();
    const lastActiveDay = localStorage.getItem('pomodoro-last-day');

    if (lastActiveDay !== today) {
        streakDays++;
        localStorage.setItem('pomodoro-streak', streakDays);
        localStorage.setItem('pomodoro-last-day', today);
        updateStreakDisplay();
    }
}

function checkStreak() {
    const today = new Date().toDateString();
    const lastActiveDay = localStorage.getItem('pomodoro-last-day');

    if (lastActiveDay) {
        const dayDiff = Math.floor(
            (new Date(today) - new Date(lastActiveDay)) / (1000 * 60 * 60 * 24)
        );
        // Streak broken if more than 1 day has passed with no session
        if (dayDiff > 1) {
            streakDays = 0;
            localStorage.setItem('pomodoro-streak', 0);
            updateStreakDisplay();
        }
    }
}

// --- Sound ---
let audioCtx = null;

function getAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
}

// Browsers block audio unless created/resumed during a real user gesture.
// We unlock it the moment the user first interacts (Start button click),
// so it's already running by the time the timer finishes on its own.
function unlockAudioContext() {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
        ctx.resume();
    }
}

function playTone(ctx, frequency, startTime, duration) {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, startTime);

    // Ramp the volume up/down smoothly to avoid clicks and make it audible
    gainNode.gain.setValueAtTime(0.0001, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.25, startTime + 0.04);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    oscillator.start(startTime);
    oscillator.stop(startTime + duration);
}

// ---- Sound Cues ----
// There are three moments that play a sound: 'start' (timer begins),
// 'focusComplete' (a focus session just ended, a break is starting),
// and 'breakComplete' (a break just ended, back to focus).
//
// To use your OWN sound files instead of the generated tones, drop them
// into a folder (e.g. ./sounds/) and fill in the paths below. Any cue left
// as null falls back to the generated two-note tone in SOUND_PRESETS.
const SOUND_FILES = {
    start: null,          // e.g. './sounds/start.mp3'
    focusComplete: null,  // e.g. './sounds/focus-end.mp3'
    breakComplete: null   // e.g. './sounds/break-end.mp3'
};

// Fallback tones used when no custom file is set for a cue — [firstNote, secondNote] in Hz.
// Feel free to tweak these frequencies to taste.
const SOUND_PRESETS = {
    start: [660, 880],           // short rising chime
    focusComplete: [880, 1046],  // the classic two-note "ding-dong"
    breakComplete: [523, 659]    // softer, lower tone for coming back from a break
};

function playCue(type) {
    const soundEnabled = localStorage.getItem('pomodoro-sound-enabled') !== 'false';
    if (!soundEnabled) return;

    const customSrc = SOUND_FILES[type];
    if (customSrc) {
        try {
            const audio = new Audio(customSrc);
            audio.volume = 0.6;
            audio.play().catch((err) => {
                console.warn(`Custom "${type}" sound failed, falling back to tone:`, err);
                playPresetTone(type);
            });
            return;
        } catch (err) {
            console.warn(`Custom "${type}" sound failed, falling back to tone:`, err);
        }
    }

    playPresetTone(type);
}

function playPresetTone(type) {
    try {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') {
            ctx.resume();
        }

        const [freqA, freqB] = SOUND_PRESETS[type] || SOUND_PRESETS.focusComplete;
        const now = ctx.currentTime;
        playTone(ctx, freqA, now, 0.4);
        playTone(ctx, freqB, now + 0.2, 0.4);
    } catch (err) {
        console.warn('Audio notification unavailable:', err);
    }
}

// --- Browser Notification ---
function sendBrowserNotification() {
    if (!('Notification' in window)) return;

    const title = mode === 'focus' ? 'Focus session complete!' : 'Break is over!';
    const body = mode === 'focus' ? 'Time for a well-earned break.' : 'Time to get back to focus.';

    if (Notification.permission === 'granted') {
        new Notification(title, { body });
    } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then((permission) => {
            if (permission === 'granted') {
                new Notification(title, { body });
            }
        });
    }
}

// --- Custom / Edit ---
function openCustomEdit() {
    const customFocus = prompt('Set focus time (minutes):', DURATIONS.focus);
    if (customFocus && !isNaN(customFocus) && customFocus > 0) {
        DURATIONS.focus = Number(customFocus);
        mins0.textContent = `${DURATIONS.focus} min`;
    }

    const customShort = prompt('Set short break time (minutes):', DURATIONS.short);
    if (customShort && !isNaN(customShort) && customShort > 0) {
        DURATIONS.short = Number(customShort);
        mins1.textContent = `${DURATIONS.short} min`;
    }

    const customLong = prompt('Set long break time (minutes):', DURATIONS.long);
    if (customLong && !isNaN(customLong) && customLong > 0) {
        DURATIONS.long = Number(customLong);
        mins2.textContent = `${DURATIONS.long} min`;
    }

    saveDurations();
    // Refresh current mode with any updated duration
    setActiveMode(mode);
}

function saveDurations() {
    localStorage.setItem('pomodoro-durations', JSON.stringify(DURATIONS));
}

// Called by features.js when the Settings modal is saved
function applyCustomDurations({ focus, short, long } = {}) {
    if (focus && focus > 0) DURATIONS.focus = focus;
    if (short && short > 0) DURATIONS.short = short;
    if (long && long > 0) DURATIONS.long = long;

    mins0.textContent = `${DURATIONS.focus} min`;
    mins1.textContent = `${DURATIONS.short} min`;
    mins2.textContent = `${DURATIONS.long} min`;

    saveDurations();
    setActiveMode(mode);
    if (window.scheduleCloudSave) window.scheduleCloudSave();
}
window.applyCustomDurations = applyCustomDurations;
window.DURATIONS = DURATIONS;

function loadDurations() {
    const saved = localStorage.getItem('pomodoro-durations');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            Object.assign(DURATIONS, parsed);
        } catch (err) {
            console.warn('Could not parse saved durations:', err);
        }
    }
}

// --- State Persistence ---
function saveState() {
    const state = {
        mode,
        totalSeconds,
        sessionsCompleted,
        remainingSeconds: isRunning ? null : remainingSeconds,
        endTime: isRunning ? Date.now() + remainingSeconds * 1000 : null,
        isRunning
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function restoreState() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
        setActiveMode('focus', { save: false });
        return;
    }

    try {
        const state = JSON.parse(saved);
        mode = state.mode || 'focus';
        totalSeconds = state.totalSeconds || DURATIONS[mode] * 60;
        sessionsCompleted = state.sessionsCompleted || 0;

        timerBox.classList.remove('mode-focus', 'mode-short', 'mode-long');
        timerBox.classList.add(`mode-${mode}`);

        if (mode === 'focus') {
            focusTimeLabel.textContent = 'FOCUS TIME';
            ttt.textContent = 'Time to focus';
        } else if (mode === 'short') {
            focusTimeLabel.textContent = 'SHORT BREAK';
            ttt.textContent = 'Time to relax';
        } else {
            focusTimeLabel.textContent = 'LONG BREAK';
            ttt.textContent = 'Time to recharge';
        }

        if (state.isRunning && state.endTime) {
            const secondsLeft = Math.round((state.endTime - Date.now()) / 1000);
            if (secondsLeft > 0) {
                remainingSeconds = secondsLeft;
                isRunning = true;
                startLabel.textContent = 'PAUSE';
                playIcon.classList.add('paused');
            } else {
                // Timer would have finished while the tab was closed
                remainingSeconds = 0;
                isRunning = false;
            }
        } else {
            remainingSeconds = state.remainingSeconds ?? totalSeconds;
            isRunning = false;
        }
    } catch (err) {
        console.warn('Could not restore saved state:', err);
        setActiveMode('focus', { save: false });
    }
}

// --- Event Listeners ---
document.addEventListener('click', unlockAudioContext, { once: true });
startBtn.addEventListener('click', unlockAudioContext, { once: true });
startBtn.addEventListener('click', toggleStart);
restartBtn.addEventListener('click', restartTimer);
focusBox.addEventListener('click', () => setActiveMode('focus'));
shortBreakBox.addEventListener('click', () => setActiveMode('short'));
longBreakBox.addEventListener('click', () => setActiveMode('long'));
editBox.addEventListener('click', () => {
    if (window.openSettingsModal) {
        window.openSettingsModal();
    } else {
        openCustomEdit();
    }
});

ringBox.addEventListener('click', toggleMute);

window.addEventListener('beforeunload', saveState);

// --- Mobile Menu (hamburger, if you wire up a menu later) ---
const menuIcon = document.querySelector('.menu-hamburger');
if (menuIcon) {
    menuIcon.addEventListener('click', () => {
        document.querySelector('.navbar').classList.toggle('menu-open');
    });
}

// --- Kick things off ---
document.addEventListener('DOMContentLoaded', init);