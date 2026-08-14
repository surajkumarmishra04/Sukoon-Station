/**
 * ==========================================================================
 * SUKOON STATION — VERSION 1.0 (NIGHT MOOD)
 * Music Player & YouTube IFrame Integration System (js/player.js)
 * ==========================================================================
 */

(function (global) {
  'use strict';

  /* ==========================================================================
     1. CONSTANTS & FALLBACK PLAYLIST DATA
     ========================================================================== */

  const SONGS_JSON_PATH = 'data/songs.json';
  const PROGRESS_UPDATE_INTERVAL = 250; // Milliseconds between progress updates
  const DEFAULT_VOLUME = 80;
  const RESTART_THRESHOLD_SECONDS = 5; // Seconds after which Previous restarts track

  // Fallback demo tracks for Version 1.0 (Night / Raat Mood)
  const FALLBACK_PLAYLIST = [
    {
      id: 'night-01',
      title: 'Midnight Reverie',
      artist: 'Lofi Ambient · YouTube',
      youtubeId: 'jfKfPfyJRdk', // Ambient Lo-Fi Chill
      theme: 'night',
      thumbnail: 'assets/images/night/night-01.jpg'
    },
    {
      id: 'night-02',
      title: 'Quiet Constellations',
      artist: 'Deep Night Chill · YouTube',
      youtubeId: '5qap5aO4i9A', // Lofi Sleep / Chill
      theme: 'night',
      thumbnail: 'assets/images/night/night-02.jpg'
    },
    {
      id: 'night-03',
      title: 'Solitude & Starlight',
      artist: 'Peaceful Ambient · YouTube',
      youtubeId: 'DWcJFNfaw9c', // Ambient Piano / Night
      theme: 'night',
      thumbnail: 'assets/images/night/night-03.jpg'
    }
  ];

  /* ==========================================================================
     2. SVG ICONS (INLINE UI ASSETS)
     ========================================================================== */

  const ICONS = {
    play: '<svg class="icon-svg play-icon" viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>',
    pause: '<svg class="icon-svg pause-icon" viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16" rx="1"></rect><rect x="14" y="4" width="4" height="16" rx="1"></rect></svg>',
    volumeHigh: '<svg class="icon-svg volume-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>',
    volumeMute: '<svg class="icon-svg volume-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>'
  };

  /* ==========================================================================
     3. INTERNAL PLAYER STATE
     ========================================================================== */

  const state = {
    allTracks: [],
    themeTracks: [],
    currentTrackIndex: 0,
    currentTheme: 'night',
    isPlaying: false,
    isShuffle: false,
    isMuted: false,
    volume: DEFAULT_VOLUME,
    isSeeking: false,
    progressIntervalId: null,
    ytPlayer: null,
    isYtApiReady: false,
    isPlayerReady: false,
    hasInteracted: false,
    recentTrackIndices: [],
    errorRetryCount: 0
  };

  // DOM Elements Cache
  let dom = {
    playerContainer: null,
    trackArt: null,
    trackTitle: null,
    trackArtist: null,
    playPauseBtn: null,
    prevBtn: null,
    nextBtn: null,
    shuffleBtn: null,
    progressBar: null,
    currentTime: null,
    totalTime: null,
    volumeSlider: null,
    muteBtn: null,
    listeningStatus: null,
    playerStatusAnnouncer: null,
    ytContainer: null
  };

  /* ==========================================================================
     4. DOM CACHING & MOUNT INITIALIZATION
     ========================================================================== */

  function cacheDomElements() {
    dom.playerContainer = document.getElementById('music-player');
    dom.trackArt = document.getElementById('track-art');
    dom.trackTitle = document.getElementById('track-title');
    dom.trackArtist = document.getElementById('track-artist');
    dom.playPauseBtn = document.getElementById('play-pause-btn');
    dom.prevBtn = document.getElementById('previous-btn');
    dom.nextBtn = document.getElementById('next-btn');
    dom.shuffleBtn = document.getElementById('shuffle-btn');
    dom.progressBar = document.getElementById('music-progress');
    dom.currentTime = document.getElementById('current-time');
    dom.totalTime = document.getElementById('total-time');
    dom.volumeSlider = document.getElementById('volume-control');
    dom.muteBtn = document.getElementById('mute-btn');
    dom.listeningStatus = document.getElementById('listening-status');
    dom.playerStatusAnnouncer = document.getElementById('player-status');

    ensureYouTubeMount();
  }

  /**
   * Ensures an unobtrusive, accessible container exists for the official YT IFrame Player API.
   */
  function ensureYouTubeMount() {
    let container = document.getElementById('youtube-player-mount');
    if (!container) {
      container = document.createElement('div');
      container.id = 'youtube-player-mount';
      container.setAttribute('aria-hidden', 'true');
      // Position off-canvas/minimized to allow custom Apple-glass UI to remain dominant
      Object.assign(container.style, {
        position: 'fixed',
        bottom: '0',
        left: '0',
        width: '1px',
        height: '1px',
        opacity: '0.01',
        pointerEvents: 'none',
        zIndex: '-1',
        overflow: 'hidden'
      });
      document.body.appendChild(container);
    }
    dom.ytContainer = container;
  }

  /* ==========================================================================
     5. YOUTUBE IFRAME API LOADER
     ========================================================================== */

  /**
   * Safely loads the official YouTube IFrame Player API without duplicate scripts.
   */
  function loadYouTubeIframeApi() {
    if (window.YT && window.YT.Player) {
      onYouTubeApiReady();
      return;
    }

    // Set up global callback hook required by YouTube API
    const existingCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = function () {
      if (typeof existingCallback === 'function') {
        existingCallback();
      }
      onYouTubeApiReady();
    };

    // Check if script tag is already being fetched
    const existingScript = document.querySelector('script[src*="youtube.com/iframe_api"]');
    if (!existingScript) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.async = true;
      const firstScript = document.getElementsByTagName('script')[0];
      if (firstScript && firstScript.parentNode) {
        firstScript.parentNode.insertBefore(tag, firstScript);
      } else {
        document.head.appendChild(tag);
      }
    }
  }

  function onYouTubeApiReady() {
    state.isYtApiReady = true;
    initializeYouTubePlayer();
  }

  /**
   * Instantiates the official YT.Player instance.
   */
  function initializeYouTubePlayer() {
    if (!state.isYtApiReady || state.ytPlayer || !dom.ytContainer) return;

    const currentTrack = getCurrentTrack();
    const videoId = currentTrack ? currentTrack.youtubeId : '';

    try {
      state.ytPlayer = new window.YT.Player('youtube-player-mount', {
        height: '100%',
        width: '100%',
        videoId: videoId,
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          rel: 0,
          modestbranding: 1,
          iv_load_policy: 3,
          playsinline: 1,
          enablejsapi: 1,
          origin: window.location.origin
        },
        events: {
          onReady: onPlayerReady,
          onStateChange: onPlayerStateChange,
          onError: onPlayerError
        }
      });
    } catch (err) {
      console.warn('[Sukoon Player] Error initializing YouTube player:', err);
    }
  }

  function onPlayerReady() {
    state.isPlayerReady = true;

    // Apply default volume
    if (state.ytPlayer && typeof state.ytPlayer.setVolume === 'function') {
      state.ytPlayer.setVolume(state.volume);
    }

    // If user attempted playback before player finished initializing, start now
    if (state.isPlaying) {
      playCurrentTrack();
    }
  }

  function onPlayerStateChange(event) {
    if (!window.YT) return;

    switch (event.data) {
      case window.YT.PlayerState.PLAYING:
        state.isPlaying = true;
        state.errorRetryCount = 0;
        updatePlayPauseButtonUI(true);
        updateStatusDisplay('Listening');
        announceStatus('Music playing');
        startProgressTracking();
        break;

      case window.YT.PlayerState.PAUSED:
        state.isPlaying = false;
        updatePlayPauseButtonUI(false);
        updateStatusDisplay('Paused');
        announceStatus('Music paused');
        stopProgressTracking();
        break;

      case window.YT.PlayerState.BUFFERING:
        updateStatusDisplay('Loading');
        break;

      case window.YT.PlayerState.ENDED:
        stopProgressTracking();
        handleTrackEnded();
        break;

      case window.YT.PlayerState.CUED:
        updateStatusDisplay('Paused');
        break;

      default:
        break;
    }
  }

  function onPlayerError(event) {
    console.warn(`[Sukoon Player] YouTube playback error (Code: ${event.data}).`);
    updateStatusDisplay('Loading');

    // Attempt recovery by skipping track safely without infinite loops
    state.errorRetryCount++;
    if (state.errorRetryCount <= 3 && state.themeTracks.length > 1) {
      setTimeout(() => {
        nextTrack();
      }, 800);
    } else {
      state.isPlaying = false;
      updatePlayPauseButtonUI(false);
      updateStatusDisplay('Paused');
    }
  }

  /* ==========================================================================
     6. TRACK DATA & PLAYLIST MANAGEMENT
     ========================================================================== */

  /**
   * Fetches song data from songs.json with fallback support.
   */
  async function loadSongsData() {
    try {
      const response = await fetch(SONGS_JSON_PATH);
      if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
      const data = await response.json();

      if (Array.isArray(data) && data.length > 0) {
        state.allTracks = data;
      } else if (data && Array.isArray(data.songs) && data.songs.length > 0) {
        state.allTracks = data.songs;
      } else {
        state.allTracks = FALLBACK_PLAYLIST;
      }
    } catch (err) {
      // Graceful fallback to embedded night tracks
      state.allTracks = FALLBACK_PLAYLIST;
    } finally {
      filterTracksByTheme(state.currentTheme);
      updateTrackMetadataUI();
    }
  }

  /**
   * Filters playlist for the selected mood.
   */
  function filterTracksByTheme(themeId) {
    state.currentTheme = themeId;
    const filtered = state.allTracks.filter((t) => t.theme === themeId);

    state.themeTracks = filtered.length > 0 ? filtered : state.allTracks;
    state.currentTrackIndex = 0;
    state.recentTrackIndices = [0];
  }

  function getCurrentTrack() {
    if (!state.themeTracks.length) return null;
    return state.themeTracks[state.currentTrackIndex] || state.themeTracks[0];
  }

  /**
   * Updates track artwork, title, and artist in the glass player UI.
   */
  function updateTrackMetadataUI() {
    const track = getCurrentTrack();
    if (!track) return;

    if (dom.trackTitle) dom.trackTitle.textContent = track.title || 'Untitled';
    if (dom.trackArtist) dom.trackArtist.textContent = track.artist || 'YouTube';

    if (dom.trackArt) {
      const thumb = track.thumbnail || 'assets/images/night/night-01.jpg';
      dom.trackArt.src = thumb;
      dom.trackArt.alt = `${track.title} artwork`;
    }

    if (dom.currentTime) dom.currentTime.textContent = '00:00';
    if (dom.totalTime) dom.totalTime.textContent = '00:00';
    if (dom.progressBar) dom.progressBar.value = '0';
  }

  /* ==========================================================================
     7. PLAYBACK CONTROLS
     ========================================================================== */

  /**
   * Primary play/pause toggle action.
   */
  function togglePlayPause() {
    state.hasInteracted = true;

    if (!state.isPlayerReady || !state.ytPlayer) {
      state.isPlaying = true;
      updatePlayPauseButtonUI(true);
      updateStatusDisplay('Loading');
      loadYouTubeIframeApi();
      return;
    }

    if (state.isPlaying) {
      pauseTrack();
    } else {
      playCurrentTrack();
    }
  }

  function playCurrentTrack() {
    if (!state.ytPlayer || typeof state.ytPlayer.playVideo !== 'function') {
      state.isPlaying = true;
      updatePlayPauseButtonUI(true);
      return;
    }

    const currentTrack = getCurrentTrack();
    if (!currentTrack) return;

    try {
      // Check if current loaded video matches selected track
      const currentUrl = state.ytPlayer.getVideoUrl ? state.ytPlayer.getVideoUrl() : '';
      if (!currentUrl || !currentUrl.includes(currentTrack.youtubeId)) {
        state.ytPlayer.loadVideoById(currentTrack.youtubeId);
      } else {
        state.ytPlayer.playVideo();
      }
      state.isPlaying = true;
      updatePlayPauseButtonUI(true);
    } catch (err) {
      console.warn('[Sukoon Player] Play execution deferred:', err);
    }
  }

  function pauseTrack() {
    if (!state.ytPlayer || typeof state.ytPlayer.pauseVideo !== 'function') return;

    try {
      state.ytPlayer.pauseVideo();
      state.isPlaying = false;
      updatePlayPauseButtonUI(false);
    } catch (err) {
      console.warn('[Sukoon Player] Pause execution error:', err);
    }
  }

  /**
   * Advances to next track, obeying shuffle settings.
   */
  function nextTrack() {
    if (!state.themeTracks.length) return;

    let nextIndex;
    if (state.isShuffle && state.themeTracks.length > 1) {
      do {
        nextIndex = Math.floor(Math.random() * state.themeTracks.length);
      } while (nextIndex === state.currentTrackIndex);
    } else {
      nextIndex = (state.currentTrackIndex + 1) % state.themeTracks.length;
    }

    loadAndPlayTrackAtIndex(nextIndex);
  }

  /**
   * Moves to previous track or restarts current track if elapsed > threshold.
   */
  function previousTrack() {
    if (!state.themeTracks.length) return;

    // If current song has played for more than 5s, restart it
    if (state.ytPlayer && typeof state.ytPlayer.getCurrentTime === 'function') {
      const elapsed = state.ytPlayer.getCurrentTime();
      if (elapsed > RESTART_THRESHOLD_SECONDS) {
        state.ytPlayer.seekTo(0, true);
        return;
      }
    }

    const prevIndex = (state.currentTrackIndex - 1 + state.themeTracks.length) % state.themeTracks.length;
    loadAndPlayTrackAtIndex(prevIndex);
  }

  function handleTrackEnded() {
    nextTrack();
  }

  function loadAndPlayTrackAtIndex(index) {
    state.currentTrackIndex = index;
    updateTrackMetadataUI();

    const track = getCurrentTrack();
    if (!track) return;

    if (state.ytPlayer && typeof state.ytPlayer.loadVideoById === 'function') {
      state.ytPlayer.loadVideoById(track.youtubeId);
      state.isPlaying = true;
      updatePlayPauseButtonUI(true);
    } else {
      togglePlayPause();
    }
  }

  function toggleShuffle() {
    state.isShuffle = !state.isShuffle;

    if (dom.shuffleBtn) {
      dom.shuffleBtn.setAttribute('aria-pressed', String(state.isShuffle));
      if (state.isShuffle) {
        dom.shuffleBtn.classList.add('active');
      } else {
        dom.shuffleBtn.classList.remove('active');
      }
    }
  }

  /* ==========================================================================
     8. VOLUME & MUTING
     ========================================================================== */

  function setVolume(val) {
    const safeVolume = Math.min(Math.max(parseInt(val, 10) || 0, 0), 100);
    state.volume = safeVolume;

    if (dom.volumeSlider) {
      dom.volumeSlider.value = safeVolume;
    }

    if (state.ytPlayer && typeof state.ytPlayer.setVolume === 'function') {
      state.ytPlayer.setVolume(safeVolume);
      if (safeVolume > 0 && state.isMuted) {
        unmute();
      }
    }
  }

  function getVolume() {
    if (state.ytPlayer && typeof state.ytPlayer.getVolume === 'function') {
      return state.ytPlayer.getVolume();
    }
    return state.volume;
  }

  function toggleMute() {
    if (state.isMuted) {
      unmute();
    } else {
      mute();
    }
  }

  function mute() {
    state.isMuted = true;
    if (state.ytPlayer && typeof state.ytPlayer.mute === 'function') {
      state.ytPlayer.mute();
    }
    if (dom.muteBtn) {
      dom.muteBtn.innerHTML = ICONS.volumeMute;
      dom.muteBtn.setAttribute('aria-label', 'Unmute');
      dom.muteBtn.setAttribute('title', 'Unmute');
    }
  }

  function unmute() {
    state.isMuted = false;
    if (state.ytPlayer && typeof state.ytPlayer.unMute === 'function') {
      state.ytPlayer.unMute();
    }
    if (dom.muteBtn) {
      dom.muteBtn.innerHTML = ICONS.volumeHigh;
      dom.muteBtn.setAttribute('aria-label', 'Mute');
      dom.muteBtn.setAttribute('title', 'Mute');
    }
  }

  /* ==========================================================================
     9. PROGRESS & SEEKING
     ========================================================================== */

  function startProgressTracking() {
    stopProgressTracking();
    state.progressIntervalId = setInterval(updateProgressTick, PROGRESS_UPDATE_INTERVAL);
  }

  function stopProgressTracking() {
    if (state.progressIntervalId) {
      clearInterval(state.progressIntervalId);
      state.progressIntervalId = null;
    }
  }

  function updateProgressTick() {
    if (!state.ytPlayer || !state.isPlaying || state.isSeeking) return;

    if (typeof state.ytPlayer.getCurrentTime !== 'function' || typeof state.ytPlayer.getDuration !== 'function') return;

    const currentSec = state.ytPlayer.getCurrentTime() || 0;
    const durationSec = state.ytPlayer.getDuration() || 0;

    if (dom.currentTime) dom.currentTime.textContent = formatDuration(currentSec);
    if (dom.totalTime) dom.totalTime.textContent = formatDuration(durationSec);

    if (dom.progressBar && durationSec > 0) {
      const percentage = (currentSec / durationSec) * 100;
      dom.progressBar.value = percentage.toFixed(2);
    }
  }

  function handleSeekInput(e) {
    state.isSeeking = true;
    if (!state.ytPlayer || typeof state.ytPlayer.getDuration !== 'function') return;

    const durationSec = state.ytPlayer.getDuration() || 0;
    const targetPercent = parseFloat(e.target.value) || 0;
    const targetSec = (targetPercent / 100) * durationSec;

    if (dom.currentTime) {
      dom.currentTime.textContent = formatDuration(targetSec);
    }
  }

  function handleSeekChange(e) {
    if (!state.ytPlayer || typeof state.ytPlayer.seekTo !== 'function') {
      state.isSeeking = false;
      return;
    }

    const durationSec = state.ytPlayer.getDuration() || 0;
    const targetPercent = parseFloat(e.target.value) || 0;
    const targetSec = (targetPercent / 100) * durationSec;

    state.ytPlayer.seekTo(targetSec, true);
    state.isSeeking = false;
  }

  function formatDuration(totalSeconds) {
    if (!totalSeconds || isNaN(totalSeconds) || totalSeconds < 0) return '00:00';

    const safeSec = Math.floor(totalSeconds);
    const hours = Math.floor(safeSec / 3600);
    const minutes = Math.floor((safeSec % 3600) / 60);
    const seconds = safeSec % 60;

    const pad = (n) => String(n).padStart(2, '0');

    if (hours > 0) {
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}`;
  }

  /* ==========================================================================
     10. UI UPDATERS & ACCESSIBILITY
     ========================================================================== */

  function updatePlayPauseButtonUI(isPlaying) {
    if (!dom.playPauseBtn) return;

    dom.playPauseBtn.innerHTML = isPlaying ? ICONS.pause : ICONS.play;
    const label = isPlaying ? 'Pause' : 'Play';
    dom.playPauseBtn.setAttribute('aria-label', label);
    dom.playPauseBtn.setAttribute('title', label);
  }

  function updateStatusDisplay(statusText) {
    if (!dom.listeningStatus) return;
    dom.listeningStatus.textContent = `● ${statusText}`;
  }

  function announceStatus(message) {
    if (!dom.playerStatusAnnouncer) return;
    dom.playerStatusAnnouncer.textContent = message;
  }

  /* ==========================================================================
     11. FADE-OUT SUPPORT (SLEEP TIMER INTEGRATION)
     ========================================================================== */

  /**
   * Smoothly fades out music volume over a specified duration before pausing.
   * @param {number} durationSeconds
   */
  function fadeOut(durationSeconds = 30) {
    const startVolume = getVolume();
    if (startVolume <= 0 || !state.isPlaying) {
      pauseTrack();
      return;
    }

    const intervalStep = 500;
    const totalSteps = (durationSeconds * 1000) / intervalStep;
    const volumeDecrement = startVolume / totalSteps;
    let currentStep = 0;

    const fadeTimer = setInterval(() => {
      currentStep++;
      const nextVol = Math.max(0, startVolume - volumeDecrement * currentStep);
      setVolume(nextVol);

      if (nextVol <= 0 || currentStep >= totalSteps) {
        clearInterval(fadeTimer);
        pauseTrack();
        // Restore volume baseline for subsequent sessions
        setTimeout(() => setVolume(startVolume), 600);
      }
    }, intervalStep);
  }

  /* ==========================================================================
     12. EVENT LISTENERS
     ========================================================================== */

  function setupEventListeners() {
    if (dom.playPauseBtn) {
      dom.playPauseBtn.addEventListener('click', togglePlayPause);
    }

    if (dom.nextBtn) {
      dom.nextBtn.addEventListener('click', nextTrack);
    }

    if (dom.prevBtn) {
      dom.prevBtn.addEventListener('click', previousTrack);
    }

    if (dom.shuffleBtn) {
      dom.shuffleBtn.addEventListener('click', toggleShuffle);
    }

    if (dom.muteBtn) {
      dom.muteBtn.addEventListener('click', toggleMute);
    }

    if (dom.volumeSlider) {
      dom.volumeSlider.addEventListener('input', (e) => {
        setVolume(e.target.value);
      });
    }

    if (dom.progressBar) {
      dom.progressBar.addEventListener('input', handleSeekInput);
      dom.progressBar.addEventListener('change', handleSeekChange);
    }

    // Listen to theme changes from themes.js via decoupled event
    document.addEventListener('backgroundChanged', (e) => {
      if (e.detail && e.detail.themeId && e.detail.themeId !== state.currentTheme) {
        filterTracksByTheme(e.detail.themeId);
        updateTrackMetadataUI();
        if (state.isPlaying) {
          playCurrentTrack();
        }
      }
    });
  }

  /* ==========================================================================
     13. INITIALIZATION & PUBLIC API EXPORT
     ========================================================================== */

  function initializePlayer() {
    cacheDomElements();
    setupEventListeners();
    loadSongsData();
    // Prepare API script in background for zero-latency first click
    loadYouTubeIframeApi();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePlayer);
  } else {
    initializePlayer();
  }

  // Public API Export for js/timer.js and external orchestration
  const SukoonPlayer = {
    initializePlayer,
    play: playCurrentTrack,
    pause: pauseTrack,
    togglePlay: togglePlayPause,
    next: nextTrack,
    previous: previousTrack,
    setVolume,
    getVolume,
    mute,
    unmute,
    toggleMute,
    toggleShuffle,
    fadeOut,
    isPlaying: () => state.isPlaying,
    getCurrentTrack,
    filterByTheme: (themeId) => {
      filterTracksByTheme(themeId);
      updateTrackMetadataUI();
    },
    getState: () => ({ ...state })
  };

  global.SukoonPlayer = SukoonPlayer;

})(typeof window !== 'undefined' ? window : this);