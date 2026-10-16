// ===== Settings Features: Settings Modal + Music Player + Timer-Synced Music =====

document.addEventListener('DOMContentLoaded', () => {
    initSettingsModal();
    initThemeMode();
    initThemePicker();
    initBackgroundPicker();
    initMusicPanel();
    initTimerSyncedMusic();
});

// ---------- Settings Modal ----------
const settingsBtn = document.querySelector('.settings-btn');
const settingsModal = document.querySelector('.settings-modal');
const settingsOverlay = document.querySelector('.settings-overlay');
const settingsClose = document.querySelector('.settings-close');
const settingsSave = document.querySelector('.settings-save');
const inputFocus = document.querySelector('#settings-focus');
const inputShort = document.querySelector('#settings-short');
const inputLong = document.querySelector('#settings-long');
const inputSound = document.querySelector('#settings-sound');

function initSettingsModal() {
    if (!settingsBtn) return;

    settingsBtn.addEventListener('click', openSettingsModal);
    settingsOverlay.addEventListener('click', closeSettingsModal);
    settingsClose.addEventListener('click', closeSettingsModal);
    settingsSave.addEventListener('click', saveSettings);

    const soundPref = localStorage.getItem('pomodoro-sound-enabled');
    inputSound.checked = soundPref !== 'false';

    window.addEventListener('pomodoro-sound-changed', () => {
        inputSound.checked = localStorage.getItem('pomodoro-sound-enabled') !== 'false';
    });
}

function openSettingsModal() {
    if (window.DURATIONS) {
        inputFocus.value = window.DURATIONS.focus;
        inputShort.value = window.DURATIONS.short;
        inputLong.value = window.DURATIONS.long;
    }
    inputSound.checked = localStorage.getItem('pomodoro-sound-enabled') !== 'false';
    settingsModal.classList.add('open');
}

function closeSettingsModal() {
    settingsModal.classList.remove('open');
}

function saveSettings() {
    const focusVal = Number(inputFocus.value);
    const shortVal = Number(inputShort.value);
    const longVal = Number(inputLong.value);

    if (window.applyCustomDurations) {
        window.applyCustomDurations({ focus: focusVal, short: shortVal, long: longVal });
    }

    localStorage.setItem('pomodoro-sound-enabled', inputSound.checked);
    if (window.updateMuteUI) window.updateMuteUI();
    closeSettingsModal();
}

window.openSettingsModal = openSettingsModal;
window.closeSettingsModal = closeSettingsModal;

// ---------- Dark / Light Mode ----------
const THEME_MODE_KEY = 'pomodoro-theme-mode';
const themeModeBtn = document.querySelector('.theme-mode-btn');
const themeModeCards = document.querySelectorAll('.theme-mode-card');

function initThemeMode() {
    const saved = localStorage.getItem(THEME_MODE_KEY) || 'dark';
    applyThemeMode(saved, false);

    if (themeModeBtn) {
        themeModeBtn.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
            applyThemeMode(current === 'light' ? 'dark' : 'light', true);
        });
    }

    themeModeCards.forEach((card) => {
        card.addEventListener('click', () => {
            applyThemeMode(card.dataset.themeMode, true);
        });
    });
}

function applyThemeMode(mode, persist) {
    if (mode === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
    } else {
        document.documentElement.removeAttribute('data-theme');
        mode = 'dark';
    }

    if (persist) {
        localStorage.setItem(THEME_MODE_KEY, mode);
    }

    themeModeCards.forEach((card) => {
        card.classList.toggle('active', card.dataset.themeMode === mode);
    });
}

// ---------- Theme Color ----------
const themeSwatches = document.querySelectorAll('.theme-swatch');
const THEME_KEY = 'pomodoro-theme-color';

function initThemePicker() {
    if (themeSwatches.length === 0) return;

    const savedColor = localStorage.getItem(THEME_KEY);
    if (savedColor) {
        applyThemeColor(savedColor);
    }
    markActiveSwatch();

    themeSwatches.forEach((swatch) => {
        swatch.addEventListener('click', () => {
            const color = swatch.dataset.color;
            applyThemeColor(color);
            localStorage.setItem(THEME_KEY, color);
            markActiveSwatch();
        });
    });
}

function applyThemeColor(rgbTriplet) {
    document.documentElement.style.setProperty('--accent-rgb', rgbTriplet);
    document.documentElement.style.setProperty('--accent', `rgb(${rgbTriplet})`);
}

function markActiveSwatch() {
    const currentColor = localStorage.getItem(THEME_KEY) || '240, 41, 41';
    themeSwatches.forEach((swatch) => {
        swatch.classList.toggle('active', swatch.dataset.color === currentColor);
    });
}

// ---------- Background Picker ----------
const BG_TYPE_KEY = 'pomodoro-bg-type';
const BG_VALUE_KEY = 'pomodoro-bg-value';
const BG_MAX_UPLOAD_BYTES = 3 * 1024 * 1024;

const bgSwatches = document.querySelectorAll('.bg-swatch');
const bgUploadInput = document.querySelector('.bg-upload-input');
const bgRemoveCustomBtn = document.querySelector('.bg-remove-custom-btn');
const bgUploadHint = document.querySelector('.bg-upload-hint');

function initBackgroundPicker() {
    if (bgSwatches.length === 0) return;

    const savedType = localStorage.getItem(BG_TYPE_KEY) || 'default';
    const savedValue = localStorage.getItem(BG_VALUE_KEY) || '';
    applyBackground(savedType, savedValue);
    markActiveBackground();

    bgSwatches.forEach((swatch) => {
        swatch.addEventListener('click', () => {
            const type = swatch.dataset.bgType;
            const value = swatch.dataset.bgValue || '';
            applyBackground(type, value);
            persistBackground(type, value);
            markActiveBackground();
        });
    });

    if (bgUploadInput) {
        bgUploadInput.addEventListener('change', handleBackgroundUpload);
    }
    if (bgRemoveCustomBtn) {
        bgRemoveCustomBtn.addEventListener('click', () => {
            applyBackground('default', '');
            persistBackground('default', '');
            markActiveBackground();
            setBgHint('');
        });
    }
}

function handleBackgroundUpload(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
        setBgHint('Please choose a JPG, PNG, or WEBP image.', true);
        bgUploadInput.value = '';
        return;
    }
    if (file.size > BG_MAX_UPLOAD_BYTES) {
        setBgHint('That image is a bit large — please use one under 3MB.', true);
        bgUploadInput.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = () => {
        const dataUrl = reader.result;
        applyBackground('custom', dataUrl);

        try {
            persistBackground('custom', dataUrl);
            setBgHint('Custom background applied.');
        } catch (err) {
            console.warn('Could not save custom background:', err);
            setBgHint('Applied for now, but too large to save permanently. Try a smaller image.', true);
        }

        markActiveBackground();
        bgUploadInput.value = '';
    };
    reader.onerror = () => {
        setBgHint('Could not read that file — please try another image.', true);
    };
    reader.readAsDataURL(file);
}

function setBgHint(message, isError) {
    if (!bgUploadHint) return;
    bgUploadHint.textContent = message || '';
    bgUploadHint.classList.toggle('error', !!isError);
}

function applyBackground(type, value) {
    const root = document.documentElement;

    if (type === 'color' && value) {
        root.style.setProperty('--bg-image', 'none');
        root.style.setProperty('--bg-color', value);
    } else if (type === 'custom' && value) {
        const resolvedUrl = value.startsWith('data:') ? value : new URL(value, document.baseURI).href;
        root.style.setProperty('--bg-image', `url("${resolvedUrl}")`);
        root.style.setProperty('--bg-color', 'transparent');
    } else {
        root.style.removeProperty('--bg-image');
        root.style.removeProperty('--bg-color');
    }
}

function persistBackground(type, value) {
    localStorage.setItem(BG_TYPE_KEY, type);
    localStorage.setItem(BG_VALUE_KEY, value || '');
}

function markActiveBackground() {
    const currentType = localStorage.getItem(BG_TYPE_KEY) || 'default';
    const currentValue = localStorage.getItem(BG_VALUE_KEY) || '';

    bgSwatches.forEach((swatch) => {
        const matches = swatch.dataset.bgType === currentType
            && (currentType !== 'color' || swatch.dataset.bgValue === currentValue);
        swatch.classList.toggle('active', matches);
    });

    if (bgRemoveCustomBtn) {
        bgRemoveCustomBtn.hidden = currentType !== 'custom';
    }
}

// ---------- Music Player (Dashboard) ----------
const MUSIC_TRACKS = [
    { name: 'The mountain lofi study', src: './music/the_mountain-lofi-study-576576.mp3' },
    { name: 'Study Music-1', src: './music/leberch-study-580088.mp3' },
    { name: 'Study Music-2', src: './music/leberch-study-music-602063.mp3' },
    { name: 'Study Music-3', src: './music/Study-music-3.mp3' },
    { name: 'Study Music-4', src: './music/Study-music-4.mp3' },
    { name: 'Piano Study Music', src: './music/piano-study-music.mp3' },
    { name: 'Jazz Study Music', src: './music/jazz-study-music.mp3' },
];

const YOUTUBE_PLAYLIST = [];
const SPOTIFY_PLAYLIST = [];

// --- Real search (optional) ---
const YOUTUBE_API_KEY = 'AIzaSyBTEifEzx14v6B34kJOxc7LwwexF-74c-8';

const SPOTIFY_SEARCH_FUNCTION_URL = '';

const SEARCH_DEBOUNCE_MS = 450;
const SEARCH_MIN_CHARS = 2;

const BREAK_TRACK = { name: 'Break Vibes', src: './sounds-noti/break.mp3' };

// --- DOM References ---
const musicBtn = document.querySelector('.music-btn');
const musicPanel = document.querySelector('.music-panel');
const musicOverlay = document.querySelector('.music-overlay');
const musicClose = document.querySelector('.music-close');

const musicTabs = document.querySelectorAll('.music-tab');
const tabPanels = document.querySelectorAll('.music-list-section');
const searchInput = document.querySelector('.music-search-input');

const bgAudio = document.querySelector('.bg-audio');
const ytMount = document.querySelector('.now-playing-yt-mount');
const spotifyMount = document.querySelector('.now-playing-spotify-mount');

const nowPlayingThumb = document.querySelector('.now-playing-thumb');
const nowPlayingArtPlaceholder = document.querySelector('.now-playing-art-placeholder');
const nowPlayingTitle = document.querySelector('.now-playing-title');
const nowPlayingSubtitle = document.querySelector('.now-playing-subtitle');
const nowPlayingSource = document.querySelector('.now-playing-source');

const transportBlock = document.querySelector('.now-playing-transport-block');
const progressSlider = document.querySelector('.now-playing-progress');
const timeCurrentEl = document.querySelector('.now-playing-time-current');
const timeDurationEl = document.querySelector('.now-playing-time-duration');
const playPauseBtn = document.querySelector('.music-play-pause');
const prevTrackBtn = document.querySelector('.music-prev');
const nextTrackBtn = document.querySelector('.music-next');
const shuffleBtn = document.querySelector('.music-shuffle');
const repeatBtn = document.querySelector('.music-repeat');
const volumeSlider = document.querySelector('.music-volume');

const linkInput = document.querySelector('.music-link-input');
const linkLoadBtn = document.querySelector('.music-link-load');

// --- State ---
let activeSource = null;
let focusSource = null;
let breakSource = null;
let currentTrackIndex = 0;
let isSeeking = false;
let progressTimer = null;
let isShuffle = false;
let isRepeatOne = false;
let ytQueue = YOUTUBE_PLAYLIST;

const oEmbedCache = new Map();

function initMusicPanel() {
    if (!musicBtn) return;

    musicBtn.addEventListener('click', () => musicPanel.classList.add('open'));
    musicOverlay.addEventListener('click', () => musicPanel.classList.remove('open'));
    musicClose.addEventListener('click', () => musicPanel.classList.remove('open'));

    musicTabs.forEach((tab) => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    if (searchInput) {
        searchInput.addEventListener('input', () => handleSearchInput(searchInput.value));
    }

    const savedVolume = localStorage.getItem('pomodoro-music-volume');
    const startVolume = savedVolume !== null ? Number(savedVolume) : 0.5;
    volumeSlider.value = startVolume;
    bgAudio.volume = startVolume;
    volumeSlider.addEventListener('input', () => {
        const v = Number(volumeSlider.value);
        bgAudio.volume = v;
        if (ytPlayer && ytPlayer.setVolume) ytPlayer.setVolume(v * 100);
        localStorage.setItem('pomodoro-music-volume', volumeSlider.value);
    });

    playPauseBtn.addEventListener('click', togglePlayPause);
    prevTrackBtn.addEventListener('click', () => step(-1));
    nextTrackBtn.addEventListener('click', () => step(1));
    shuffleBtn.addEventListener('click', () => {
        isShuffle = !isShuffle;
        shuffleBtn.classList.toggle('active', isShuffle);
        shuffleBtn.setAttribute('aria-pressed', isShuffle);
    });
    repeatBtn.addEventListener('click', () => {
        isRepeatOne = !isRepeatOne;
        repeatBtn.classList.toggle('active', isRepeatOne);
        repeatBtn.setAttribute('aria-pressed', isRepeatOne);
    });

    progressSlider.addEventListener('mousedown', () => { isSeeking = true; });
    progressSlider.addEventListener('touchstart', () => { isSeeking = true; });
    progressSlider.addEventListener('change', onSeekCommit);

    bgAudio.addEventListener('timeupdate', () => updateProgressFromLocal());
    bgAudio.addEventListener('loadedmetadata', () => updateProgressFromLocal());
    bgAudio.addEventListener('ended', () => {
        if (isRepeatOne) {
            bgAudio.currentTime = 0;
            playCurrent();
        } else {
            step(1, true);
        }
    });
    bgAudio.addEventListener('error', () => {
        const err = bgAudio.error;
        const codeNames = { 1: 'ABORTED', 2: 'NETWORK', 3: 'DECODE', 4: 'SRC_NOT_SUPPORTED (often a 404 or wrong path)' };
        console.error(
            `[music] Failed to load "${bgAudio.currentSrc || bgAudio.src}" — ` +
            `error code ${err ? err.code : '?'} (${err ? codeNames[err.code] : 'unknown'}).`
        );
    });

    linkLoadBtn.addEventListener('click', loadFromPastedLink);
    linkInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') loadFromPastedLink();
    });

    renderList('youtube', YOUTUBE_PLAYLIST);
    renderList('spotify', SPOTIFY_PLAYLIST);
    renderLocalList();

    if (MUSIC_TRACKS.length > 0) {
        focusSource = { type: 'local', trackIndex: 0 };
    }
    breakSource = BREAK_TRACK ? { type: 'local-break' } : null;
}

// ---------- Tabs & Lists ----------
function switchTab(tab) {
    musicTabs.forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === tab));
    tabPanels.forEach((panel) => {
        panel.hidden = panel.dataset.tabPanel !== tab;
    });
    if (searchInput) {
        searchInput.value = '';
        filterActiveList('');
    }
}

function filterActiveList(query) {
    const activeTab = document.querySelector('.music-tab.active').dataset.tab;
    const list = document.querySelector(`.music-list[data-list="${activeTab}"]`);
    if (!list) return;
    const q = query.trim().toLowerCase();
    list.querySelectorAll('.music-list-item').forEach((item) => {
        const text = item.textContent.toLowerCase();
        item.style.display = !q || text.includes(q) ? 'flex' : 'none';
    });
}

// ---------- Real search (YouTube Data API + Spotify via Cloud Function) ----------
let searchDebounceTimer = null;

function handleSearchInput(query) {
    clearTimeout(searchDebounceTimer);
    const activeTab = document.querySelector('.music-tab.active').dataset.tab;

    if (activeTab === 'local') {
        filterActiveList(query);
        return;
    }

    const trimmed = query.trim();
    if (trimmed.length < SEARCH_MIN_CHARS) {
        if (activeTab === 'youtube') renderList('youtube', YOUTUBE_PLAYLIST);
        else if (activeTab === 'spotify') renderList('spotify', SPOTIFY_PLAYLIST);
        return;
    }

    searchDebounceTimer = setTimeout(() => {
        if (activeTab === 'youtube') runYouTubeSearch(trimmed);
        else if (activeTab === 'spotify') runSpotifySearch(trimmed);
    }, SEARCH_DEBOUNCE_MS);
}

function showListMessage(platform, message) {
    const list = document.querySelector(`.music-list[data-list="${platform}"]`);
    if (list) list.innerHTML = `<p class="music-list-empty">${message}</p>`;
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}

async function runYouTubeSearch(query) {
    if (!YOUTUBE_API_KEY) {
        showListMessage('youtube', 'Search is not available right now.');
        return;
    }

    showListMessage('youtube', 'Searching…');

    try {
        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&videoSyndicated=true&maxResults=10&q=${encodeURIComponent(query)}&key=${YOUTUBE_API_KEY}`;
        const res = await fetch(url);
        const data = await res.json();
        if (!res.ok) {
            const reason = (data.error && data.error.message) || `status ${res.status}`;
            throw new Error(reason);
        }
        renderYouTubeSearchResults(data.items || []);
    } catch (err) {
        console.warn('[music] YouTube search failed:', err);
        showListMessage('youtube', `YouTube search failed: ${err.message}`);
    }
}

function renderYouTubeSearchResults(items) {
    const list = document.querySelector('.music-list[data-list="youtube"]');
    if (!list) return;

    if (items.length === 0) {
        showListMessage('youtube', 'No results found.');
        return;
    }

    list.innerHTML = '';
    const queue = items
        .filter((item) => item.id && item.id.videoId)
        .map((item) => ({ id: item.id.videoId }));
    let queueIndex = 0;
    items.forEach((item) => {
        const videoId = item.id && item.id.videoId;
        if (!videoId) return;
        const myIndex = queueIndex++;

        const row = document.createElement('button');
        row.className = 'music-list-item';
        const thumb = item.snippet?.thumbnails?.default?.url || '';
        row.innerHTML = `
            <div class="music-list-thumb" style="background-image:url('${thumb}')"></div>
            <div class="music-list-text">
                <p class="music-list-title">${escapeHtml(item.snippet?.title)}</p>
                <p class="music-list-subtitle">${escapeHtml(item.snippet?.channelTitle)}</p>
            </div>
            <span class="music-list-play">&#9654;</span>
        `;
        row.addEventListener('click', () => {
            ytQueue = queue;
            loadYouTube(videoId, myIndex, true);
        });
        list.appendChild(row);
    });
}

async function runSpotifySearch(query) {
    if (!SPOTIFY_SEARCH_FUNCTION_URL) {
        showListMessage('spotify', 'Search is not available for Spotify. Paste a Spotify link instead.');
        return;
    }

    showListMessage('spotify', 'Searching…');

    try {
        const res = await fetch(`${SPOTIFY_SEARCH_FUNCTION_URL}?q=${encodeURIComponent(query)}`);
        if (!res.ok) throw new Error(`Spotify search failed: ${res.status}`);
        const data = await res.json();
        renderSpotifySearchResults(data.results || []);
    } catch (err) {
        console.warn('[music] Spotify search failed:', err);
        showListMessage('spotify', 'Spotify search failed — check the console for details.');
    }
}

function renderSpotifySearchResults(results) {
    const list = document.querySelector('.music-list[data-list="spotify"]');
    if (!list) return;

    if (results.length === 0) {
        showListMessage('spotify', 'No results found.');
        return;
    }

    list.innerHTML = '';
    results.forEach((result) => {
        const row = document.createElement('button');
        row.className = 'music-list-item';
        row.innerHTML = `
            <div class="music-list-thumb" style="background-image:url('${result.image || ''}')"></div>
            <div class="music-list-text">
                <p class="music-list-title">${escapeHtml(result.name)}</p>
                <p class="music-list-subtitle">${escapeHtml(result.subtitle)}</p>
            </div>
            <span class="music-list-play">&#9654;</span>
        `;
        row.addEventListener('click', () => loadSpotify(result.embedPath));
        list.appendChild(row);
    });
}

function renderList(platform, items) {
    const list = document.querySelector(`.music-list[data-list="${platform}"]`);
    if (!list) return;

    list.innerHTML = '';
    items.forEach((item, index) => {
        const row = document.createElement('button');
        row.className = 'music-list-item';
        row.innerHTML = `
            <div class="music-list-thumb"></div>
            <div class="music-list-text">
                <p class="music-list-title">Loading…</p>
                <p class="music-list-subtitle">${platform === 'youtube' ? 'YouTube' : 'Spotify'}</p>
            </div>
            <span class="music-list-play">&#9654;</span>
        `;
        row.addEventListener('click', () => {
            if (platform === 'youtube') { ytQueue = items; loadYouTube(item.id, index, true); }
            else loadSpotify(item.path, index);
        });
        list.appendChild(row);

        const oEmbedUrl = platform === 'youtube'
            ? `https://www.youtube.com/watch?v=${item.id}`
            : `https://open.spotify.com/${item.path}`;
        fetchOEmbed(platform, oEmbedUrl).then((meta) => {
            if (!meta) return;
            row.querySelector('.music-list-thumb').style.backgroundImage = `url("${meta.thumbnail_url}")`;
            row.querySelector('.music-list-title').textContent = meta.title || 'Untitled';
            row.querySelector('.music-list-subtitle').textContent = meta.author_name || (platform === 'youtube' ? 'YouTube' : 'Spotify');
        });
    });
}

function renderLocalList() {
    const list = document.querySelector('.music-list[data-list="local"]');
    if (!list) return;

    if (MUSIC_TRACKS.length === 0) {
        list.innerHTML = '<p class="music-list-empty">No local tracks yet — add files to a /music folder and list them in MUSIC_TRACKS.</p>';
        return;
    }

    list.innerHTML = '';
    MUSIC_TRACKS.forEach((track, index) => {
        const row = document.createElement('button');
        row.className = 'music-list-item';
        row.innerHTML = `
            <div class="music-list-thumb music-list-thumb-local">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
            </div>
            <div class="music-list-text">
                <p class="music-list-title">${track.name}</p>
                <p class="music-list-subtitle">Local file</p>
            </div>
            <span class="music-list-play">&#9654;</span>
        `;
        row.addEventListener('click', () => loadLocal(index));
        list.appendChild(row);
    });
}

// --- oEmbed (no API key needed — public endpoints meant for embedding) ---
function fetchOEmbed(platform, url) {
    const cacheKey = platform + ':' + url;
    if (oEmbedCache.has(cacheKey)) return Promise.resolve(oEmbedCache.get(cacheKey));

    const endpoint = platform === 'youtube'
        ? `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
        : `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`;

    return fetch(endpoint)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
            if (data) oEmbedCache.set(cacheKey, data);
            return data;
        })
        .catch((err) => {
            console.warn(`[music] oEmbed lookup failed for ${url}:`, err);
            return null;
        });
}

// ---------- Loading a source (prepares it; doesn't necessarily play) ----------
let loadedLocalSrc = null;

function loadLocal(index, autoplay) {
    currentTrackIndex = index;
    const track = MUSIC_TRACKS[index];
    activeSource = { type: 'local', trackIndex: index };
    focusSource = activeSource;
    stopYouTube();
    hideSpotify();

    if (loadedLocalSrc !== track.src) {
        bgAudio.src = track.src;
        loadedLocalSrc = track.src;
    }

    setNowPlaying({
        title: track.name,
        subtitle: 'Local file',
        sourceLabel: 'My Music',
        thumbnailUrl: null
    });
    showTransportBlock(true);
    if (autoplay) playCurrent();
    else bgAudio.pause();
}

let currentLoadedYtId = null;

function loadYouTube(videoId, listIndex, autoplay) {
    activeSource = { type: 'youtube', id: videoId, listIndex };
    focusSource = activeSource;

    stopLocal();
    hideSpotify();
    showTransportBlock(true);

    fetchOEmbed('youtube', `https://www.youtube.com/watch?v=${videoId}`).then((meta) => {
        setNowPlaying({
            title: meta ? meta.title : 'YouTube video',
            subtitle: meta ? meta.author_name : '',
            sourceLabel: 'YouTube',
            thumbnailUrl: meta ? meta.thumbnail_url : null
        });
    });

    ensureYouTubeReady().then(() => {
        if (!ytPlayer) {
            createYouTubePlayer(videoId, autoplay);
            currentLoadedYtId = videoId;
        } else if (currentLoadedYtId === videoId) {
            if (autoplay) ytPlayer.playVideo();
            else ytPlayer.pauseVideo();
        } else {
            currentLoadedYtId = videoId;
            if (autoplay) ytPlayer.loadVideoById(videoId);
            else ytPlayer.cueVideoById(videoId);
        }
    });
}

function loadSpotify(path, listIndex) {
    activeSource = { type: 'spotify', path, listIndex };
    focusSource = activeSource;

    stopLocal();
    stopYouTube();
    showTransportBlock(false);

    fetchOEmbed('spotify', `https://open.spotify.com/${path}`).then((meta) => {
        setNowPlaying({
            title: meta ? meta.title : 'Spotify',
            subtitle: 'Spotify',
            sourceLabel: 'Spotify',
            thumbnailUrl: meta ? meta.thumbnail_url : null
        });
    });

    embedSpotify(path);
}

// ---------- Now Playing card ----------
function setNowPlaying({ title, subtitle, sourceLabel, thumbnailUrl }) {
    nowPlayingTitle.textContent = title || 'Nothing loaded yet';
    nowPlayingSubtitle.textContent = subtitle || '';
    nowPlayingSource.textContent = sourceLabel || '';

    if (thumbnailUrl) {
        nowPlayingThumb.src = thumbnailUrl;
        nowPlayingThumb.hidden = false;
        nowPlayingArtPlaceholder.hidden = true;
    } else {
        nowPlayingThumb.hidden = true;
        nowPlayingArtPlaceholder.hidden = false;
    }
}

function showTransportBlock(show) {
    transportBlock.hidden = !show;
}

// ---------- Unified transport controls ----------
function togglePlayPause() {
    if (!activeSource) return;

    if (activeSource.type === 'local') {
        if (bgAudio.paused) playCurrent(); else pauseCurrent();
    } else if (activeSource.type === 'youtube') {
        if (!ytPlayer || typeof ytPlayer.getPlayerState !== 'function') {
            ytPendingPlay = true;
            return;
        }
        const state = ytPlayer.getPlayerState();
        if (state === 1) { ytPlayer.pauseVideo(); } else { ytPlayer.playVideo(); }
    }
}

function playCurrent() {
    if (!activeSource) return;
    if (activeSource.type === 'local') {
        bgAudio.play().then(() => setPlayIcon(true)).catch((err) => {
            console.warn('[music] play() was rejected:', err);
            setPlayIcon(false);
        });
    } else if (activeSource.type === 'youtube' && ytPlayer) {
        ytPlayer.playVideo();
    }
}

function pauseCurrent() {
    if (!activeSource) return;
    if (activeSource.type === 'local') {
        bgAudio.pause();
        setPlayIcon(false);
    } else if (activeSource.type === 'youtube' && ytPlayer) {
        ytPlayer.pauseVideo();
    }
}

function stopLocal() {
    if (!bgAudio.paused) bgAudio.pause();
}

function setPlayIcon(isPlaying) {
    playPauseBtn.innerHTML = isPlaying ? '&#9208;' : '&#9654;';
    playPauseBtn.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
}

function step(direction, forcePlay) {
    if (!activeSource) return;

    if (activeSource.type === 'local') {
        const wasPlaying = forcePlay || !bgAudio.paused;
        if (direction < 0 && bgAudio.currentTime > 3) {
            bgAudio.currentTime = 0;
            return;
        }
        const nextIndex = pickNextIndex(currentTrackIndex, MUSIC_TRACKS.length, direction);
        if (nextIndex === currentTrackIndex) {
            bgAudio.currentTime = 0;
            if (wasPlaying) playCurrent();
            return;
        }
        loadLocal(nextIndex, wasPlaying);
    } else if (activeSource.type === 'youtube') {
        const ready = ytPlayer && typeof ytPlayer.getPlayerState === 'function';
        const wasPlaying = forcePlay || (ready && ytPlayer.getPlayerState() === 1);
        if (direction < 0 && ready && ytPlayer.getCurrentTime() > 3) {
            ytPlayer.seekTo(0, true);
            return;
        }
        const index = activeSource.listIndex ?? 0;
        const nextIndex = pickNextIndex(index, ytQueue.length, direction);
        if (nextIndex === index) {
            if (ready) {
                ytPlayer.seekTo(0, true);
                if (wasPlaying) ytPlayer.playVideo();
            }
            return;
        }
        loadYouTube(ytQueue[nextIndex].id, nextIndex, true);
    }
}

function pickNextIndex(current, length, direction) {
    if (length <= 1) return current;
    if (isShuffle) {
        let idx;
        do {
            idx = Math.floor(Math.random() * length);
        } while (idx === current);
        return idx;
    }
    return (current + direction + length) % length;
}

// --- Seeking / progress ---
function onSeekCommit() {
    const pct = Number(progressSlider.value);
    if (activeSource && activeSource.type === 'local' && bgAudio.duration) {
        bgAudio.currentTime = (pct / 100) * bgAudio.duration;
    } else if (activeSource && activeSource.type === 'youtube' && ytPlayer) {
        const duration = ytPlayer.getDuration();
        if (duration) ytPlayer.seekTo((pct / 100) * duration, true);
    }
    isSeeking = false;
}

function updateProgressFromLocal() {
    if (!activeSource || activeSource.type !== 'local' || isSeeking) return;
    const duration = bgAudio.duration || 0;
    const current = bgAudio.currentTime || 0;
    progressSlider.value = duration ? (current / duration) * 100 : 0;
    timeCurrentEl.textContent = formatTime(current);
    timeDurationEl.textContent = formatTime(duration);
}

function formatTime(seconds) {
    if (!isFinite(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
}

// ---------- YouTube IFrame Player API ----------
let ytPlayer = null;
let ytApiReadyPromise = null;

function ensureYouTubeReady() {
    if (ytApiReadyPromise) return ytApiReadyPromise;

    ytApiReadyPromise = new Promise((resolve) => {
        if (window.YT && window.YT.Player) {
            resolve();
            return;
        }
        const prevCallback = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
            if (prevCallback) prevCallback();
            resolve();
        };
        const script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(script);
    });

    return ytApiReadyPromise;
}

let ytPendingPlay = false;

function createYouTubePlayer(videoId, autoplay) {
    ytPlayer = new window.YT.Player(ytMount, {
        videoId,
        height: '1',
        width: '1',
        playerVars: { playsinline: 1, autoplay: autoplay ? 1 : 0 },
        events: {
            onReady: (e) => {
                e.target.setVolume(Number(volumeSlider.value) * 100);
                if (autoplay || ytPendingPlay) e.target.playVideo();
                ytPendingPlay = false;
            },
            onError: (e) => {
                const blocked = e.data === 101 || e.data === 150;
                nowPlayingSubtitle.textContent = blocked
                    ? "This video can't be played here (the owner blocked embedding). Try another version, e.g. add \"lyrics\" or \"audio\" to your search."
                    : "This video can't be played. Try another one.";
                setPlayIcon(false);
            },
            onStateChange: (e) => {
                setPlayIcon(e.data === 1);
                if (e.data === 1) startYouTubeProgressPolling();
                if (e.data === 0) {
                    if (isRepeatOne) {
                        ytPlayer.seekTo(0, true);
                        ytPlayer.playVideo();
                    } else {
                        step(1, true);
                    }
                }
            }
        }
    });
}

function startYouTubeProgressPolling() {
    clearInterval(progressTimer);
    progressTimer = setInterval(() => {
        if (!ytPlayer || !activeSource || activeSource.type !== 'youtube' || isSeeking) return;
        const duration = ytPlayer.getDuration ? ytPlayer.getDuration() : 0;
        const current = ytPlayer.getCurrentTime ? ytPlayer.getCurrentTime() : 0;
        progressSlider.value = duration ? (current / duration) * 100 : 0;
        timeCurrentEl.textContent = formatTime(current);
        timeDurationEl.textContent = formatTime(duration);
    }, 500);
}

function stopYouTube() {
    clearInterval(progressTimer);
    if (ytPlayer && ytPlayer.pauseVideo) ytPlayer.pauseVideo();
}

// ---------- Spotify embed (its own controls; we can't drive it) ----------
function embedSpotify(path) {
    spotifyMount.innerHTML =
        `<iframe src="https://open.spotify.com/embed/${path}?utm_source=generator" ` +
        'width="100%" height="152" style="border-radius:12px" ' +
        'allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" ' +
        'loading="lazy"></iframe>';
}

function hideSpotify() {
    spotifyMount.innerHTML = '';
}

// ---------- Unified "paste a link" box ----------
function extractYouTubeId(url) {
    const patterns = [
        /(?:youtube\.com\/watch\?v=)([\w-]+)/,
        /(?:youtu\.be\/)([\w-]+)/,
        /(?:youtube\.com\/live\/)([\w-]+)/,
        /(?:youtube\.com\/embed\/)([\w-]+)/
    ];
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    if (/^[\w-]{11}$/.test(url.trim())) return url.trim();
    return null;
}

function extractSpotifyEmbedPath(url) {
    const match = url.match(
        /open\.spotify\.com\/(?:intl-[a-z]{2}\/)?(track|playlist|album|artist|episode|show)\/([a-zA-Z0-9]+)/
    );
    return match ? `${match[1]}/${match[2]}` : null;
}

function loadFromPastedLink() {
    const raw = linkInput.value.trim();
    if (!raw) return;

    const videoId = extractYouTubeId(raw);
    if (videoId) {
        switchTab('youtube');
        ytQueue = [{ id: videoId }];
        loadYouTube(videoId, 0, true);
        return;
    }

    const spotifyPath = extractSpotifyEmbedPath(raw);
    if (spotifyPath) {
        switchTab('spotify');
        loadSpotify(spotifyPath);
        return;
    }

    alert('Could not recognize that as a YouTube or Spotify link.');
}

// ---------- Timer-Synced Music ----------
let musicContext = null;

function initTimerSyncedMusic() {
    window.addEventListener('pomodoro-timer-state', (e) => {
        syncMusicToTimerState(e.detail.mode, e.detail.isRunning);
    });
}

function syncMusicToTimerState(mode, isRunning) {
    const isBreak = mode === 'short' || mode === 'long';
    musicContext = isBreak && breakSource ? 'break' : 'focus';

    if (!isRunning) {
        pauseAllSources();
        prepareSource(musicContext === 'break' ? breakSource : focusSource, false);
        return;
    }

    prepareSource(musicContext === 'break' ? breakSource : focusSource, true);
}

function prepareSource(source, autoplay) {
    if (!source) return;

    if (source.type === 'local-break') {
        activeSource = { type: 'local' };
        if (loadedLocalSrc !== BREAK_TRACK.src) {
            bgAudio.src = BREAK_TRACK.src;
            loadedLocalSrc = BREAK_TRACK.src;
        }
        stopYouTube();
        hideSpotify();
        setNowPlaying({ title: BREAK_TRACK.name, subtitle: 'Break', sourceLabel: 'My Music', thumbnailUrl: null });
        showTransportBlock(true);
        if (autoplay) playCurrent();
        else bgAudio.pause();
    } else if (source.type === 'local') {
        loadLocal(source.trackIndex ?? currentTrackIndex, autoplay);
    } else if (source.type === 'youtube') {
        loadYouTube(source.id, source.listIndex, autoplay);
    } else if (source.type === 'spotify') {
        if (autoplay) loadSpotify(source.path, source.listIndex);
        else hideSpotify();
    }
}

function pauseAllSources() {
    if (!bgAudio.paused) {
        bgAudio.pause();
        setPlayIcon(false);
    }
    stopYouTube();
    hideSpotify();
}