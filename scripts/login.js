// ===== Login: Auth UI (modal, profile popover, sign in/up/out, forgot password) =====
// This file owns everything related to *logging in* — the modal shown when
// signed out, and the compact profile popover shown when signed in. Syncing
// app data to Firestore once signed in lives in cloud.js instead, which this
// file calls into via a small set of window hooks.

import { auth } from './firebase.js';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail,
    updateProfile,
    signInWithPopup,
    GoogleAuthProvider
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';

// --- DOM References: Login Modal ---
const signedOutView = document.querySelector('.account-signed-out');
const signedInView = document.querySelector('.account-signed-in');
const emailInput = document.querySelector('.auth-email');
const passwordInput = document.querySelector('.auth-password');
const nameInput = document.querySelector('.auth-name');
const confirmInput = document.querySelector('.auth-confirm');
const authForm = document.querySelector('.auth-form');
const submitBtn = document.querySelector('.auth-submit');
const submitLabel = document.querySelector('.auth-submit-label');
const loginPanel = document.querySelector('.login-panel');
const authHeading = document.querySelector('.auth-heading');
const authTitle = document.querySelector('.auth-title');
const authSubtitle = document.querySelector('.auth-subtitle');
const strengthFill = document.querySelector('.auth-strength-fill');
const strengthLabel = document.querySelector('.auth-strength-label');
const successTitle = document.querySelector('.auth-success-title');
const successText = document.querySelector('.auth-success-text');
const signOutBtn = document.querySelector('.account-signout-btn');
const forgotBtn = document.querySelector('.account-forgot-btn');
const errorEl = document.querySelector('.account-error');
const emailDisplay = document.querySelector('.account-email');
const syncStatusEl = document.querySelector('.account-sync-status');

const loginModal = document.querySelector('.login-modal');
const loginOverlay = document.querySelector('.login-overlay');
const loginClose = document.querySelector('.login-close');

// --- DOM References: Nav button + Settings bottom prompt ---
const headerLoginBtn = document.querySelector('.header-login-btn');
const headerLoginLabel = document.querySelector('.header-login-label');
const settingsLoginSignedOut = document.querySelector('.settings-login-signed-out');
const settingsLoginSignedInPrompt = document.querySelector('.settings-login-signed-in-prompt');
const settingsSignedInEmail = document.querySelector('.settings-signed-in-email');
const settingsLoginLink = document.querySelector('.settings-login-link');
const settingsSignoutLink = document.querySelector('.settings-signout-link');

// --- DOM References: Profile Popover (shown instead of the modal once signed in) ---
const profilePopover = document.querySelector('.profile-popover');
const profilePopoverOverlay = document.querySelector('.profile-popover-overlay');
const profileAvatarEl = document.querySelector('.profile-avatar');
const profileNameRoleEl = document.querySelector('.profile-name-role');
const profileEmailEl = document.querySelector('.profile-email');
const profileSignoutBtn = document.querySelector('.profile-signout-btn');

let currentUser = null;
let justSignedUp = false;
let mode = 'login';
let busy = false;

// --- UI Helpers ---
function showError(message, isSuccess) {
    if (!errorEl) return;
    errorEl.textContent = message || '';
    errorEl.classList.toggle('success', !!isSuccess);
}

function setSyncStatus(text) {
    if (syncStatusEl) syncStatusEl.textContent = text;
}
window.setAuthSyncStatus = setSyncStatus;

// --- Login Modal open/close ---
function openLoginModal() {
    showError('');
    setMode('login', true);
    resetForm();
    if (window.closeSettingsModal) window.closeSettingsModal();
    closeProfilePopover();
    if (loginModal) loginModal.classList.add('open');
}

function closeLoginModal() {
    if (loginModal) loginModal.classList.remove('open');
}

if (loginOverlay) loginOverlay.addEventListener('click', closeLoginModal);
if (loginClose) loginClose.addEventListener('click', closeLoginModal);

// --- Profile Popover open/close ---
function openProfilePopover() {
    if (!currentUser || !profilePopover) return;

    const displayName = currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : 'Account');
    const initial = displayName.charAt(0).toUpperCase();

    if (profileAvatarEl) profileAvatarEl.textContent = initial;
    if (profileNameRoleEl) profileNameRoleEl.textContent = `${displayName} · Synced`;
    if (profileEmailEl) profileEmailEl.textContent = currentUser.email || '';

    profilePopover.classList.add('open');
}

function closeProfilePopover() {
    if (profilePopover) profilePopover.classList.remove('open');
}

if (profilePopoverOverlay) profilePopoverOverlay.addEventListener('click', closeProfilePopover);
if (profileSignoutBtn) {
    profileSignoutBtn.addEventListener('click', async () => {
        closeProfilePopover();
        try {
            await signOut(auth);
        } catch (err) {
            console.warn('Sign out failed:', err);
        }
    });
}

// --- Nav login button: opens the modal when signed out, the profile
//     popover when signed in, per the new design ---
if (headerLoginBtn) {
    headerLoginBtn.addEventListener('click', () => {
        if (currentUser) {
            if (profilePopover.classList.contains('open')) {
                closeProfilePopover();
            } else {
                openProfilePopover();
            }
        } else {
            openLoginModal();
        }
    });
}

// --- "Not a member yet?" / "Signed in as..." prompt at the bottom of Settings ---
if (settingsLoginLink) {
    settingsLoginLink.addEventListener('click', () => {
        if (currentUser) {
            openProfilePopover();
        } else {
            openLoginModal();
        }
    });
}
if (settingsSignoutLink) {
    settingsSignoutLink.addEventListener('click', async () => {
        try {
            await signOut(auth);
        } catch (err) {
            console.warn('Sign out failed:', err);
        }
    });
}

// --- Auth State ---
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    updateAuthUI(user);

    // Hand off to cloud.js for the actual Firestore load/save — this file
    // only cares about who's signed in and what the UI should show.
    if (user) {
        if (window.onPomodoroSignedIn) window.onPomodoroSignedIn(user);
    } else {
        if (window.onPomodoroSignedOut) window.onPomodoroSignedOut();
    }
});

function updateAuthUI(user) {
    if (user) {
        signedOutView.style.display = 'none';
        signedInView.style.display = 'flex';
        emailDisplay.textContent = user.email || user.displayName || '';
        showError('');
        if (justSignedUp) {
            showSuccessThenClose(user);
        } else {
            closeLoginModal();
        }
    } else {
        signedOutView.style.display = 'flex';
        signedInView.style.display = 'none';
        closeProfilePopover();
    }

    // Nav pill button
    if (headerLoginBtn && headerLoginLabel) {
        headerLoginBtn.classList.toggle('signed-in', !!user);
        const label = user ? (user.email || user.displayName || 'Account') : 'Log in';
        headerLoginLabel.textContent = label;
        headerLoginBtn.setAttribute('aria-label', user ? `Signed in as ${label}` : 'Log in');
    }

    // "Not a member yet?" prompt at the bottom of Settings
    if (settingsLoginSignedOut && settingsLoginSignedInPrompt) {
        settingsLoginSignedOut.style.display = user ? 'none' : 'inline';
        settingsLoginSignedInPrompt.style.display = user ? 'inline' : 'none';
        if (user && settingsSignedInEmail) settingsSignedInEmail.textContent = user.email || user.displayName || 'your account';
    }
}

// --- Mode switching (Log in <-> Sign up) ---
function setMode(next, instant) {
    mode = next;
    const signup = next === 'signup';

    const apply = () => {
        loginPanel.dataset.mode = next;
        authTitle.textContent = signup ? 'Create Account' : 'Welcome Back';
        authSubtitle.textContent = signup ? 'Sign up to save your progress everywhere' : 'Login to continue to your account';
        submitLabel.textContent = signup ? 'Create account' : 'Login';
        passwordInput.autocomplete = signup ? 'new-password' : 'current-password';
        // hidden fields shouldn't be reachable with Tab
        nameInput.tabIndex = signup ? 0 : -1;
        confirmInput.tabIndex = signup ? 0 : -1;
        authHeading.classList.remove('swap');
    };

    if (instant) {
        apply();
    } else {
        authHeading.classList.add('swap');
        setTimeout(apply, 180);
    }
    showError('');
    updateChecks();
}

document.querySelectorAll('.auth-switch-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
        setMode(btn.dataset.goto);
        setTimeout(() => (btn.dataset.goto === 'signup' ? nameInput : emailInput).focus(), 260);
    });
});

function resetForm() {
    [nameInput, emailInput, passwordInput, confirmInput].forEach((i) => {
        i.value = '';
        i.closest('.auth-field').classList.remove('invalid', 'valid');
    });
    document.querySelectorAll('.auth-eye').forEach((b) => setEye(b, false));
    loginPanel.classList.remove('is-success');
    updateChecks();
}

// --- Show / hide password ---
function setEye(btn, show) {
    btn.classList.toggle('showing', show);
    btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    const input = btn.parentElement.querySelector('input');
    input.type = show ? 'text' : 'password';
}
document.querySelectorAll('.auth-eye').forEach((btn) => {
    btn.addEventListener('click', () => setEye(btn, !btn.classList.contains('showing')));
});

// --- Live validation (sign-up) ---
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function passwordScore(pw) {
    let score = 0;
    if (pw.length >= 6) score++;
    if (pw.length >= 10) score++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return Math.min(score, 4);
}

function setRule(name, ok) {
    const li = document.querySelector(`.auth-rules [data-rule="${name}"]`);
    if (li) li.classList.toggle('ok', ok);
}

function updateChecks() {
    const pw = passwordInput.value;
    const confirm = confirmInput.value;

    const lengthOk = pw.length >= 6;
    const mixOk = /[A-Za-z]/.test(pw) && /\d/.test(pw);
    const matchOk = pw.length > 0 && pw === confirm;

    setRule('length', lengthOk);
    setRule('mix', mixOk);
    setRule('match', matchOk);

    const levels = [
        { w: '8%', c: '#ff6b6b', t: pw ? 'Too weak' : 'Enter a password' },
        { w: '30%', c: '#ff9f43', t: 'Weak' },
        { w: '55%', c: '#feca57', t: 'Okay' },
        { w: '80%', c: '#7bd88f', t: 'Strong' },
        { w: '100%', c: '#4ade80', t: 'Very strong' }
    ];
    const lvl = pw ? levels[passwordScore(pw)] : levels[0];
    strengthFill.style.width = pw ? lvl.w : '0';
    strengthFill.style.background = lvl.c;
    strengthLabel.textContent = lvl.t;

    emailInput.closest('.auth-field').classList.toggle('valid', EMAIL_RE.test(emailInput.value.trim()));
    confirmInput.closest('.auth-field').classList.toggle('valid', matchOk);
}

[emailInput, passwordInput, confirmInput, nameInput].forEach((input) => {
    input.addEventListener('input', () => {
        input.closest('.auth-field').classList.remove('invalid');
        if (errorEl.textContent && !errorEl.classList.contains('success')) showError('');
        updateChecks();
    });
});

// --- Busy state / feedback helpers ---
function setBusy(on) {
    busy = on;
    submitBtn.disabled = on;
    submitBtn.classList.toggle('loading', on);
    document.querySelectorAll('.auth-social-btn').forEach((b) => (b.disabled = on));
}

function fail(message, field) {
    showError(message);
    if (field) field.closest('.auth-field').classList.add('invalid');
    loginPanel.classList.remove('shake');
    void loginPanel.offsetWidth; // restart the animation
    loginPanel.classList.add('shake');
    if (field) field.focus();
}

// --- Submit (Log in or Create account) ---
authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;
    showError('');

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!EMAIL_RE.test(email)) {
        fail(email ? 'That email address looks invalid.' : 'Enter your email.', emailInput);
        return;
    }
    if (!password) {
        fail('Enter your password.', passwordInput);
        return;
    }

    if (mode === 'login') {
        setBusy(true);
        try {
            await signInWithEmailAndPassword(auth, email, password);
            passwordInput.value = '';
        } catch (err) {
            fail(friendlyAuthError(err));
        } finally {
            setBusy(false);
        }
        return;
    }

    // Sign up
    const name = nameInput.value.trim();
    if (password.length < 6) {
        fail('Password must be at least 6 characters.', passwordInput);
        return;
    }
    if (!(/[A-Za-z]/.test(password) && /\d/.test(password))) {
        fail('Use at least one letter and one number.', passwordInput);
        return;
    }
    if (password !== confirmInput.value) {
        fail("Passwords don't match.", confirmInput);
        return;
    }

    setBusy(true);
    justSignedUp = true; // tells updateAuthUI to show the success screen
    try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        if (name) {
            try {
                await updateProfile(cred.user, { displayName: name });
            } catch (err) {
                console.warn('Could not save display name:', err);
            }
        }
        passwordInput.value = '';
        confirmInput.value = '';
        // onAuthStateChanged may have fired before the name was saved
        if (loginPanel.classList.contains('is-success')) updateSuccessText(cred.user, name);
    } catch (err) {
        justSignedUp = false;
        fail(friendlyAuthError(err), /email-already-in-use|invalid-email/.test(err.code || '') ? emailInput : null);
        if ((err.code || '') === 'auth/email-already-in-use') {
            showError('That email is already registered. Try logging in instead.');
        }
    } finally {
        setBusy(false);
    }
});

// --- Success screen ---
function updateSuccessText(user, nameOverride) {
    const name = nameOverride || user.displayName || (user.email ? user.email.split('@')[0] : '');
    successTitle.textContent = 'Account created!';
    successText.textContent = name ? `Welcome aboard, ${name}` : 'Welcome aboard';
}

function showSuccessThenClose(user) {
    justSignedUp = false;
    updateSuccessText(user, nameInput.value.trim());
    loginPanel.classList.add('is-success');
    setTimeout(() => {
        closeLoginModal();
        loginPanel.classList.remove('is-success');
    }, 1700);
}

// --- Social sign-in (Google only) ---
function makeProvider(name) {
    if (name === 'google') return new GoogleAuthProvider();
    return null;
}

document.querySelectorAll('.auth-social-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
        if (busy) return;
        showError('');
        const provider = makeProvider(btn.dataset.provider);
        if (!provider) return;

        setBusy(true);
        try {
            await signInWithPopup(auth, provider);
        } catch (err) {
            const code = err && err.code ? err.code : '';
            if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
                fail(friendlyAuthError(err, btn.dataset.provider));
            }
        } finally {
            setBusy(false);
        }
    });
});

signOutBtn.addEventListener('click', async () => {
    try {
        await signOut(auth);
    } catch (err) {
        console.warn('Sign out failed:', err);
    }
});

if (forgotBtn) {
    forgotBtn.addEventListener('click', async () => {
        showError('');
        const email = emailInput.value.trim();

        if (!email) {
            showError('Enter your email above first, then click "Forgot password?"');
            return;
        }

        try {
            await sendPasswordResetEmail(auth, email);
            showError('Check your inbox for a password reset link.', true);
        } catch (err) {
            showError(friendlyAuthError(err));
        }
    });
}

function friendlyAuthError(err, provider) {
    const code = err && err.code ? err.code : '';
    const name = provider ? provider.charAt(0).toUpperCase() + provider.slice(1) : 'That';
    switch (code) {
        case 'auth/email-already-in-use':
            return 'That email is already registered. Try logging in instead.';
        case 'auth/invalid-email':
            return 'That email address looks invalid.';
        case 'auth/weak-password':
            return 'Password must be at least 6 characters.';
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
            return 'Incorrect email or password.';
        case 'auth/too-many-requests':
            return 'Too many attempts. Please wait a moment and try again.';
        case 'auth/network-request-failed':
            return 'Network error. Check your connection (or VPN) and try again.';
        case 'auth/operation-not-allowed':
            return `${name} sign-in isn't turned on yet. Enable it in Firebase → Authentication → Sign-in method.`;
        case 'auth/unauthorized-domain':
            return 'This address isn\'t allowed for sign-in yet. Add it under Firebase → Authentication → Settings → Authorized domains.';
        case 'auth/popup-blocked':
            return 'The sign-in popup was blocked. Allow popups for this site and try again.';
        case 'auth/account-exists-with-different-credential':
            return 'An account already exists with that email using a different sign-in method.';
        default:
            return 'Something went wrong. Please try again.';
    }
}
