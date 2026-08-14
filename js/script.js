/**
 * ==========================================================================
 * SUKOON STATION — VERSION 1.0 (NIGHT MOOD)
 * Main Application Orchestrator & UI Controller (js/script.js)
 * ==========================================================================
 */

(function (global) {
  'use strict';

  /* ==========================================================================
     1. CONSTANTS & CONFIGURATION
     ========================================================================= */

  const DEBUG = false;
  const PANEL_TRANSITION_MS = 200; // Duration matching CSS panel closing animation

  const PANELS = {
    theme: {
      key: 'theme',
      panelId: 'theme-panel',
      toggleId: 'theme-toggle',
      closeId: 'theme-panel-close'
    },
    about: {
      key: 'about',
      panelId: 'about-panel',
      toggleId: 'about-toggle',
      closeId: 'about-panel-close'
    },
    timer: {
      key: 'timer',
      panelId: 'sleep-timer-panel',
      toggleId: 'sleep-timer-toggle',
      closeId: 'sleep-timer-close'
    }
  };

  /* ==========================================================================
     2. APPLICATION UI STATE
     ========================================================================== */

  const appState = {
    activePanel: null, // null | 'theme' | 'about' | 'timer'
    isInitialized: false
  };

  // DOM Elements Cache
  const dom = {
    app: null,
    panels: {},
    toggles: {},
    closeButtons: {},
    musicPlayer: null,
    listeningStatus: null
  };

  /* ==========================================================================
     3. DOM CACHING & SAFE ELEMENT QUERYING
     ========================================================================== */

  function cacheDomElements() {
    dom.app = document.getElementById('app');
    dom.musicPlayer = document.getElementById('music-player');
    dom.listeningStatus = document.getElementById('listening-status');

    // Cache panel elements dynamically from registry
    Object.keys(PANELS).forEach((key) => {
      const config = PANELS[key];
      dom.panels[key] = document.getElementById(config.panelId);
      dom.toggles[key] = document.getElementById(config.toggleId);
      dom.closeButtons[key] = document.getElementById(config.closeId);
    });
  }

  /* ==========================================================================
     4. FLOATING PANEL MANAGEMENT (MUTUAL EXCLUSIVITY & ACCESSIBILITY)
     ========================================================================== */

  /**
   * Opens a specific floating overlay panel, closing any currently open panels.
   * @param {string} panelKey - 'theme' | 'about' | 'timer'
   */
  function openPanel(panelKey) {
    if (!PANELS[panelKey]) return;

    // If another panel is already open, close it first without animation delay
    if (appState.activePanel && appState.activePanel !== panelKey) {
      closePanelDirect(appState.activePanel);
    }

    const panelEl = dom.panels[panelKey];
    const toggleBtn = dom.toggles[panelKey];

    if (!panelEl) return;

    panelEl.removeAttribute('hidden');
    panelEl.classList.remove('is-closing');

    if (toggleBtn) {
      toggleBtn.setAttribute('aria-expanded', 'true');
    }

    appState.activePanel = panelKey;

    // Shift focus to close button or first interactive child for keyboard navigation
    const focusTarget = dom.closeButtons[panelKey] || panelEl.querySelector('button, a, input');
    if (focusTarget && typeof focusTarget.focus === 'function') {
      setTimeout(() => focusTarget.focus(), 50);
    }

    logDebug(`Opened panel: ${panelKey}`);
  }

  /**
   * Closes a specific overlay panel with smooth exit animation.
   * @param {string} panelKey - 'theme' | 'about' | 'timer'
   */
  function closePanel(panelKey) {
    if (!PANELS[panelKey] || appState.activePanel !== panelKey) return;

    const panelEl = dom.panels[panelKey];
    const toggleBtn = dom.toggles[panelKey];

    if (!panelEl) return;

    panelEl.classList.add('is-closing');

    setTimeout(() => {
      panelEl.setAttribute('hidden', '');
      panelEl.classList.remove('is-closing');

      if (toggleBtn) {
        toggleBtn.setAttribute('aria-expanded', 'false');
        // Return focus to the opening trigger button
        if (typeof toggleBtn.focus === 'function') {
          toggleBtn.focus();
        }
      }

      if (appState.activePanel === panelKey) {
        appState.activePanel = null;
      }

      logDebug(`Closed panel: ${panelKey}`);
    }, PANEL_TRANSITION_MS);
  }

  /**
   * Closes a panel immediately without animation (used when switching panels).
   * @param {string} panelKey
   */
  function closePanelDirect(panelKey) {
    const panelEl = dom.panels[panelKey];
    const toggleBtn = dom.toggles[panelKey];

    if (panelEl) {
      panelEl.setAttribute('hidden', '');
      panelEl.classList.remove('is-closing');
    }

    if (toggleBtn) {
      toggleBtn.setAttribute('aria-expanded', 'false');
    }

    if (appState.activePanel === panelKey) {
      appState.activePanel = null;
    }
  }

  /**
   * Toggles visibility of a specific panel.
   * @param {string} panelKey
   */
  function togglePanel(panelKey) {
    if (appState.activePanel === panelKey) {
      closePanel(panelKey);
    } else {
      openPanel(panelKey);
    }
  }

  /**
   * Closes whichever panel is currently active.
   */
  function closeActivePanel() {
    if (appState.activePanel) {
      closePanel(appState.activePanel);
    }
  }

  /* ==========================================================================
     5. MODULE COORDINATION & EVENT SYNC
     ========================================================================== */

  /**
   * Checks and logs available system modules on startup.
   */
  function verifyModules() {
    const hasThemes = Boolean(global.SukoonThemes);
    const hasPlayer = Boolean(global.SukoonPlayer);
    const hasTimer = Boolean(global.SukoonTimer);

    if (!hasThemes) console.warn('[Sukoon Main] SukoonThemes module not detected.');
    if (!hasPlayer) console.warn('[Sukoon Main] SukoonPlayer module not detected.');
    if (!hasTimer) console.warn('[Sukoon Main] SukoonTimer module not detected.');

    logDebug('Module Status:', { Themes: hasThemes, Player: hasPlayer, Timer: hasTimer });
  }

  /**
   * Handles theme card selections from the Theme panel and coordinates UI dismissal.
   * @param {HTMLElement} themeCard
   */
  function handleThemeSelection(themeCard) {
    if (!themeCard) return;

    const themeId = themeCard.getAttribute('data-theme');
    if (!themeId) return;

    if (global.SukoonThemes && typeof global.SukoonThemes.setTheme === 'function') {
      const success = global.SukoonThemes.setTheme(themeId);
      if (success) {
        // Automatically close panel upon successful theme selection
        setTimeout(() => {
          closePanel('theme');
        }, 150);
      }
    }
  }

  /* ==========================================================================
     6. GLOBAL EVENT LISTENERS & DELEGATION
     ========================================================================== */

  function setupPanelListeners() {
    // 1. Trigger Buttons (Open / Toggle)
    Object.keys(PANELS).forEach((key) => {
      const toggleEl = dom.toggles[key];
      if (toggleEl) {
        toggleEl.addEventListener('click', (e) => {
          e.stopPropagation();
          togglePanel(key);
        });
      }

      // Close Buttons inside panels
      const closeEl = dom.closeButtons[key];
      if (closeEl) {
        closeEl.addEventListener('click', (e) => {
          e.stopPropagation();
          closePanel(key);
        });
      }

      // Stop propagation inside panel body so clicks don't trigger click-outside dismisser
      const panelEl = dom.panels[key];
      if (panelEl) {
        panelEl.addEventListener('click', (e) => {
          e.stopPropagation();
        });
      }
    });

    // 2. Theme Selection Card Delegation
    const themePanel = dom.panels.theme;
    if (themePanel) {
      themePanel.addEventListener('click', (e) => {
        const themeCard = e.target.closest('.theme-card');
        if (themeCard) {
          handleThemeSelection(themeCard);
        }
      });
    }

    // 3. Global Click-Outside Dismissal
    document.addEventListener('click', (e) => {
      if (!appState.activePanel) return;

      const activeKey = appState.activePanel;
      const activePanelEl = dom.panels[activeKey];
      const activeToggleEl = dom.toggles[activeKey];

      const isInsidePanel = activePanelEl && activePanelEl.contains(e.target);
      const isToggleBtn = activeToggleEl && activeToggleEl.contains(e.target);

      if (!isInsidePanel && !isToggleBtn) {
        closePanel(activeKey);
      }
    });

    // 4. Global Keyboard Escape Key Handler
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && appState.activePanel) {
        closePanel(appState.activePanel);
      }
    });
  }

  /**
   * Sets up cross-module custom event listeners.
   */
  function setupSystemEventListeners() {
    // Synchronize custom theme changes if dispatched externally
    document.addEventListener('themeChanged', (e) => {
      if (e.detail && e.detail.themeId) {
        logDebug(`Theme change event received: ${e.detail.themeId}`);
      }
    });

    // Synchronize background image transitions if dispatched
    document.addEventListener('backgroundChanged', (e) => {
      if (e.detail) {
        logDebug('Background transition synchronized:', e.detail);
      }
    });
  }

  /* ==========================================================================
     7. UTILITY & LOGGING HELPERS
     ========================================================================== */

  function logDebug(message, ...args) {
    if (DEBUG) {
      console.log(`[Sukoon Station] ${message}`, ...args);
    }
  }

  /* ==========================================================================
     8. APP INITIALIZATION & BOOTSTRAP
     ========================================================================== */

  /**
   * Main entry point for Sukoon Station application controller.
   */
  function initializeApp() {
    if (appState.isInitialized) return;

    try {
      cacheDomElements();
      verifyModules();
      setupPanelListeners();
      setupSystemEventListeners();

      appState.isInitialized = true;
      logDebug('Application initialized successfully. Version 1.0 (Raat / Night Mode)');
    } catch (err) {
      console.error('[Sukoon Main] Initialization encountered an issue:', err);
    }
  }

  // Self-executing DOM Ready check
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
  } else {
    initializeApp();
  }

  // Public Controller API Export
  const SukoonApp = {
    initializeApp,
    openPanel,
    closePanel,
    togglePanel,
    closeActivePanel,
    getActivePanel: () => appState.activePanel,
    getState: () => ({ ...appState })
  };

  global.SukoonApp = SukoonApp;

})(typeof window !== 'undefined' ? window : this);