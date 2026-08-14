/**
 * ==========================================================================
 * SUKOON STATION — VERSION 1.0 (NIGHT MOOD)
 * Sleep Timer Management System (js/timer.js)
 * ==========================================================================
 */

(function (global) {
  'use strict';

  /* ==========================================================================
     1. CONSTANTS & CONFIGURATION
     ========================================================================== */

  const DEFAULT_FADE_DURATION = 30; // Seconds over which volume fades down
  const FADE_INTERVAL_STEP = 500; // Step frequency for volume reduction (ms)
  const RESET_DELAY_AFTER_COMPLETION = 6000; // Time before resetting UI post-completion

  // Map data-time values (in minutes) to seconds
  const PRESET_DURATIONS = {
    '0': 0,
    '30': 30 * 60,
    '50': 50 * 60,
    '60': 60 * 60,
    '120': 120 * 60
  };

  /* ==========================================================================
     2. INTERNAL STATE
     ========================================================================== */

  const state = {
    timerIntervalId: null,
    fadeIntervalId: null,
    timerEndTime: null,
    selectedDurationSec: 0,
    isTimerRunning: false,
    isFading: false,
    initialVolumeBeforeFade: 80
  };

  // Cached DOM References
  let dom = {
    toggleBtn: null,
    panel: null,
    closeBtn: null,
    countdownDisplay: null,
    optionButtons: []
  };

  /* ==========================================================================
     3. DOM CACHING & SETUP
     ========================================================================== */

  function cacheDomElements() {
    dom.toggleBtn = document.getElementById('sleep-timer-toggle');
    dom.panel = document.getElementById('sleep-timer-panel');
    dom.closeBtn = document.getElementById('sleep-timer-close');
    dom.countdownDisplay = document.getElementById('sleep-countdown');
    dom.optionButtons = dom.panel
      ? Array.from(dom.panel.querySelectorAll('.timer-option-btn'))
      : [];
  }

  /* ==========================================================================
     4. TIME FORMATTING UTILITIES
     ========================================================================== */

  /**
   * Formats remaining seconds into HH:MM:SS or MM:SS strings.
   * @param {number} totalSeconds
   * @returns {string}
   */
  function formatTimeDisplay(totalSeconds) {
    const safeSeconds = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const seconds = safeSeconds % 60;

    const pad = (num) => String(num).padStart(2, '0');

    if (hours > 0) {
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}`;
  }

  /* ==========================================================================
     5. PANEL VISIBILITY & ACCESSIBILITY MANAGEMENT
     ========================================================================== */

  /**
   * Opens the Sleep Timer panel with proper ARIA attributes.
   */
  function openPanel() {
    if (!dom.panel) return;

    dom.panel.removeAttribute('hidden');
    dom.panel.classList.remove('is-closing');

    if (dom.toggleBtn) {
      dom.toggleBtn.setAttribute('aria-expanded', 'true');
    }
  }

  /**
   * Closes the Sleep Timer panel cleanly.
   */
  function closePanel() {
    if (!dom.panel || dom.panel.hasAttribute('hidden')) return;

    dom.panel.classList.add('is-closing');

    setTimeout(() => {
      dom.panel.setAttribute('hidden', '');
      dom.panel.classList.remove('is-closing');
      if (dom.toggleBtn) {
        dom.toggleBtn.setAttribute('aria-expanded', 'false');
      }
    }, 200); // Matches panel close CSS transition duration
  }

  /**
   * Toggles panel visibility.
   */
  function togglePanel() {
    if (!dom.panel) return;
    const isHidden = dom.panel.hasAttribute('hidden');
    if (isHidden) {
      openPanel();
    } else {
      closePanel();
    }
  }

  /* ==========================================================================
     6. TIMER LOGIC & COUNTDOWN ENGINE
     ========================================================================== */

  /**
   * Starts a countdown timer for a given duration in seconds.
   * @param {number} durationSeconds - Total duration to run.
   */
  function startTimer(durationSeconds) {
    // Validate inputs
    const duration = parseInt(durationSeconds, 10);
    if (isNaN(duration) || duration <= 0) {
      cancelTimer();
      return;
    }

    // Clear any active timers and active fade processes
    clearActiveIntervals();

    state.selectedDurationSec = duration;
    state.timerEndTime = Date.now() + duration * 1000;
    state.isTimerRunning = true;

    // Apply active pulsing style to countdown
    if (dom.countdownDisplay) {
      dom.countdownDisplay.classList.add('is-running');
    }

    // Perform immediate UI tick
    updateTimerTick();

    // Start precision interval loop
    state.timerIntervalId = setInterval(updateTimerTick, 1000);
  }

  /**
   * Called every second to evaluate remaining time against timestamp.
   */
  function updateTimerTick() {
    if (!state.isTimerRunning || !state.timerEndTime) return;

    const remainingMs = state.timerEndTime - Date.now();
    const remainingSeconds = Math.ceil(remainingMs / 1000);

    if (remainingSeconds <= 0) {
      onTimerComplete();
      return;
    }

    const formattedTime = formatTimeDisplay(remainingSeconds);

    // Update panel countdown
    if (dom.countdownDisplay) {
      dom.countdownDisplay.textContent = formattedTime;
    }

    // Update bottom-right toggle button label subtly
    if (dom.toggleBtn) {
      dom.toggleBtn.textContent = `◷ ${formattedTime}`;
    }
  }

  /**
   * Cancels and resets the Sleep Timer completely without stopping music.
   */
  function cancelTimer() {
    clearActiveIntervals();

    state.isTimerRunning = false;
    state.timerEndTime = null;
    state.selectedDurationSec = 0;

    // Reset UI displays
    if (dom.countdownDisplay) {
      dom.countdownDisplay.textContent = 'Off';
      dom.countdownDisplay.classList.remove('is-running');
    }

    if (dom.toggleBtn) {
      dom.toggleBtn.textContent = 'Sleep Timer';
    }

    updateActiveButtonUI('0');
  }

  /**
   * Clears all running timer intervals safely.
   */
  function clearActiveIntervals() {
    if (state.timerIntervalId) {
      clearInterval(state.timerIntervalId);
      state.timerIntervalId = null;
    }
    if (state.fadeIntervalId) {
      clearInterval(state.fadeIntervalId);
      state.fadeIntervalId = null;
    }
    state.isFading = false;
  }

  /* ==========================================================================
     7. TIMER COMPLETION & MUSIC FADE-OUT
     ========================================================================== */

  /**
   * Executes when countdown reaches zero: initiates audio fade-out and resets UI.
   */
  function onTimerComplete() {
    clearActiveIntervals();
    state.isTimerRunning = false;

    // Display peaceful completion message
    if (dom.countdownDisplay) {
      dom.countdownDisplay.textContent = 'Good night';
      dom.countdownDisplay.classList.remove('is-running');
    }

    if (dom.toggleBtn) {
      dom.toggleBtn.textContent = '◷ Complete';
    }

    // Gracefully fade out music
    fadeOutMusic(DEFAULT_FADE_DURATION);

    // Reset button and status after delay
    setTimeout(() => {
      cancelTimer();
    }, RESET_DELAY_AFTER_COMPLETION);
  }

  /**
   * Gradually attenuates music volume to 0 before pausing playback.
   * @param {number} fadeDurationSeconds - Total seconds to fade volume down.
   */
  function fadeOutMusic(fadeDurationSeconds = 30) {
    const player = global.SukoonPlayer;

    // Graceful fallback if player is unavailable or inactive
    if (!player || typeof player.setVolume !== 'function' || typeof player.getVolume !== 'function') {
      if (player && typeof player.pause === 'function') {
        player.pause();
      }
      return;
    }

    const currentVolume = player.getVolume();
    state.initialVolumeBeforeFade = currentVolume > 0 ? currentVolume : 80;

    if (currentVolume <= 0) {
      if (typeof player.pause === 'function') player.pause();
      return;
    }

    state.isFading = true;
    const totalSteps = (fadeDurationSeconds * 1000) / FADE_INTERVAL_STEP;
    const volumeDecrementPerStep = currentVolume / totalSteps;
    let stepCount = 0;

    state.fadeIntervalId = setInterval(() => {
      stepCount++;
      const nextVolume = Math.max(0, currentVolume - (volumeDecrementPerStep * stepCount));

      player.setVolume(nextVolume);

      if (nextVolume <= 0 || stepCount >= totalSteps) {
        clearInterval(state.fadeIntervalId);
        state.fadeIntervalId = null;
        state.isFading = false;

        // Pause playback
        if (typeof player.pause === 'function') {
          player.pause();
        }

        // Restore original volume setting for subsequent user plays
        setTimeout(() => {
          player.setVolume(state.initialVolumeBeforeFade);
        }, 500);
      }
    }, FADE_INTERVAL_STEP);
  }

  /* ==========================================================================
     8. CUSTOM DURATION PROMPT / HANDLER
     ========================================================================== */

  /**
   * Prompts user safely for custom minutes or sets duration directly.
   * @param {number|null} customMinutes
   */
  function handleCustomDuration(customMinutes = null) {
    let minutes = customMinutes;

    if (minutes === null) {
      const input = prompt('Enter sleep timer duration in minutes (1 - 1440):', '45');
      if (input === null) return; // User cancelled prompt
      minutes = parseInt(input.trim(), 10);
    }

    if (isNaN(minutes) || minutes < 1 || minutes > 1440) {
      alert('Please enter a valid duration between 1 minute and 24 hours (1440 minutes).');
      return;
    }

    const durationSeconds = minutes * 60;
    updateActiveButtonUI('custom');
    startTimer(durationSeconds);
  }

  /* ==========================================================================
     9. UI BUTTON SELECTION & EVENT DELEGATION
     ========================================================================== */

  /**
   * Updates visual active highlight on the option buttons.
   * @param {string} selectedKey
   */
  function updateActiveButtonUI(selectedKey) {
    if (!dom.optionButtons.length) return;

    dom.optionButtons.forEach((btn) => {
      const timeAttr = btn.getAttribute('data-time');
      if (timeAttr === String(selectedKey)) {
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
      } else {
        btn.classList.remove('active');
        btn.setAttribute('aria-pressed', 'false');
      }
    });
  }

  /**
   * Attaches event listeners for panel toggling, button selections, and dismissal.
   */
  function setupEventListeners() {
    // Toggle button click
    if (dom.toggleBtn) {
      dom.toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePanel();
      });
    }

    // Close button click
    if (dom.closeBtn) {
      dom.closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closePanel();
      });
    }

    // Timer option selections via delegation inside panel
    if (dom.panel) {
      dom.panel.addEventListener('click', (e) => {
        const optionBtn = e.target.closest('.timer-option-btn');
        if (!optionBtn) return;

        const timeValue = optionBtn.getAttribute('data-time');

        if (timeValue === 'custom') {
          handleCustomDuration();
          return;
        }

        if (timeValue === '0') {
          cancelTimer();
          return;
        }

        const durationSeconds = PRESET_DURATIONS[timeValue];
        if (durationSeconds !== undefined) {
          updateActiveButtonUI(timeValue);
          startTimer(durationSeconds);
        }
      });

      // Prevent clicks inside panel from bubbling to global window dismisser
      dom.panel.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }

    // Escape key listener to close panel
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && dom.panel && !dom.panel.hasAttribute('hidden')) {
        closePanel();
      }
    });

    // Click outside panel to close
    document.addEventListener('click', (e) => {
      if (
        dom.panel &&
        !dom.panel.hasAttribute('hidden') &&
        !dom.panel.contains(e.target) &&
        e.target !== dom.toggleBtn
      ) {
        closePanel();
      }
    });
  }

  /* ==========================================================================
     10. INITIALIZATION & PUBLIC API
     ========================================================================== */

  /**
   * Initializes DOM bindings and listeners.
   */
  function initializeTimer() {
    cacheDomElements();
    setupEventListeners();
  }

  // Automatic bootstrap on DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeTimer);
  } else {
    initializeTimer();
  }

  // Public API Export
  const SukoonTimer = {
    initializeTimer,
    startTimer,
    cancelTimer,
    setCustomDuration: handleCustomDuration,
    openPanel,
    closePanel,
    togglePanel,
    fadeOutMusic,
    getState: () => ({ ...state })
  };

  global.SukoonTimer = SukoonTimer;

})(typeof window !== 'undefined' ? window : this);