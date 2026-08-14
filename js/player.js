/* =====================================================
   SUKOON STATION — js/player.js
   Music player + YouTube IFrame Player API integration.
   (Background rotation: themes.js. Sleep timer: timer.js.)
   ===================================================== */

(function () {
    "use strict";

    /* =====================================================
       1. CONFIG / CONSTANTS
       ===================================================== */

    const YT_API_SRC = "https://www.youtube.com/iframe_api";
    const YT_CONTAINER_ID = "youtube-player";

    const PROGRESS_UPDATE_INTERVAL = 250; // ms — single active loop while playing

    const FADE_OUT_DURATION = 30 * 1000; // ms — kept in sync with timer.js expectations
    const FADE_STEP_INTERVAL = 300; // ms

    const MAX_CONSECUTIVE_LOAD_ERRORS = 3; // guard against infinite skip loops

    // Songs.json is the intended long-term data source. This demo list is a
    // clearly-labeled fallback only, used when songs.json is unavailable —
    // it should be considered temporary scaffolding, not real content.
    const FALLBACK_PLAYLIST = [
        {
            id: "night-demo-01",
            title: "Untitled Night Track 1",
            artist: "Demo Artist",
            youtubeId: "PLACEHOLDER_YOUTUBE_ID_1",
            theme: "night",
            thumbnail: "assets/images/night/night-01.jpg",
        },
        {
            id: "night-demo-02",
            title: "Untitled Night Track 2",
            artist: "Demo Artist",
            youtubeId: "PLACEHOLDER_YOUTUBE_ID_2",
            theme: "night",
            thumbnail: "assets/images/night/night-02.jpg",
        },
        {
            id: "night-demo-03",
            title: "Untitled Night Track 3",
            artist: "Demo Artist",
            youtubeId: "PLACEHOLDER_YOUTUBE_ID_3",
            theme: "night",
            thumbnail: "assets/images/night/night-03.jpg",
        },
    ];

    /* =====================================================
       2. STATE
       ===================================================== */

    const state = {
        playlist: [],
        currentIndex: 0,
        isShuffle: false,
        activeTheme: "night",

        ytPlayer: null,
        isApiReady: false,
        isPlayerReady: false,
        pendingAutoplay: false,

        isMuted: false,
        volumeBeforeMute: 70,

        progressInterval: null,
        isSeeking: false,

        fadeInterval: null,
        consecutiveLoadErrors: 0,
    };

    /* =====================================================
       3. DOM REFERENCES
       ===================================================== */

    const elements = {};

    function cacheElements() {
        elements.player = document.getElementById("music-player");
        elements.trackArt = document.getElementById("track-art");
        elements.trackTitle = document.getElementById("track-title");
        elements.trackArtist = document.getElementById("track-artist");

        elements.previousBtn = document.getElementById("previous-btn");
        elements.playPauseBtn = document.getElementById("play-pause-btn");
        elements.nextBtn = document.getElementById("next-btn");
        elements.shuffleBtn = document.getElementById("shuffle-btn");

        elements.progressInput = document.getElementById("music-progress");
        elements.currentTime = document.getElementById("current-time");
        elements.totalTime = document.getElementById("total-time");

        elements.volumeControl = document.getElementById("volume-control");
        elements.muteBtn = document.getElementById("mute-btn");

        elements.listeningStatusText = document.getElementById("listening-status-text");
        elements.playerStatus = document.getElementById("player-status");
    }

    /* =====================================================
       4. TIME FORMATTING
       ===================================================== */

    function formatTime(totalSeconds) {
        if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
            return "00:00";
        }

        const safeSeconds = Math.floor(totalSeconds);
        const hours = Math.floor(safeSeconds / 3600);
        const minutes = Math.floor((safeSeconds % 3600) / 60);
        const seconds = safeSeconds % 60;

        const mm = String(minutes).padStart(2, "0");
        const ss = String(seconds).padStart(2, "0");

        if (hours > 0) {
            return `${String(hours).padStart(2, "0")}:${mm}:${ss}`;
        }

        return `${mm}:${ss}`;
    }

    /* =====================================================
       5. PLAYLIST LOADING (songs.json with graceful fallback)
       ===================================================== */

    async function loadPlaylist() {
        try {
            const response = await fetch("data/songs.json");
            if (!response.ok) throw new Error(`songs.json responded with ${response.status}`);

            const data = await response.json();
            if (Array.isArray(data) && data.length > 0) {
                state.playlist = data;
                return;
            }

            throw new Error("songs.json was empty or invalid.");
        } catch (err) {
            console.warn(
                "[Sukoon Station] Could not load data/songs.json — using fallback demo playlist.",
                err
            );
            state.playlist = FALLBACK_PLAYLIST;
        }
    }

    function getTracksForTheme(themeId) {
        return state.playlist.filter((track) => track.theme === themeId);
    }

    function getCurrentTrack() {
        return state.playlist[state.currentIndex] || null;
    }

    /* =====================================================
       6. YOUTUBE IFRAME API LOADING
       ===================================================== */

    function ensureYouTubeApiLoaded() {
        return new Promise((resolve) => {
            if (window.YT && window.YT.Player) {
                state.isApiReady = true;
                resolve();
                return;
            }

            // Avoid injecting the script tag more than once.
            const alreadyLoading = document.querySelector(`script[src="${YT_API_SRC}"]`);

            const previousCallback = window.onYouTubeIframeAPIReady;
            window.onYouTubeIframeAPIReady = () => {
                state.isApiReady = true;
                if (typeof previousCallback === "function") previousCallback();
                resolve();
            };

            if (!alreadyLoading) {
                const script = document.createElement("script");
                script.src = YT_API_SRC;
                script.async = true;
                script.onerror = () => {
                    console.error("[Sukoon Station] Failed to load the YouTube IFrame API.");
                    setStatus("error");
                };
                document.head.appendChild(script);
            }
        });
    }

    /**
     * Creates the hidden technical container the YouTube iframe mounts into.
     * The visible UI is always the existing glass player — this container
     * is never shown to the user.
     */
    function ensureYouTubeContainer() {
        let target = document.getElementById(YT_CONTAINER_ID);
        if (target) return target;

        const wrapper = document.createElement("div");
        wrapper.id = "youtube-player-host";
        wrapper.setAttribute("aria-hidden", "true");
        wrapper.style.position = "absolute";
        wrapper.style.width = "1px";
        wrapper.style.height = "1px";
        wrapper.style.overflow = "hidden";
        wrapper.style.opacity = "0";
        wrapper.style.pointerEvents = "none";

        target = document.createElement("div");
        target.id = YT_CONTAINER_ID;

        wrapper.appendChild(target);
        document.body.appendChild(wrapper);

        return target;
    }

    /* =====================================================
       7. PLAYER INITIALIZATION
       ===================================================== */

    let initPromise = null;

    /**
     * Lazily creates the YT.Player instance. Safe to call multiple times —
     * only initializes once. Intended to be triggered by the first Play
     * click, respecting browser autoplay restrictions.
     */
    function initializePlayer() {
        if (initPromise) return initPromise;

        const container = ensureYouTubeContainer();
        if (!container) {
            console.warn("[Sukoon Station] No YouTube container available — player cannot initialize.");
            return Promise.resolve(null);
        }

        initPromise = ensureYouTubeApiLoaded().then(() => {
            return new Promise((resolve) => {
                const track = getCurrentTrack();

                state.ytPlayer = new window.YT.Player(YT_CONTAINER_ID, {
                    height: "1",
                    width: "1",
                    videoId: track ? track.youtubeId : undefined,
                    playerVars: {
                        autoplay: 0,
                        controls: 0,
                        disablekb: 1,
                        modestbranding: 1,
                        rel: 0,
                        playsinline: 1,
                    },
                    events: {
                        onReady: (event) => {
                            state.isPlayerReady = true;
                            event.target.setVolume(getSliderVolume());
                            resolve(event.target);

                            if (state.pendingAutoplay) {
                                state.pendingAutoplay = false;
                                event.target.playVideo();
                            }
                        },
                        onStateChange: handlePlayerStateChange,
                        onError: handlePlayerError,
                    },
                });
            });
        });

        return initPromise;
    }

    /* =====================================================
       8. TRACK LOADING / UI SYNC
       ===================================================== */

    function updateTrackUI(track) {
        if (!track) return;

        if (elements.trackTitle) elements.trackTitle.textContent = track.title || "Untitled";
        if (elements.trackArtist) {
            elements.trackArtist.textContent = track.artist ? `${track.artist} · YouTube` : "YouTube";
        }

        if (elements.trackArt) {
            const currentTheme = window.SukoonThemes && window.SukoonThemes.getCurrentTheme
                ? window.SukoonThemes.getCurrentTheme()
                : null;
            const fallbackArt = currentTheme && currentTheme.images && currentTheme.images[0];

            elements.trackArt.src = track.thumbnail || fallbackArt || elements.trackArt.src;
        }

        resetProgressDisplay();
    }

    function loadTrack(index, { autoplay = false } = {}) {
        if (!state.playlist.length) return;

        const safeIndex = ((index % state.playlist.length) + state.playlist.length) % state.playlist.length;
        state.currentIndex = safeIndex;

        const track = getCurrentTrack();
        updateTrackUI(track);

        if (!track || !track.youtubeId) {
            console.warn("[Sukoon Station] Track is missing a youtubeId — skipping playback.", track);
            return;
        }

        if (!state.isPlayerReady || !state.ytPlayer) {
            state.pendingAutoplay = autoplay;
            initializePlayer();
            return;
        }

        try {
            if (autoplay) {
                state.ytPlayer.loadVideoById(track.youtubeId);
            } else {
                state.ytPlayer.cueVideoById(track.youtubeId);
            }
        } catch (err) {
            console.error("[Sukoon Station] Failed to load track into YouTube player:", err);
            handleLoadFailureRecovery();
        }
    }

    /* =====================================================
       9. PLAY / PAUSE
       ===================================================== */

    async function togglePlayPause() {
        if (!state.isPlayerReady || !state.ytPlayer) {
            state.pendingAutoplay = true;
            await initializePlayer();
            return;
        }

        const playerState = state.ytPlayer.getPlayerState();

        if (playerState === window.YT.PlayerState.PLAYING) {
            state.ytPlayer.pauseVideo();
        } else {
            state.ytPlayer.playVideo();
        }
    }

    function play() {
        if (!state.isPlayerReady || !state.ytPlayer) {
            state.pendingAutoplay = true;
            initializePlayer();
            return;
        }
        state.ytPlayer.playVideo();
    }

    function pause() {
        if (state.ytPlayer && state.isPlayerReady) {
            state.ytPlayer.pauseVideo();
        }
    }

    function isPlaying() {
        return Boolean(
            state.ytPlayer &&
                state.isPlayerReady &&
                state.ytPlayer.getPlayerState() === window.YT.PlayerState.PLAYING
        );
    }

    /* =====================================================
       10. NEXT / PREVIOUS / SHUFFLE
       ===================================================== */

    function getRandomIndex(excludeIndex) {
        if (state.playlist.length <= 1) return 0;

        let nextIndex = excludeIndex;
        while (nextIndex === excludeIndex) {
            nextIndex = Math.floor(Math.random() * state.playlist.length);
        }
        return nextIndex;
    }

    function goToNext({ autoplay = true } = {}) {
        if (!state.playlist.length) return;

        const nextIndex = state.isShuffle
            ? getRandomIndex(state.currentIndex)
            : (state.currentIndex + 1) % state.playlist.length;

        loadTrack(nextIndex, { autoplay });
    }

    function goToPrevious() {
        if (!state.playlist.length) return;

        const currentTime = state.isPlayerReady && state.ytPlayer ? state.ytPlayer.getCurrentTime() : 0;

        // Restart current track if meaningfully into playback.
        if (currentTime > 5) {
            if (state.ytPlayer) state.ytPlayer.seekTo(0, true);
            return;
        }

        const prevIndex = state.isShuffle
            ? getRandomIndex(state.currentIndex)
            : (state.currentIndex - 1 + state.playlist.length) % state.playlist.length;

        loadTrack(prevIndex, { autoplay: true });
    }

    function toggleShuffle() {
        state.isShuffle = !state.isShuffle;

        if (elements.shuffleBtn) {
            elements.shuffleBtn.setAttribute("aria-pressed", state.isShuffle ? "true" : "false");
        }
    }

    /* =====================================================
       11. PROGRESS (single active update loop)
       ===================================================== */

    function resetProgressDisplay() {
        if (elements.progressInput) elements.progressInput.value = 0;
        if (elements.currentTime) elements.currentTime.textContent = "00:00";
        if (elements.totalTime) elements.totalTime.textContent = "00:00";
    }

    function startProgressLoop() {
        stopProgressLoop();
        state.progressInterval = window.setInterval(updateProgressUI, PROGRESS_UPDATE_INTERVAL);
    }

    function stopProgressLoop() {
        if (state.progressInterval !== null) {
            clearInterval(state.progressInterval);
            state.progressInterval = null;
        }
    }

    function updateProgressUI() {
        if (state.isSeeking) return;
        if (!state.ytPlayer || !state.isPlayerReady) return;

        const duration = state.ytPlayer.getDuration();
        const current = state.ytPlayer.getCurrentTime();

        if (!Number.isFinite(duration) || duration <= 0) {
            resetProgressDisplay();
            return;
        }

        const percentage = Math.min(100, Math.max(0, (current / duration) * 100));

        if (elements.progressInput) elements.progressInput.value = percentage;
        if (elements.currentTime) elements.currentTime.textContent = formatTime(current);
        if (elements.totalTime) elements.totalTime.textContent = formatTime(duration);
    }

    function handleSeek() {
        if (!state.ytPlayer || !state.isPlayerReady || !elements.progressInput) {
            state.isSeeking = false;
            return;
        }

        const duration = state.ytPlayer.getDuration();
        if (!Number.isFinite(duration) || duration <= 0) {
            state.isSeeking = false;
            return;
        }

        const targetTime = (Number(elements.progressInput.value) / 100) * duration;
        state.ytPlayer.seekTo(targetTime, true);
        state.isSeeking = false;
    }

    /* =====================================================
       12. VOLUME / MUTE
       ===================================================== */

    function getSliderVolume() {
        return elements.volumeControl ? Number(elements.volumeControl.value) : 70;
    }

    function handleVolumeInput() {
        const value = getSliderVolume();

        if (state.ytPlayer && state.isPlayerReady) {
            state.ytPlayer.setVolume(value);
        }

        if (value > 0 && state.isMuted) {
            state.isMuted = false;
            updateMuteButtonUI();
        }
    }

    function toggleMute() {
        if (!state.ytPlayer || !state.isPlayerReady) return;

        if (state.isMuted) {
            state.ytPlayer.unMute();
            state.ytPlayer.setVolume(state.volumeBeforeMute);
            if (elements.volumeControl) elements.volumeControl.value = state.volumeBeforeMute;
            state.isMuted = false;
        } else {
            state.volumeBeforeMute = getSliderVolume();
            state.ytPlayer.mute();
            state.isMuted = true;
        }

        updateMuteButtonUI();
    }

    function updateMuteButtonUI() {
        if (!elements.muteBtn) return;

        elements.muteBtn.setAttribute("aria-pressed", state.isMuted ? "true" : "false");
        elements.muteBtn.setAttribute("aria-label", state.isMuted ? "Unmute" : "Mute");
        elements.muteBtn.setAttribute("title", state.isMuted ? "Unmute" : "Mute");
        elements.muteBtn.classList.toggle("is-muted", state.isMuted);
    }

    /* =====================================================
       13. STATUS / ACCESSIBILITY
       ===================================================== */

    function setStatus(status) {
        const labels = {
            playing: "Listening",
            paused: "Paused",
            loading: "Loading",
            error: "Unavailable",
        };

        const label = labels[status] || "Listening";

        if (elements.listeningStatusText) {
            elements.listeningStatusText.textContent = label;
        }

        if (elements.playerStatus) {
            elements.playerStatus.textContent = label;
        }

        if (elements.playPauseBtn) {
            const isNowPlaying = status === "playing";
            elements.playPauseBtn.setAttribute("aria-pressed", isNowPlaying ? "true" : "false");
            elements.playPauseBtn.setAttribute("aria-label", isNowPlaying ? "Pause" : "Play");
            elements.playPauseBtn.setAttribute("title", isNowPlaying ? "Pause" : "Play");
        }
    }

    /* =====================================================
       14. YOUTUBE PLAYER EVENTS
       ===================================================== */

    function handlePlayerStateChange(event) {
        const PlayerState = window.YT.PlayerState;

        switch (event.data) {
            case PlayerState.PLAYING:
                state.consecutiveLoadErrors = 0;
                setStatus("playing");
                startProgressLoop();
                break;

            case PlayerState.PAUSED:
                setStatus("paused");
                stopProgressLoop();
                break;

            case PlayerState.BUFFERING:
                setStatus("loading");
                break;

            case PlayerState.ENDED:
                stopProgressLoop();
                goToNext({ autoplay: true });
                break;

            case PlayerState.CUED:
            case PlayerState.UNSTARTED:
            default:
                // No status change needed for these transitional states.
                break;
        }
    }

    function handlePlayerError(event) {
        console.error("[Sukoon Station] YouTube player error:", event.data);
        setStatus("error");
        handleLoadFailureRecovery();
    }

    function handleLoadFailureRecovery() {
        state.consecutiveLoadErrors += 1;

        if (state.consecutiveLoadErrors >= MAX_CONSECUTIVE_LOAD_ERRORS || state.playlist.length <= 1) {
            console.warn("[Sukoon Station] Too many consecutive playback errors — stopping auto-skip.");
            setStatus("error");
            return;
        }

        goToNext({ autoplay: true });
    }

    /* =====================================================
       15. FADE OUT (owned here; triggered by timer.js)
       ===================================================== */

    function clearFadeInterval() {
        if (state.fadeInterval !== null) {
            clearInterval(state.fadeInterval);
            state.fadeInterval = null;
        }
    }

    function fadeOut() {
        return new Promise((resolve) => {
            if (!state.ytPlayer || !state.isPlayerReady) {
                resolve();
                return;
            }

            clearFadeInterval();

            const startVolume = state.ytPlayer.getVolume();
            if (!Number.isFinite(startVolume) || startVolume <= 0) {
                pause();
                resolve();
                return;
            }

            const totalSteps = Math.max(1, Math.round(FADE_OUT_DURATION / FADE_STEP_INTERVAL));
            const step = startVolume / totalSteps;
            let currentStep = 0;

            state.fadeInterval = window.setInterval(() => {
                currentStep += 1;
                const nextVolume = Math.max(0, startVolume - step * currentStep);
                state.ytPlayer.setVolume(nextVolume);

                if (currentStep >= totalSteps || nextVolume <= 0) {
                    clearFadeInterval();
                    pause();

                    // Restore the pre-fade volume level so a future Play
                    // click resumes at a comfortable, expected volume.
                    state.ytPlayer.setVolume(startVolume);
                    if (elements.volumeControl) elements.volumeControl.value = startVolume;

                    resolve();
                }
            }, FADE_STEP_INTERVAL);
        });
    }

    /* =====================================================
       16. THEME INTEGRATION (loosely coupled)
       ===================================================== */

    function handleBackgroundChanged(event) {
        const themeId = event && event.detail && event.detail.themeId;
        if (!themeId || themeId === state.activeTheme) return;

        state.activeTheme = themeId;
        // Intentionally does not force-switch tracks — Version 1.0 only
        // has Night content. This keeps the systems decoupled while still
        // giving the player theme awareness for future use.
    }

    /* =====================================================
       17. EVENT BINDING
       ===================================================== */

    function bindEvents() {
        if (elements.playPauseBtn) {
            elements.playPauseBtn.addEventListener("click", togglePlayPause);
        }

        if (elements.nextBtn) {
            elements.nextBtn.addEventListener("click", () => goToNext({ autoplay: true }));
        }

        if (elements.previousBtn) {
            elements.previousBtn.addEventListener("click", goToPrevious);
        }

        if (elements.shuffleBtn) {
            elements.shuffleBtn.addEventListener("click", toggleShuffle);
        }

        if (elements.progressInput) {
            elements.progressInput.addEventListener("input", () => {
                state.isSeeking = true;
            });
            elements.progressInput.addEventListener("change", handleSeek);
        }

        if (elements.volumeControl) {
            elements.volumeControl.addEventListener("input", handleVolumeInput);
        }

        if (elements.muteBtn) {
            elements.muteBtn.addEventListener("click", toggleMute);
        }

        document.addEventListener("backgroundChanged", handleBackgroundChanged);
    }

    /* =====================================================
       18. INITIALIZATION
       ===================================================== */

    async function initializePlayerModule() {
        cacheElements();

        if (!elements.player || !elements.playPauseBtn) {
            console.warn("[Sukoon Station] Music player elements not found — player.js cannot initialize.");
            return;
        }

        await loadPlaylist();
        bindEvents();

        if (state.playlist.length) {
            updateTrackUI(getCurrentTrack());
        }

        setStatus("paused");
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initializePlayerModule);
    } else {
        initializePlayerModule();
    }

    /* =====================================================
       19. PUBLIC API (used by timer.js and future scripts)
       ===================================================== */

    window.SukoonPlayer = {
        play,
        pause,
        setVolume(value) {
            const safeValue = Math.min(100, Math.max(0, Number(value)));
            if (elements.volumeControl) elements.volumeControl.value = safeValue;
            if (state.ytPlayer && state.isPlayerReady) {
                state.ytPlayer.setVolume(safeValue);
            }
        },
        getVolume() {
            if (state.ytPlayer && state.isPlayerReady) {
                return state.ytPlayer.getVolume();
            }
            return getSliderVolume();
        },
        isPlaying,
        fadeOut,
        getTracksForTheme,
    };
})();