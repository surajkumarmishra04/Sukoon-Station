/* =====================================================
   SUKOON STATION — js/timer.js
   Sleep Timer ONLY — countdown, panel, and music fade-out hook.
   (Background rotation lives in themes.js — never touched here.)
   ===================================================== */

(function () {
    "use strict";

    /* =====================================================
       1. CONFIG / CONSTANTS
       ===================================================== */

    // Duration presets in seconds, keyed by the button's data-timer value.
    const DURATIONS = {
        30: 30 * 60,
        50: 50 * 60,
        60: 60 * 60,
        120: 120 * 60,
    };

    const CUSTOM_MIN_MINUTES = 1;
    const CUSTOM_MAX_MINUTES = 24 * 60; // 24 hours

    const FADE_OUT_DURATION = 30 * 1000; // 30 seconds, gentle fade
    const FADE_STEP_INTERVAL = 300; // ms between volume steps

    const COMPLETE_MESSAGE_DURATION = 4000; // how long "Good night" stays up

    const PANEL_OPEN_ANIM_DURATION = 300; // matches animations.css panel-open
    const PANEL_CLOSE_ANIM_DURATION = 200; // matches animations.css panel-close

    /* =====================================================
       2. STATE
       ===================================================== */

    const state = {
        timerInterval: null,
        timerEndTime: null,
        selectedDuration: null, // seconds
        isTimerRunning: false,
        isPanelOpen: false,
        activeOptionValue: "off",
        fadeInterval: null,
        completeResetTimeout: null,
    };

    /* =====================================================
       3. DOM REFERENCES
       ===================================================== */

    const elements = {};

    function cacheElements() {
        elements.toggle = document.getElementById("sleep-timer-toggle");
        elements.panel = document.getElementById("sleep-timer-panel");
        elements.closeBtn = document.getElementById("sleep-timer-panel-close");
        elements.countdown = document.getElementById("sleep-countdown");
        elements.options = elements.panel
            ? Array.from(elements.panel.querySelectorAll(".timer-option"))
            : [];
    }

    /* =====================================================
       4. TIME FORMATTING
       ===================================================== */

    function formatTime(totalSeconds) {
        const safeSeconds = Math.max(0, Math.floor(totalSeconds));
        const hours = Math.floor(safeSeconds / 3600);
        const minutes = Math.floor((safeSeconds % 3600) / 60);
        const seconds = safeSeconds % 60;

        const mm = String(minutes).padStart(2, "0");
        const ss = String(seconds).padStart(2, "0");

        if (hours > 0) {
            const hh = String(hours).padStart(2, "0");
            return `${hh}:${mm}:${ss}`;
        }

        return `${mm}:${ss}`;
    }

    /* =====================================================
       5. UI UPDATES
       ===================================================== */

    function updateCountdownDisplay(text) {
        if (elements.countdown) {
            elements.countdown.textContent = text;
        }
    }

    function updateToggleLabel(remainingSeconds) {
        if (!elements.toggle) return;

        if (remainingSeconds === null) {
            elements.toggle.textContent = "Sleep Timer";
            return;
        }

        elements.toggle.textContent = `\u25F7 ${formatTime(remainingSeconds)}`;
    }

    function setActiveOption(value) {
        state.activeOptionValue = value;

        elements.options.forEach((btn) => {
            const isActive = btn.dataset.timer === value;
            btn.classList.toggle("is-active", isActive);
            btn.setAttribute("aria-pressed", isActive ? "true" : "false");
        });
    }

    /* =====================================================
       6. MUSIC FADE-OUT INTERFACE
       ===================================================== */

    /**
     * Attempts to gently fade out and stop the music via a decoupled
     * player interface (window.SukoonPlayer), if one is available.
     * Never throws — safe to call even if player.js hasn't loaded.
     */
    function fadeOutMusic() {
        return new Promise((resolve) => {
            const player = window.SukoonPlayer;

            if (!player || typeof player.setVolume !== "function" || typeof player.getVolume !== "function") {
                console.warn("[Sukoon Station] SukoonPlayer API not available — skipping fade-out.");
                resolve();
                return;
            }

            const startVolume = Number(player.getVolume());
            const safeStartVolume = Number.isFinite(startVolume) ? startVolume : 0;

            if (safeStartVolume <= 0) {
                stopPlayerSafely(player);
                resolve();
                return;
            }

            const totalSteps = Math.max(1, Math.round(FADE_OUT_DURATION / FADE_STEP_INTERVAL));
            const volumeStep = safeStartVolume / totalSteps;
            let currentStep = 0;

            clearFadeInterval();

            state.fadeInterval = window.setInterval(() => {
                currentStep += 1;
                const nextVolume = Math.max(0, safeStartVolume - volumeStep * currentStep);

                try {
                    player.setVolume(nextVolume);
                } catch (err) {
                    console.warn("[Sukoon Station] Error while fading player volume:", err);
                }

                if (currentStep >= totalSteps || nextVolume <= 0) {
                    clearFadeInterval();
                    stopPlayerSafely(player);
                    resolve();
                }
            }, FADE_STEP_INTERVAL);
        });
    }

    function stopPlayerSafely(player) {
        if (player && typeof player.pause === "function") {
            try {
                player.pause();
            } catch (err) {
                console.warn("[Sukoon Station] Error while pausing player:", err);
            }
        }
    }

    function clearFadeInterval() {
        if (state.fadeInterval !== null) {
            clearInterval(state.fadeInterval);
            state.fadeInterval = null;
        }
    }

    /* =====================================================
       7. COUNTDOWN ENGINE (single active interval)
       ===================================================== */

    function clearTimerInterval() {
        if (state.timerInterval !== null) {
            clearInterval(state.timerInterval);
            state.timerInterval = null;
        }
    }

    function clearCompleteResetTimeout() {
        if (state.completeResetTimeout !== null) {
            clearTimeout(state.completeResetTimeout);
            state.completeResetTimeout = null;
        }
    }

    function tick() {
        const remainingMs = state.timerEndTime - Date.now();
        const remainingSeconds = Math.max(0, Math.round(remainingMs / 1000));

        if (remainingSeconds <= 0) {
            handleTimerComplete();
            return;
        }

        updateCountdownDisplay(formatTime(remainingSeconds));
        updateToggleLabel(remainingSeconds);
    }

    /**
     * Starts (or restarts) the Sleep Timer for the given duration.
     * Always cancels any previously running timer first, guaranteeing
     * only one active countdown at a time.
     */
    function startTimer(durationSeconds, optionValue) {
        if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
            console.warn("[Sukoon Station] Invalid sleep timer duration:", durationSeconds);
            return;
        }

        clearTimerInterval();
        clearCompleteResetTimeout();
        clearFadeInterval();

        state.timerEndTime = Date.now() + durationSeconds * 1000;
        state.selectedDuration = durationSeconds;
        state.isTimerRunning = true;

        setActiveOption(optionValue);
        tick(); // immediate update so the UI doesn't wait a full second
        state.timerInterval = window.setInterval(tick, 1000);
    }

    /**
     * Cancels the Sleep Timer without affecting music playback.
     */
    function stopTimer() {
        clearTimerInterval();
        clearCompleteResetTimeout();
        clearFadeInterval();

        state.timerEndTime = null;
        state.selectedDuration = null;
        state.isTimerRunning = false;

        setActiveOption("off");
        updateCountdownDisplay("Off");
        updateToggleLabel(null);
    }

    async function handleTimerComplete() {
        clearTimerInterval();

        state.isTimerRunning = false;
        updateCountdownDisplay("Good night");
        updateToggleLabel(null);

        await fadeOutMusic();

        // Give the "Good night" message a calm moment before resetting.
        clearCompleteResetTimeout();
        state.completeResetTimeout = window.setTimeout(() => {
            state.timerEndTime = null;
            state.selectedDuration = null;
            setActiveOption("off");
            updateCountdownDisplay("Off");
            state.completeResetTimeout = null;
        }, COMPLETE_MESSAGE_DURATION);
    }

    /* =====================================================
       8. CUSTOM DURATION
       ===================================================== */

    /**
     * Validates and converts a user-supplied number of minutes into
     * seconds. Returns null (and logs a reason) for invalid input.
     */
    function parseCustomMinutes(rawValue) {
        const minutes = Number(rawValue);

        if (!Number.isFinite(minutes)) {
            console.warn("[Sukoon Station] Custom timer value is not a number:", rawValue);
            return null;
        }

        if (minutes < CUSTOM_MIN_MINUTES || minutes > CUSTOM_MAX_MINUTES) {
            console.warn(
                `[Sukoon Station] Custom timer must be between ${CUSTOM_MIN_MINUTES} and ${CUSTOM_MAX_MINUTES} minutes.`
            );
            return null;
        }

        return minutes * 60;
    }

    /**
     * Handles the "Custom" option. The current HTML only provides a
     * placeholder button (no input field yet), so this looks for an
     * optional input element first and falls back to a single prompt
     * so the feature is usable today without changing the HTML.
     * Once a real input exists in the panel, this will pick it up
     * automatically via #custom-timer-input.
     */
    function handleCustomOption() {
        const existingInput = document.getElementById("custom-timer-input");

        if (existingInput) {
            const seconds = parseCustomMinutes(existingInput.value);
            if (seconds !== null) {
                startTimer(seconds, "custom");
            } else {
                updateCountdownDisplay("Enter 1–1440 minutes");
            }
            return;
        }

        // Fallback for Version 1.0: no dedicated input exists yet.
        const response = window.prompt("Custom sleep timer — minutes (1–1440):", "45");
        if (response === null) return; // user cancelled

        const seconds = parseCustomMinutes(response);
        if (seconds !== null) {
            startTimer(seconds, "custom");
        } else {
            updateCountdownDisplay("Enter 1–1440 minutes");
        }
    }

    /* =====================================================
       9. TIMER OPTION SELECTION
       ===================================================== */

    function handleOptionClick(event) {
        const button = event.currentTarget;
        const value = button.dataset.timer;

        if (!value) return;

        if (value === "off") {
            stopTimer();
            return;
        }

        if (value === "custom") {
            handleCustomOption();
            return;
        }

        const durationSeconds = DURATIONS[value];
        if (!durationSeconds) {
            console.warn(`[Sukoon Station] Unknown sleep timer option: "${value}"`);
            return;
        }

        startTimer(durationSeconds, value);
    }

    function bindOptionEvents() {
        elements.options.forEach((btn) => {
            btn.addEventListener("click", handleOptionClick);
        });
    }

    /* =====================================================
       10. PANEL OPEN / CLOSE
       ===================================================== */

    function openPanel() {
        if (!elements.panel || !elements.toggle) return;
        if (state.isPanelOpen) return;

        elements.panel.hidden = false;
        elements.panel.classList.remove("is-closing");
        // Force reflow so the entrance animation reliably replays.
        // eslint-disable-next-line no-unused-expressions
        elements.panel.offsetHeight;
        elements.panel.classList.add("is-opening");

        window.setTimeout(() => {
            elements.panel.classList.remove("is-opening");
        }, PANEL_OPEN_ANIM_DURATION);

        elements.toggle.setAttribute("aria-expanded", "true");
        state.isPanelOpen = true;

        document.addEventListener("keydown", handlePanelEscape);
        document.addEventListener("click", handleOutsideClick, true);
    }

    function closePanel() {
        if (!elements.panel || !elements.toggle) return;
        if (!state.isPanelOpen) return;

        elements.panel.classList.remove("is-opening");
        elements.panel.classList.add("is-closing");

        window.setTimeout(() => {
            elements.panel.hidden = true;
            elements.panel.classList.remove("is-closing");
        }, PANEL_CLOSE_ANIM_DURATION);

        elements.toggle.setAttribute("aria-expanded", "false");
        state.isPanelOpen = false;

        document.removeEventListener("keydown", handlePanelEscape);
        document.removeEventListener("click", handleOutsideClick, true);
    }

    function togglePanel() {
        if (state.isPanelOpen) {
            closePanel();
        } else {
            openPanel();
        }
    }

    function handlePanelEscape(event) {
        if (event.key !== "Escape") return;
        if (!state.isPanelOpen) return;
        closePanel();
    }

    function handleOutsideClick(event) {
        if (!state.isPanelOpen) return;
        if (!elements.panel) return;

        const clickedInsidePanel = elements.panel.contains(event.target);
        const clickedToggle = elements.toggle && elements.toggle.contains(event.target);

        if (!clickedInsidePanel && !clickedToggle) {
            closePanel();
        }
    }

    function bindPanelEvents() {
        if (elements.toggle) {
            elements.toggle.addEventListener("click", togglePanel);
        }

        if (elements.closeBtn) {
            elements.closeBtn.addEventListener("click", closePanel);
        }
    }

    /* =====================================================
       11. INITIALIZATION
       ===================================================== */

    function initializeSleepTimer() {
        cacheElements();

        if (!elements.toggle || !elements.panel) {
            console.warn("[Sukoon Station] Sleep timer elements not found — timer.js cannot initialize.");
            return;
        }

        bindPanelEvents();
        bindOptionEvents();

        setActiveOption("off");
        updateCountdownDisplay("Off");
        updateToggleLabel(null);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initializeSleepTimer);
    } else {
        initializeSleepTimer();
    }

    /* =====================================================
       12. PUBLIC API
       ===================================================== */

    window.SukoonTimer = {
        startTimer,
        stopTimer,
        getState: () => ({ ...state }),
    };
})();