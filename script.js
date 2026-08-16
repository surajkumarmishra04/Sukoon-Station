// ==================================================
// 1. ADD / UPDATE OG PLAYLISTS HERE
// ==================================================
// TO ADD A NEW PLAYLIST:
// 1. REMOVE /* and */ FROM A TEMPLATE BELOW
// 2. CHANGE THE youtubePlaylistId TO YOUR YOUTUBE PLAYLIST ID
// 3. CHANGE THE background IMAGE PATH IF NEEDED
// 4. SAVE THIS FILE
//
// DO NOT EDIT THE HTML TO ADD PLAYLISTS!

const playlists = [
    {
        id: "morning-music",
        name: "Morning Music",
        youtubePlaylistId: "PLcVfz1-_0rj9vXeX44TFldWTWpHo7Esiv",
        background: "assets/images/morning.jpg",
        description: "Peaceful music for a fresh morning."
    },
    {
        id: "old-songs",
        name: "Old Songs",
        youtubePlaylistId: "PLcVfz1-_0rj9vXeX44TFldWTWpHo7Esiv",
        background: "assets/images/morning.jpg",
        description: "Classic old songs and timeless melodies."
    }

    /*
    {
        id: "gym",
        name: "Gym",
        youtubePlaylistId: "YOUR_PLAYLIST_ID_HERE",
        background: "assets/images/workout.jpg",
        description: "High-energy music for workout sessions."
    },
    */

    /*
    {
        id: "night",
        name: "Night",
        youtubePlaylistId: "YOUR_PLAYLIST_ID_HERE",
        background: "assets/images/night.jpg",
        description: "Calm and ambient tunes for deep night relaxation."
    },
    */

    /*
    {
        id: "study",
        name: "Study",
        youtubePlaylistId: "YOUR_PLAYLIST_ID_HERE",
        background: "assets/images/study.jpg",
        description: "Lofi and focus beats to enhance concentration."
    },
    */

    /*
    {
        id: "safar",
        name: "Safar",
        youtubePlaylistId: "YOUR_PLAYLIST_ID_HERE",
        background: "assets/images/safar.jpg",
        description: "Cinematic road trip and journey melodies."
    },
    */

    /*
    {
        id: "workout",
        name: "Workout",
        youtubePlaylistId: "YOUR_PLAYLIST_ID_HERE",
        background: "assets/images/workout.jpg",
        description: "Rhythmic beats to power through workouts."
    },
    */

    /*
    {
        id: "my-new-playlist",
        name: "My New Playlist",
        youtubePlaylistId: "YOUR_PLAYLIST_ID_HERE",
        background: "assets/images/morning.jpg",
        description: "My custom playlist description."
    }
    */
];

// ==================================================
// 2. CONFIGURATION & STATE
// ==================================================
const STATE = {
    currentPlaylist: playlists[0] || null,
    isPlaying: false,
    playerReady: false,
    ytPlayer: null,
    progressInterval: null,
    sleepTimerId: null,
    sleepRemainingSeconds: 0,
    isSeeking: false
};

const DEFAULT_BG = "assets/images/morning.jpg";

// ==================================================
// 3. DOM ELEMENTS
// ==================================================
const DOM = {
    bgImage: document.getElementById("bg-image"),
    liveClock: document.getElementById("live-clock"),
    
    // OG Playlist Button & Panel
    ogPlaylistBtn: document.getElementById("og-playlist-btn"),
    playlistPanel: document.getElementById("playlist-panel"),
    playlistList: document.getElementById("playlist-list"),

    // About Button & Panel
    aboutBtn: document.getElementById("about-btn"),
    aboutPanel: document.getElementById("about-panel"),

    // Sleep Timer Button & Panel
    sleepTimerBtn: document.getElementById("sleep-timer-btn"),
    timerPanel: document.getElementById("timer-panel"),
    sleepCountdown: document.getElementById("sleep-countdown"),
    timerSelectBtns: document.querySelectorAll(".timer-select-btn"),

    // Music Player Elements
    trackArtImg: document.getElementById("track-art-img"),
    trackTitle: document.getElementById("track-title"),
    trackArtist: document.getElementById("track-artist"),
    playPauseBtn: document.getElementById("play-pause-btn"),
    playIcon: document.getElementById("play-icon"),
    prevBtn: document.getElementById("previous-btn"),
    nextBtn: document.getElementById("next-btn"),
    musicProgress: document.getElementById("music-progress"),
    currentTime: document.getElementById("current-time"),
    totalTime: document.getElementById("total-time"),

    // All Panel Close Buttons
    closeBtns: document.querySelectorAll(".close-btn")
};

// ==================================================
// 4. ICONS (SVG)
// ==================================================
const ICONS = {
    play: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`,
    pause: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`
};

// ==================================================
// 5. LIVE CLOCK (12-HOUR WITH AM/PM)
// ==================================================
function updateLiveClock() {
    if (!DOM.liveClock) return;
    const now = new Date();
    let hours = now.getHours();
    const minutes = now.getMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";

    hours = hours % 12;
    hours = hours ? hours : 12; // 0 is rendered as 12
    const minutesFormatted = minutes < 10 ? `0${minutes}` : minutes;

    DOM.liveClock.textContent = `${hours}:${minutesFormatted} ${ampm}`;
}

function initClock() {
    updateLiveClock();
    setInterval(updateLiveClock, 1000);
}

// ==================================================
// 6. BACKGROUND HANDLING
// ==================================================
function setBackground(imageSrc) {
    if (!DOM.bgImage) return;

    const img = new Image();
    img.src = imageSrc;

    img.onload = () => {
        DOM.bgImage.style.opacity = "0";
        setTimeout(() => {
            DOM.bgImage.src = imageSrc;
            DOM.bgImage.style.opacity = "1";
        }, 200);
    };

    img.onerror = () => {
        console.warn(`[Sukoon Station] Image failed to load: ${imageSrc}. Using fallback.`);
        DOM.bgImage.src = DEFAULT_BG;
        DOM.bgImage.style.opacity = "1";
    };
}

// ==================================================
// 7. PLAYLIST GENERATION
// ==================================================
function generatePlaylists() {
    if (!DOM.playlistList) return;
    DOM.playlistList.innerHTML = "";

    playlists.forEach((playlist, index) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "playlist-item";
        if (STATE.currentPlaylist && STATE.currentPlaylist.id === playlist.id) {
            item.classList.add("active");
        }
        item.setAttribute("data-playlist-id", playlist.id);

        item.innerHTML = `
            <img class="playlist-item-art" src="${playlist.background}" alt="${playlist.name}" onerror="this.src='${DEFAULT_BG}'">
            <div class="playlist-item-info">
                <span class="playlist-item-title">${playlist.name}</span>
                <span class="playlist-item-desc">${playlist.description}</span>
            </div>
        `;

        item.addEventListener("click", () => {
            selectPlaylist(playlist.id, true);
            closeAllPanels();
        });

        DOM.playlistList.appendChild(item);
    });
}

// ==================================================
// 8. PLAYLIST SELECTION
// ==================================================
function selectPlaylist(playlistId, autoPlay = false) {
    const selected = playlists.find(p => p.id === playlistId);
    if (!selected) {
        console.warn(`[Sukoon Station] Playlist ${playlistId} not found.`);
        return;
    }

    STATE.currentPlaylist = selected;

    // Update active highlight on buttons
    const items = document.querySelectorAll(".playlist-item");
    items.forEach(el => {
        if (el.getAttribute("data-playlist-id") === playlistId) {
            el.classList.add("active");
        } else {
            el.classList.remove("active");
        }
    });

    // Update background image
    setBackground(selected.background);

    // Update artwork preview
    if (DOM.trackArtImg) {
        DOM.trackArtImg.src = selected.background;
    }

    // Update Track info placeholder
    if (DOM.trackTitle) DOM.trackTitle.textContent = selected.name;
    if (DOM.trackArtist) DOM.trackArtist.textContent = "YouTube Music";

    // Load into YouTube Player
    if (STATE.playerReady && STATE.ytPlayer) {
        if (selected.youtubePlaylistId && selected.youtubePlaylistId !== "YOUR_PLAYLIST_ID_HERE") {
            try {
                if (autoPlay) {
                    STATE.ytPlayer.loadPlaylist({
                        list: selected.youtubePlaylistId,
                        listType: "playlist",
                        index: 0,
                        suggestedQuality: "small"
                    });
                } else {
                    STATE.ytPlayer.cuePlaylist({
                        list: selected.youtubePlaylistId,
                        listType: "playlist",
                        index: 0,
                        suggestedQuality: "small"
                    });
                }
            } catch (err) {
                console.error("[Sukoon Station] Error loading playlist into YouTube player:", err);
            }
        } else {
            console.warn(`[Sukoon Station] Playlist "${selected.name}" has placeholder YouTube Playlist ID.`);
            resetPlaybackUI();
        }
    }
}

// ==================================================
// 9. YOUTUBE IFRAME API
// ==================================================
function loadYouTubeAPI() {
    if (window.YT && window.YT.Player) {
        onYouTubeIframeAPIReady();
        return;
    }

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    tag.onerror = () => {
        console.warn("[Sukoon Station] Failed to load YouTube IFrame API.");
    };
    const firstScriptTag = document.getElementsByTagName("script")[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
}

window.onYouTubeIframeAPIReady = function () {
    try {
        STATE.ytPlayer = new YT.Player("youtube-player", {
            height: "1",
            width: "1",
            playerVars: {
                playsinline: 1,
                controls: 0,
                disablekb: 1,
                fs: 0,
                rel: 0,
                origin: window.location.origin
            },
            events: {
                onReady: onPlayerReady,
                onStateChange: onPlayerStateChange,
                onError: onPlayerError
            }
        });
    } catch (err) {
        console.error("[Sukoon Station] YouTube Player init exception:", err);
    }
};

function onPlayerReady(event) {
    STATE.playerReady = true;
    if (STATE.currentPlaylist) {
        selectPlaylist(STATE.currentPlaylist.id, false);
    }
}

function onPlayerStateChange(event) {
    // YT.PlayerState: UNSTARTED (-1), ENDED (0), PLAYING (1), PAUSED (2), BUFFERING (3), CUED (5)
    if (event.data === YT.PlayerState.PLAYING) {
        STATE.isPlaying = true;
        setPlayIcon(true);
        startProgressTracking();
        updateTrackMetadata();
    } else if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) {
        STATE.isPlaying = false;
        setPlayIcon(false);
        stopProgressTracking();
    } else if (event.data === YT.PlayerState.CUED) {
        STATE.isPlaying = false;
        setPlayIcon(false);
        stopProgressTracking();
        updateTrackMetadata();
    }
}

function onPlayerError(event) {
    console.warn("[Sukoon Station] YouTube Player error code:", event.data);
}

// ==================================================
// 10. MUSIC PLAYER CONTROLS & METADATA
// ==================================================
function setPlayIcon(isPlaying) {
    if (DOM.playIcon) {
        DOM.playIcon.innerHTML = isPlaying ? ICONS.pause : ICONS.play;
    }
    if (DOM.playPauseBtn) {
        DOM.playPauseBtn.setAttribute("aria-label", isPlaying ? "Pause" : "Play");
        DOM.playPauseBtn.setAttribute("title", isPlaying ? "Pause" : "Play");
    }
}

function togglePlayPause() {
    if (!STATE.playerReady || !STATE.ytPlayer) return;

    try {
        if (STATE.isPlaying) {
            STATE.ytPlayer.pauseVideo();
        } else {
            STATE.ytPlayer.playVideo();
        }
    } catch (err) {
        console.error("[Sukoon Station] Play/Pause action failed:", err);
    }
}

function playNextTrack() {
    if (!STATE.playerReady || !STATE.ytPlayer) return;
    try {
        STATE.ytPlayer.nextVideo();
    } catch (err) {
        console.error("[Sukoon Station] Next action failed:", err);
    }
}

function playPreviousTrack() {
    if (!STATE.playerReady || !STATE.ytPlayer) return;
    try {
        STATE.ytPlayer.previousVideo();
    } catch (err) {
        console.error("[Sukoon Station] Previous action failed:", err);
    }
}

function updateTrackMetadata() {
    if (!STATE.playerReady || !STATE.ytPlayer) return;

    try {
        const videoData = STATE.ytPlayer.getVideoData();
        if (videoData && videoData.title) {
            if (DOM.trackTitle) DOM.trackTitle.textContent = videoData.title;
            if (DOM.trackArtist) DOM.trackArtist.textContent = videoData.author || "YouTube Music";

            if (videoData.video_id && DOM.trackArtImg) {
                const thumbUrl = `https://img.youtube.com/vi/${videoData.video_id}/mqdefault.jpg`;
                DOM.trackArtImg.src = thumbUrl;
            }
        } else {
            if (DOM.trackTitle && STATE.currentPlaylist) DOM.trackTitle.textContent = STATE.currentPlaylist.name;
            if (DOM.trackArtist) DOM.trackArtist.textContent = "YouTube Music";
            if (DOM.trackArtImg && STATE.currentPlaylist) DOM.trackArtImg.src = STATE.currentPlaylist.background;
        }
    } catch (err) {
        if (DOM.trackTitle && STATE.currentPlaylist) DOM.trackTitle.textContent = STATE.currentPlaylist.name;
        if (DOM.trackArtist) DOM.trackArtist.textContent = "YouTube Music";
    }
}

function resetPlaybackUI() {
    STATE.isPlaying = false;
    setPlayIcon(false);
    stopProgressTracking();
    if (DOM.musicProgress) DOM.musicProgress.value = 0;
    if (DOM.currentTime) DOM.currentTime.textContent = "00:00";
    if (DOM.totalTime) DOM.totalTime.textContent = "00:00";
}

// ==================================================
// 11. PROGRESS & SEEKING
// ==================================================
function formatTime(seconds) {
    if (isNaN(seconds) || seconds === null || !isFinite(seconds)) {
        return "00:00";
    }
    const totalSec = Math.floor(seconds);
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;

    const formattedMins = mins < 10 ? `0${mins}` : mins;
    const formattedSecs = secs < 10 ? `0${secs}` : secs;

    if (hrs > 0) {
        return `${hrs}:${formattedMins}:${formattedSecs}`;
    }
    return `${formattedMins}:${formattedSecs}`;
}

function updateProgress() {
    if (!STATE.playerReady || !STATE.ytPlayer || STATE.isSeeking) return;

    try {
        const currentTime = STATE.ytPlayer.getCurrentTime() || 0;
        const duration = STATE.ytPlayer.getDuration() || 0;

        if (DOM.currentTime) DOM.currentTime.textContent = formatTime(currentTime);
        if (DOM.totalTime) DOM.totalTime.textContent = formatTime(duration);

        if (duration > 0 && DOM.musicProgress) {
            const percent = (currentTime / duration) * 100;
            DOM.musicProgress.value = percent;
        }
    } catch (err) {
        // Ignored
    }
}

function startProgressTracking() {
    stopProgressTracking();
    STATE.progressInterval = setInterval(updateProgress, 500);
}

function stopProgressTracking() {
    if (STATE.progressInterval) {
        clearInterval(STATE.progressInterval);
        STATE.progressInterval = null;
    }
}

function handleProgressInput() {
    STATE.isSeeking = true;
}

function handleProgressChange() {
    if (!STATE.playerReady || !STATE.ytPlayer || !DOM.musicProgress) {
        STATE.isSeeking = false;
        return;
    }

    try {
        const duration = STATE.ytPlayer.getDuration() || 0;
        const seekToSeconds = (DOM.musicProgress.value / 100) * duration;
        STATE.ytPlayer.seekTo(seekToSeconds, true);
    } catch (err) {
        console.error("[Sukoon Station] Seek error:", err);
    }

    STATE.isSeeking = false;
}

// ==================================================
// 12. SLEEP TIMER
// ==================================================
function formatCountdown(seconds) {
    if (seconds <= 0) return "Off";
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const formattedMins = mins < 10 ? `0${mins}` : mins;
    const formattedSecs = secs < 10 ? `0${secs}` : secs;

    if (hrs > 0) {
        return `${hrs}:${formattedMins}:${formattedSecs}`;
    }
    return `${formattedMins}:${formattedSecs}`;
}

function setSleepTimer(minutes) {
    clearSleepTimer();

    if (minutes <= 0) {
        return;
    }

    STATE.sleepRemainingSeconds = Math.floor(minutes * 60);
    updateSleepTimerUI();

    STATE.sleepTimerId = setInterval(() => {
        STATE.sleepRemainingSeconds--;

        if (STATE.sleepRemainingSeconds <= 0) {
            triggerSleepTimerComplete();
        } else {
            updateSleepTimerUI();
        }
    }, 1000);
}

function clearSleepTimer() {
    if (STATE.sleepTimerId) {
        clearInterval(STATE.sleepTimerId);
        STATE.sleepTimerId = null;
    }
    STATE.sleepRemainingSeconds = 0;
    updateSleepTimerUI();

    DOM.timerSelectBtns.forEach(btn => {
        if (btn.getAttribute("data-time") === "0") {
            btn.classList.add("active");
        } else {
            btn.classList.remove("active");
        }
    });
}

function updateSleepTimerUI() {
    const formatted = formatCountdown(STATE.sleepRemainingSeconds);

    if (DOM.sleepCountdown) {
        DOM.sleepCountdown.textContent = formatted;
    }

    if (DOM.sleepTimerBtn) {
        if (STATE.sleepRemainingSeconds > 0) {
            DOM.sleepTimerBtn.textContent = `Sleep ${formatted}`;
        } else {
            DOM.sleepTimerBtn.textContent = "Sleep Timer";
        }
    }
}

function triggerSleepTimerComplete() {
    clearSleepTimer();

    if (STATE.playerReady && STATE.ytPlayer && STATE.isPlaying) {
        try {
            STATE.ytPlayer.pauseVideo();
        } catch (err) {
            console.error("[Sukoon Station] Failed to pause on timer completion:", err);
        }
    }
}

function handleTimerOptionClick(event) {
    const btn = event.currentTarget;
    const timeVal = btn.getAttribute("data-time");

    DOM.timerSelectBtns.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    if (timeVal === "0") {
        clearSleepTimer();
    } else if (timeVal === "custom") {
        const input = prompt("Enter sleep timer duration in minutes:", "45");
        if (input !== null) {
            const minutes = parseFloat(input);
            if (!isNaN(minutes) && minutes > 0) {
                setSleepTimer(minutes);
            } else {
                alert("Please enter a valid positive number for minutes.");
                clearSleepTimer();
            }
        } else {
            clearSleepTimer();
        }
    } else {
        const minutes = parseFloat(timeVal);
        if (!isNaN(minutes)) {
            setSleepTimer(minutes);
        }
    }
}

// ==================================================
// 13. PANELS & MODALS
// ==================================================
function isPanelOpen(panel) {
    return panel && (!panel.hasAttribute("hidden") || panel.classList.contains("open"));
}

function closeAllPanels() {
    const panels = [
        { panel: DOM.playlistPanel, btn: DOM.ogPlaylistBtn },
        { panel: DOM.aboutPanel, btn: DOM.aboutBtn },
        { panel: DOM.timerPanel, btn: DOM.sleepTimerBtn }
    ];

    panels.forEach(({ panel, btn }) => {
        if (panel) {
            panel.classList.remove("open");
            panel.setAttribute("hidden", "");
        }
        if (btn) {
            btn.setAttribute("aria-expanded", "false");
        }
    });
}

function togglePanel(panel, triggerBtn) {
    if (!panel) return;
    const currentlyOpen = isPanelOpen(panel);

    closeAllPanels();

    if (!currentlyOpen) {
        panel.removeAttribute("hidden");
        // Reflow for transition
        void panel.offsetWidth;
        panel.classList.add("open");
        if (triggerBtn) triggerBtn.setAttribute("aria-expanded", "true");
    }
}

// ==================================================
// 14. ACCESSIBILITY & GLOBAL EVENTS
// ==================================================
function setupEventListeners() {
    // OG Playlist Button
    if (DOM.ogPlaylistBtn) {
        DOM.ogPlaylistBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            togglePanel(DOM.playlistPanel, DOM.ogPlaylistBtn);
        });
    }

    // About Button
    if (DOM.aboutBtn) {
        DOM.aboutBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            togglePanel(DOM.aboutPanel, DOM.aboutBtn);
        });
    }

    // Sleep Timer Button
    if (DOM.sleepTimerBtn) {
        DOM.sleepTimerBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            togglePanel(DOM.timerPanel, DOM.sleepTimerBtn);
        });
    }

    // Close Buttons inside Panels
    DOM.closeBtns.forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            closeAllPanels();
        });
    });

    // Timer Option Selection Buttons
    DOM.timerSelectBtns.forEach(btn => {
        btn.addEventListener("click", handleTimerOptionClick);
    });

    // Music Player Buttons
    if (DOM.playPauseBtn) {
        DOM.playPauseBtn.addEventListener("click", togglePlayPause);
    }
    if (DOM.prevBtn) {
        DOM.prevBtn.addEventListener("click", playPreviousTrack);
    }
    if (DOM.nextBtn) {
        DOM.nextBtn.addEventListener("click", playNextTrack);
    }

    // Progress Bar
    if (DOM.musicProgress) {
        DOM.musicProgress.addEventListener("input", handleProgressInput);
        DOM.musicProgress.addEventListener("change", handleProgressChange);
    }

    // Escape Key closes all open panels
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            closeAllPanels();
        }
    });

    // Click outside open panel closes it
    document.addEventListener("click", (e) => {
        const isClickInsidePanel = (
            (DOM.playlistPanel && DOM.playlistPanel.contains(e.target)) ||
            (DOM.aboutPanel && DOM.aboutPanel.contains(e.target)) ||
            (DOM.timerPanel && DOM.timerPanel.contains(e.target))
        );

        const isTriggerClick = (
            (DOM.ogPlaylistBtn && DOM.ogPlaylistBtn.contains(e.target)) ||
            (DOM.aboutBtn && DOM.aboutBtn.contains(e.target)) ||
            (DOM.sleepTimerBtn && DOM.sleepTimerBtn.contains(e.target))
        );

        if (!isClickInsidePanel && !isTriggerClick) {
            closeAllPanels();
        }
    });
}

// ==================================================
// 15. INITIALIZATION
// ==================================================
document.addEventListener("DOMContentLoaded", () => {
    // 1. Initialize clock
    initClock();

    // 2. Set default initial SVG play icon
    setPlayIcon(false);

    // 3. Render dynamic playlist cards
    generatePlaylists();

    // 4. Set initial default background and track UI
    if (STATE.currentPlaylist) {
        setBackground(STATE.currentPlaylist.background);
        if (DOM.trackArtImg) DOM.trackArtImg.src = STATE.currentPlaylist.background;
        if (DOM.trackTitle) DOM.trackTitle.textContent = STATE.currentPlaylist.name;
    }

    // 5. Attach all event listeners
    setupEventListeners();

    // 6. Load official YouTube API (Will NOT autoplay with sound)
    loadYouTubeAPI();
});