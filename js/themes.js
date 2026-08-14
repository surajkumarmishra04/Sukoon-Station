/**
 * ==========================================================================
 * SUKOON STATION — VERSION 1.0 (NIGHT MOOD)
 * Theme & Background Management System (js/themes.js)
 * ==========================================================================
 */

(function (global) {
  'use strict';

  /* ==========================================================================
     1. THEME CONFIGURATION & CONSTANTS
     ========================================================================== */

  const BACKGROUND_DURATION = 5 * 60 * 1000; // 5 minutes per background image
  const TRANSITION_DURATION = 1600; // Matches CSS cross-fade timing (1.6s)
  const PROGRESS_TICK_INTERVAL = 100; // Update progress ring every 100ms
  const RING_RADIUS = 15.5;
  const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS; // ~97.389

  const THEMES = {
    night: {
      id: 'night',
      name: 'Raat',
      description: 'Late-night calm & reflective music',
      images: [
        'assets/images/night/night-01.jpg',
        'assets/images/night/night-02.jpg',
        'assets/images/night/night-03.jpg'
      ],
      available: true
    },
    study: {
      id: 'study',
      name: 'Study',
      description: 'Focus and deep work ambience',
      images: [],
      available: false
    },
    morning: {
      id: 'morning',
      name: 'Morning',
      description: 'Fresh sunrise melodies',
      images: [],
      available: false
    },
    rain: {
      id: 'rain',
      name: 'Rain',
      description: 'Cozy rain and lo-fi moods',
      images: [],
      available: false
    },
    safar: {
      id: 'safar',
      name: 'Safar',
      description: 'Cinematic travel and road rhythms',
      images: [],
      available: false
    },
    workout: {
      id: 'workout',
      name: 'Workout',
      description: 'High-energy rhythm and movement',
      images: [],
      available: false
    }
  };

  /* ==========================================================================
     2. INTERNAL STATE
     ========================================================================== */

  const state = {
    currentThemeId: 'night',
    currentImageIndex: 0,
    cycleStartTime: 0,
    progressTimerId: null,
    rotationTimeoutId: null,
    isTransitioning: false,
    preloadedImages: new Map()
  };

  // Cached DOM References
  let dom = {
    bgImage: null,
    progressRing: null,
    progressIndicator: null,
    themePanel: null,
    themeCards: null
  };

  /* ==========================================================================
     3. DOM CACHING & INITIAL SEEDING
     ========================================================================== */

  function cacheDomElements() {
    dom.bgImage = document.getElementById('background-image');
    dom.progressRing = document.getElementById('background-progress');
    dom.progressIndicator = dom.progressRing
      ? dom.progressRing.querySelector('.progress-ring-indicator')
      : null;
    dom.themePanel = document.getElementById('theme-panel');
    dom.themeCards = dom.themePanel
      ? dom.themePanel.querySelectorAll('.theme-card')
      : [];
  }

  /* ==========================================================================
     4. IMAGE PRELOADING SYSTEM
     ========================================================================== */

  /**
   * Preloads an image into browser cache to ensure seamless cross-fades.
   * @param {string} imagePath - Path to the image asset.
   * @returns {Promise<string>}
   */
  function preloadImage(imagePath) {
    return new Promise((resolve, reject) => {
      if (!imagePath) {
        return reject(new Error('Invalid image path.'));
      }

      if (state.preloadedImages.has(imagePath)) {
        return resolve(imagePath);
      }

      const img = new Image();
      img.onload = () => {
        state.preloadedImages.set(imagePath, img);
        resolve(imagePath);
      };
      img.onerror = () => {
        console.warn(`[Sukoon Themes] Failed to preload image: ${imagePath}`);
        reject(new Error(`Failed to load image at: ${imagePath}`));
      };
      img.src = imagePath;
    });
  }

  /**
   * Preloads the upcoming image in the active theme sequence.
   */
  function preloadNextImage() {
    const currentTheme = THEMES[state.currentThemeId];
    if (!currentTheme || !currentTheme.images.length) return;

    const nextIndex = (state.currentImageIndex + 1) % currentTheme.images.length;
    const nextPath = currentTheme.images[nextIndex];
    preloadImage(nextPath).catch(() => {});
  }

  /* ==========================================================================
     5. BACKGROUND PROGRESS RING
     ========================================================================== */

  /**
   * Initializes SVG stroke geometry for the circular progress bar.
   */
  function initializeProgressRing() {
    if (!dom.progressIndicator) return;

    dom.progressIndicator.style.strokeDasharray = `${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`;
    dom.progressIndicator.style.strokeDashoffset = `${RING_CIRCUMFERENCE}`;
  }

  /**
   * Updates the circular progress bar offset based on elapsed cycle time.
   */
  function updateBackgroundProgress() {
    if (!dom.progressIndicator || !state.cycleStartTime) return;

    const elapsed = Date.now() - state.cycleStartTime;
    const progressRatio = Math.min(Math.max(elapsed / BACKGROUND_DURATION, 0), 1);
    const offset = RING_CIRCUMFERENCE - (progressRatio * RING_CIRCUMFERENCE);

    dom.progressIndicator.style.strokeDashoffset = `${offset}`;

    if (dom.progressRing) {
      dom.progressRing.setAttribute('aria-valuenow', Math.round(progressRatio * 100));
    }
  }

  /**
   * Resets the circular progress ring visually and resets the start timestamp.
   */
  function resetBackgroundProgress() {
    state.cycleStartTime = Date.now();
    if (dom.progressIndicator) {
      dom.progressIndicator.style.strokeDashoffset = `${RING_CIRCUMFERENCE}`;
    }
    if (dom.progressRing) {
      dom.progressRing.setAttribute('aria-valuenow', '0');
    }
  }

  /* ==========================================================================
     6. BACKGROUND ROTATION & TRANSITIONS
     ========================================================================== */

  /**
   * Smoothly changes the background image with a cross-fade transition.
   * @param {string} imagePath - Next image file path.
   * @param {number} nextIndex - Index of the next image in the sequence.
   */
  function setBackgroundImage(imagePath, nextIndex) {
    if (!dom.bgImage || state.isTransitioning) return;

    state.isTransitioning = true;

    preloadImage(imagePath)
      .catch(() => {
        // Fallback: If preloading fails, attempt to display current or directly proceed
        return imagePath;
      })
      .then(() => {
        // Step 1: Start fading out current background
        dom.bgImage.classList.remove('background-visible');
        dom.bgImage.classList.add('background-fading');

        setTimeout(() => {
          // Step 2: Swap the source once dimmed
          dom.bgImage.src = imagePath;
          state.currentImageIndex = nextIndex;

          // Step 3: Fade in the new image
          dom.bgImage.classList.remove('background-fading');
          dom.bgImage.classList.add('background-visible');

          state.isTransitioning = false;

          // Step 4: Dispatch event to notify application of scene update
          dispatchBackgroundChangeEvent(state.currentThemeId, state.currentImageIndex, imagePath);

          // Step 5: Immediately queue preloading for the next sequential image
          preloadNextImage();
        }, TRANSITION_DURATION / 2);
      });
  }

  /**
   * Advances the background sequence to the next image in the active theme.
   */
  function nextBackgroundImage() {
    const theme = THEMES[state.currentThemeId];
    if (!theme || !theme.images.length) return;

    const nextIndex = (state.currentImageIndex + 1) % theme.images.length;
    const nextImagePath = theme.images[nextIndex];

    resetBackgroundProgress();
    setBackgroundImage(nextImagePath, nextIndex);
  }

  /**
   * Starts the background image rotation interval and progress tracking loop.
   */
  function startBackgroundRotation() {
    stopBackgroundRotation();

    state.cycleStartTime = Date.now();

    // Progress update loop
    state.progressTimerId = setInterval(() => {
      updateBackgroundProgress();
    }, PROGRESS_TICK_INTERVAL);

    // Image switch timeout
    state.rotationTimeoutId = setInterval(() => {
      nextBackgroundImage();
    }, BACKGROUND_DURATION);
  }

  /**
   * Stops all active background timers to prevent leaks or duplicate executions.
   */
  function stopBackgroundRotation() {
    if (state.progressTimerId) {
      clearInterval(state.progressTimerId);
      state.progressTimerId = null;
    }
    if (state.rotationTimeoutId) {
      clearInterval(state.rotationTimeoutId);
      state.rotationTimeoutId = null;
    }
  }

  /* ==========================================================================
     7. THEME SWITCHING SYSTEM
     ========================================================================== */

  /**
   * Switches the active visual mood/theme.
   * @param {string} themeId - Target theme identifier.
   * @returns {boolean} True if switch was successful.
   */
  function setTheme(themeId) {
    const targetTheme = THEMES[themeId];

    if (!targetTheme) {
      console.warn(`[Sukoon Themes] Theme "${themeId}" does not exist.`);
      return false;
    }

    if (!targetTheme.available || !targetTheme.images.length) {
      console.info(`[Sukoon Themes] Mood "${targetTheme.name}" is currently unavailable in Version 1.0.`);
      return false;
    }

    state.currentThemeId = themeId;
    state.currentImageIndex = 0;

    const initialImage = targetTheme.images[0];

    // Update active UI cards in the theme panel
    updateThemeCardsUI(themeId);

    // Reset rotation & immediately apply first image
    stopBackgroundRotation();
    resetBackgroundProgress();
    setBackgroundImage(initialImage, 0);
    startBackgroundRotation();

    return true;
  }

  /**
   * Updates visual active states on theme selection cards.
   * @param {string} activeThemeId
   */
  function updateThemeCardsUI(activeThemeId) {
    if (!dom.themeCards || !dom.themeCards.length) return;

    dom.themeCards.forEach((card) => {
      const cardTheme = card.getAttribute('data-theme');
      if (cardTheme === activeThemeId) {
        card.classList.add('active');
        card.setAttribute('aria-pressed', 'true');
      } else {
        card.classList.remove('active');
        card.setAttribute('aria-pressed', 'false');
      }
    });
  }

  /* ==========================================================================
     8. EVENT HANDLING & DELEGATION
     ========================================================================== */

  /**
   * Attaches theme selection click handlers via event delegation.
   */
  function setupThemeEvents() {
    if (!dom.themePanel) return;

    dom.themePanel.addEventListener('click', (event) => {
      const themeCard = event.target.closest('.theme-card');
      if (!themeCard) return;

      const selectedTheme = themeCard.getAttribute('data-theme');
      if (selectedTheme) {
        setTheme(selectedTheme);
      }
    });
  }

  /**
   * Dispatches a custom browser event for decoupled listener synchronization.
   */
  function dispatchBackgroundChangeEvent(themeId, imageIndex, imagePath) {
    const event = new CustomEvent('backgroundChanged', {
      detail: {
        themeId,
        imageIndex,
        imagePath
      },
      bubbles: true
    });
    document.dispatchEvent(event);
  }

  /* ==========================================================================
     9. PUBLIC INITIALIZATION & API
     ========================================================================== */

  /**
   * Main setup sequence for themes and background rotation.
   */
  function initializeThemes() {
    cacheDomElements();
    initializeProgressRing();
    setupThemeEvents();

    const defaultTheme = THEMES[state.currentThemeId];
    const initialImagePath = defaultTheme.images[state.currentImageIndex];

    // Set initial image state classes
    if (dom.bgImage) {
      dom.bgImage.src = initialImagePath;
      dom.bgImage.classList.add('background-visible');
    }

    // Preload next image and activate 5-minute rotation cycle
    preloadNextImage();
    startBackgroundRotation();
  }

  // Automatic bootstrap on DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeThemes);
  } else {
    initializeThemes();
  }

  // Public API Export for interaction with other modules
  const SukoonThemes = {
    initializeThemes,
    setTheme,
    setBackgroundImage,
    nextBackgroundImage,
    startBackgroundRotation,
    stopBackgroundRotation,
    resetBackgroundProgress,
    updateBackgroundProgress,
    preloadImage,
    getThemes: () => ({ ...THEMES }),
    getCurrentState: () => ({ ...state })
  };

  global.SukoonThemes = SukoonThemes;

})(typeof window !== 'undefined' ? window : this);