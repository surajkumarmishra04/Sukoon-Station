/* =====================================================
   SUKOON STATION — js/script.js
   Main frontend controller: app init + UI panels + module
   coordination. Owns NO theme rotation, playback, or
   countdown logic — those live in themes.js / player.js /
   timer.js respectively.
   ===================================================== */

(function () {
    "use strict";

    /* =====================================================
       0. DEBUG HELPER
       ===================================================== */

    const DEBUG = false;

    function debugLog(...args) {
        if (DEBUG) console.log("[Sukoon Station]", ...args);
    }

    /* =====================================================
       1. STATE
       ===================================================== */

    const state = {
        // Only tracks panels script.js itself owns (Theme, About).
        // The Sleep Timer panel's own open/closed lifecycle is owned
        // and tracked internally by timer.js.
        activePanel: null, // null | "theme" | "about"
    };

    const PANEL_OPEN_ANIM_DURATION = 300; // keep in sync with animations.css
    const PANEL_CLOSE_ANIM_DURATION = 200;

    /* =====================================================
       2. DOM REFERENCES
       ===================================================== */

    const elements = {};

    function cacheElements() {
        elements.themeToggle = document.getElementById("theme-toggle");
        elements.themePanel = document.getElementById("theme-panel");
        elements.themePanelClose = document.getElementById("theme-panel-close");
        elements.themeList = document.getElementById("theme-list");

        elements.aboutToggle = document.getElementById("about-toggle");
        elements.aboutPanel = document.getElementById("about-panel");
        elements.aboutPanelClose = document.getElementById("about-panel-close");

        // Referenced read-only, for cross-panel coordination only.
        // Its open/close behavior belongs entirely to timer.js.
        elements.sleepTimerToggle = document.getElementById("sleep-timer-toggle");
        elements.sleepTimerPanel = document.getElementById("sleep-timer-panel");
        elements.sleepTimerPanelClose = document.getElementById("sleep-timer-panel-close");
    }

    /* =====================================================
       3. GENERIC PANEL OPEN / CLOSE (Theme + About)
       ===================================================== */

    /**
     * Shared open/close behavior for the two panels script.js owns
     * outright. Sleep Timer intentionally does NOT use this — it has
     * its own working implementation in timer.js, and duplicating it
     * here would create conflicting listeners on the same elements.
     */
    function openPanel(panelKey, panelEl, toggleBtn) {
        if (!panelEl || !toggleBtn) return;
        if (state.activePanel === panelKey) return;

        // Enforce "only one panel open at a time".
        closeActivePanel({ returnFocus: false });
        closeSleepTimerPanelIfOpen();

        panelEl.hidden = false;
        panelEl.classList.remove("is-closing");
        // Force reflow so the entrance animation reliably replays.
        // eslint-disable-next-line no-unused-expressions
        panelEl.offsetHeight;
        panelEl.classList.add("is-opening");

        window.setTimeout(() => {
            panelEl.classList.remove("is-opening");
        }, PANEL_OPEN_ANIM_DURATION);

        toggleBtn.setAttribute("aria-expanded", "true");
        state.activePanel = panelKey;

        // Move focus to a sensible first interactive element — the
        // panel's own close button is present in every panel and is
        // a safe, predictable landing spot without a full focus trap.
        const closeBtn = panelEl.querySelector(".panel-close");
        if (closeBtn && typeof closeBtn.focus === "function") {
            closeBtn.focus();
        }
    }

    function closePanel(panelKey, panelEl, toggleBtn, { returnFocus = true } = {}) {
        if (!panelEl || !toggleBtn) return;
        if (state.activePanel !== panelKey) return;

        panelEl.classList.remove("is-opening");
        panelEl.classList.add("is-closing");

        window.setTimeout(() => {
            panelEl.hidden = true;
            panelEl.classList.remove("is-closing");
        }, PANEL_CLOSE_ANIM_DURATION);

        toggleBtn.setAttribute("aria-expanded", "false");
        state.activePanel = null;

        if (returnFocus && typeof toggleBtn.focus === "function") {
            toggleBtn.focus();
        }
    }

    function closeActivePanel(options) {
        if (state.activePanel === "theme") {
            closePanel("theme", elements.themePanel, elements.themeToggle, options);
        } else if (state.activePanel === "about") {
            closePanel("about", elements.aboutPanel, elements.aboutToggle, options);
        }
    }

    /**
     * Defers to timer.js's own close button to close the Sleep Timer
     * panel, rather than manipulating its hidden/class state directly.
     * This respects timer.js's ownership of that panel's lifecycle
     * (its animation, aria-expanded update, and internal listeners)
     * while still letting script.js enforce "only one panel open".
     */
    function closeSleepTimerPanelIfOpen() {
        if (elements.sleepTimerPanel && !elements.sleepTimerPanel.hidden && elements.sleepTimerPanelClose) {
            elements.sleepTimerPanelClose.click();
        }
    }

    /* =====================================================
       4. THEME PANEL
       ===================================================== */

    function toggleThemePanel() {
        if (state.activePanel === "theme") {
            closePanel("theme", elements.themePanel, elements.themeToggle);
        } else {
            openPanel("theme", elements.themePanel, elements.themeToggle);
        }
    }

    /**
     * Reads availability from themes.js's own data (never mutates it)
     * to decide whether a selection should close the panel. The actual
     * theme switch is performed entirely by themes.js's own delegated
     * click listener on #theme-panel — this handler only manages UI
     * chrome around that selection.
     */
    function handleThemeCardActivation(event) {
        const card = event.target.closest(".theme-card");
        if (!card || !elements.themeList || !elements.themeList.contains(card)) return;

        const themeId = card.dataset.theme;
        if (!themeId) return;

        const themesApi = window.SukoonThemes;
        const themeData = themesApi && themesApi.THEMES ? themesApi.THEMES[themeId] : null;

        if (!themeData || !themeData.available) {
            debugLog(`Theme "${themeId}" is not available yet — panel stays open.`);
            return;
        }

        updateActiveThemeCard(themeId);
        closePanel("theme", elements.themePanel, elements.themeToggle);
    }

    function updateActiveThemeCard(activeThemeId) {
        if (!elements.themeList) return;

        elements.themeList.querySelectorAll(".theme-card").forEach((card) => {
            const isActive = card.dataset.theme === activeThemeId;
            card.setAttribute("aria-current", isActive ? "true" : "false");
        });
    }

    function bindThemePanelEvents() {
        if (elements.themeToggle) {
            elements.themeToggle.addEventListener("click", toggleThemePanel);
        }

        if (elements.themePanelClose) {
            elements.themePanelClose.addEventListener("click", () => {
                closePanel("theme", elements.themePanel, elements.themeToggle);
            });
        }

        if (elements.themeList) {
            elements.themeList.addEventListener("click", handleThemeCardActivation);
        }
    }

    /* =====================================================
       5. ABOUT PANEL
       ===================================================== */

    function toggleAboutPanel() {
        if (state.activePanel === "about") {
            closePanel("about", elements.aboutPanel, elements.aboutToggle);
        } else {
            openPanel("about", elements.aboutPanel, elements.aboutToggle);
        }
    }

    function bindAboutPanelEvents() {
        if (elements.aboutToggle) {
            elements.aboutToggle.addEventListener("click", toggleAboutPanel);
        }

        if (elements.aboutPanelClose) {
            elements.aboutPanelClose.addEventListener("click", () => {
                closePanel("about", elements.aboutPanel, elements.aboutToggle);
            });
        }
    }

    /* =====================================================
       6. SLEEP TIMER COORDINATION (no ownership, UI-only)
       ===================================================== */

    /**
     * timer.js fully owns opening/closing #sleep-timer-panel. This
     * listener runs independently alongside timer.js's own click
     * handler on the same button — it only closes the OTHER panels,
     * never touching Sleep Timer's own state or DOM classes.
     */
    function bindSleepTimerCoordination() {
        if (!elements.sleepTimerToggle) return;

        elements.sleepTimerToggle.addEventListener("click", () => {
            closeActivePanel({ returnFocus: false });
        });
    }

    /* =====================================================
       7. ESCAPE KEY
       ===================================================== */

    function handleGlobalEscape(event) {
        if (event.key !== "Escape") return;
        // Only acts on panels script.js owns. The Sleep Timer panel
        // already closes itself on Escape via its own listener in
        // timer.js while it is open, so no duplicate handling here.
        if (state.activePanel) {
            closeActivePanel();
        }
    }

    /* =====================================================
       8. CLICK OUTSIDE
       ===================================================== */

    function handleGlobalClick(event) {
        if (!state.activePanel) return;

        const panelEl = state.activePanel === "theme" ? elements.themePanel : elements.aboutPanel;
        const toggleBtn = state.activePanel === "theme" ? elements.themeToggle : elements.aboutToggle;

        if (!panelEl) return;

        const clickedInsidePanel = panelEl.contains(event.target);
        const clickedToggle = toggleBtn && toggleBtn.contains(event.target);

        if (!clickedInsidePanel && !clickedToggle) {
            closeActivePanel({ returnFocus: false });
        }
    }

    function bindGlobalInteractionEvents() {
        document.addEventListener("keydown", handleGlobalEscape);
        document.addEventListener("click", handleGlobalClick);
    }

    /* =====================================================
       9. THEME MODULE COORDINATION
       ===================================================== */

    function initializeThemeCoordination() {
        if (!window.SukoonThemes) {
            console.warn("[Sukoon Station] SukoonThemes module not found — theme UI will be inactive.");
            return;
        }

        // Reflect Version 1.0's default active theme in the UI.
        const currentTheme = window.SukoonThemes.getCurrentTheme
            ? window.SukoonThemes.getCurrentTheme()
            : null;

        updateActiveThemeCard(currentTheme ? currentTheme.id : "night");
    }

    /* =====================================================
       10. PLAYER MODULE COORDINATION
       ===================================================== */

    function initializePlayerCoordination() {
        if (!window.SukoonPlayer) {
            console.warn("[Sukoon Station] SukoonPlayer module not found — music playback will be unavailable.");
            return;
        }

        // player.js self-initializes on DOMContentLoaded. If a future
        // version exposes an explicit init hook, call it defensively
        // without assuming it exists today.
        if (typeof window.SukoonPlayer.init === "function") {
            try {
                window.SukoonPlayer.init();
            } catch (err) {
                console.error("[Sukoon Station] SukoonPlayer failed to initialize:", err);
            }
        }

        // #listening-status is already kept in sync by player.js
        // internally — intentionally not duplicated here.
    }

    /* =====================================================
       11. TIMER MODULE COORDINATION
       ===================================================== */

    function initializeTimerCoordination() {
        if (!window.SukoonTimer) {
            console.warn("[Sukoon Station] SukoonTimer module not found — sleep timer will be unavailable.");
            return;
        }

        debugLog("Sleep timer module detected and ready.");
        // Countdown, fade-out, and panel behavior all belong to
        // timer.js — nothing further to wire up here.
    }

    /* =====================================================
       12. PAGE VISIBILITY (intentionally minimal)
       ===================================================== */

    function handleVisibilityChange() {
        // Deliberately a no-op beyond logging: music should keep
        // playing and the background/sleep timers should keep running
        // when the tab is hidden. Browsers throttle background timers
        // on their own; no extra intervention is needed here.
        debugLog(`Tab visibility changed: ${document.visibilityState}`);
    }

    function bindVisibilityHandling() {
        document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    /* =====================================================
       13. INITIALIZATION
       ===================================================== */

    function verifyRequiredElements() {
        const required = ["themeToggle", "themePanel", "aboutToggle", "aboutPanel"];
        const missing = required.filter((key) => !elements[key]);

        if (missing.length) {
            console.warn("[Sukoon Station] Missing expected UI elements:", missing);
        }

        return missing.length === 0;
    }

    function initializeApp() {
        cacheElements();
        verifyRequiredElements();

        bindThemePanelEvents();
        bindAboutPanelEvents();
        bindSleepTimerCoordination();
        bindGlobalInteractionEvents();
        bindVisibilityHandling();

        try {
            initializeThemeCoordination();
        } catch (err) {
            console.error("[Sukoon Station] Theme coordination failed to initialize:", err);
        }

        try {
            initializePlayerCoordination();
        } catch (err) {
            console.error("[Sukoon Station] Player coordination failed to initialize:", err);
        }

        try {
            initializeTimerCoordination();
        } catch (err) {
            console.error("[Sukoon Station] Timer coordination failed to initialize:", err);
        }

        debugLog("Sukoon Station initialized.");
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initializeApp);
    } else {
        initializeApp();
    }
})();