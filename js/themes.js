/* =====================================================
   SUKOON STATION — js/themes.js
   Theme data + background image rotation + progress ring
   (No music playback, no sleep timer — see player.js / timer.js)
   ===================================================== */

(function () {
    "use strict";

    /* =====================================================
       1. CONFIG / CONSTANTS
       ===================================================== */

    // Default duration each background image is shown, in ms.
    // Change this single constant to adjust timing everywhere.
    const BACKGROUND_DURATION = 5 * 60 * 1000; // 5 minutes

    // Duration of the crossfade transition between images.
    // Should stay in sync with the opacity transition in animations.css.
    const TRANSITION_DURATION = 1500; // ms

    /* =====================================================
       2. THEME DATA
       ===================================================== */

    const THEMES = {
        night: {
            id: "night",
            name: "Raat",
            description: "Late-night music",
            images: [
                "assets/images/night/night-01.jpg",
                "assets/images/night/night-02.jpg",
                "assets/images/night/night-03.jpg",
            ],
            available: true,
        },
        study: {
            id: "study",
            name: "Study",
            description: "Focus music",
            images: [],
            available: false,
        },
        morning: {
            id: "morning",
            name: "Morning",
            description: "Fresh start",
            images: [],
            available: false,
        },
        rain: {
            id: "rain",
            name: "Rain",
            description: "Rainy mood",
            images: [],
            available: false,
        },
        safar: {
            id: "safar",
            name: "Safar",
            description: "Road & travel",
            images: [],
            available: false,
        },
        workout: {
            id: "workout",
            name: "Workout",
            description: "Energy & training",
            images: [],
            available: false,
        },
    };

    /* =====================================================
       3. STATE
       ===================================================== */

    const state = {
        currentTheme: null,
        currentImageIndex: 0,
        rotationFrame: null, // requestAnimationFrame id for the progress loop
        rotationStartTime: 0,
        isTransitioning: false,
    };

    /* =====================================================
       4. DOM REFERENCES
       ===================================================== */

    const elements = {};

    function cacheElements() {
        elements.backgroundLayer = document.getElementById("background-layer");
        elements.backgroundImage = document.getElementById("background-image");
        elements.backgroundTransition = document.getElementById("background-transition");
        elements.themePanel = document.getElementById("theme-panel");
        elements.progressRingFill = document.getElementById("progress-ring-fill");
    }

    /* =====================================================
       5. PROGRESS RING HELPERS
       ===================================================== */

    let ringCircumference = 0;

    function setupProgressRing() {
        if (!elements.progressRingFill) return;

        const radius = Number(elements.progressRingFill.getAttribute("r")) || 17;
        ringCircumference = 2 * Math.PI * radius;

        elements.progressRingFill.style.strokeDasharray = `${ringCircumference}`;
        elements.progressRingFill.style.strokeDashoffset = `${ringCircumference}`;
    }

    function updateBackgroundProgress(progress) {
        if (!elements.progressRingFill || !ringCircumference) return;

        const clamped = Math.min(Math.max(progress, 0), 1);
        const offset = ringCircumference * (1 - clamped);
        elements.progressRingFill.style.strokeDashoffset = `${offset}`;
    }

    function resetBackgroundProgress() {
        updateBackgroundProgress(0);
    }

    /* =====================================================
       6. IMAGE PRELOADING
       ===================================================== */

    const preloadedImages = new Set();

    function preloadImage(imagePath) {
        return new Promise((resolve, reject) => {
            if (!imagePath) {
                reject(new Error("No image path provided to preload."));
                return;
            }

            if (preloadedImages.has(imagePath)) {
                resolve(imagePath);
                return;
            }

            const img = new Image();

            img.onload = () => {
                preloadedImages.add(imagePath);
                resolve(imagePath);
            };

            img.onerror = () => {
                console.warn(`[Sukoon Station] Failed to preload image: ${imagePath}`);
                reject(new Error(`Failed to preload: ${imagePath}`));
            };

            img.src = imagePath;
        });
    }

    /* =====================================================
       7. BACKGROUND IMAGE MANAGEMENT
       ===================================================== */

    /**
     * Sets the background image.
     * When `immediate` is true, the image is applied without a crossfade
     * (used on initial load / theme switch).
     */
    function setBackgroundImage(imagePath, { immediate = false } = {}) {
        if (!imagePath || !elements.backgroundImage) return;

        if (immediate) {
            elements.backgroundImage.src = imagePath;
            elements.backgroundImage.classList.remove("background-hidden", "background-fading");
            elements.backgroundImage.classList.add("background-visible");

            if (elements.backgroundTransition) {
                elements.backgroundTransition.classList.remove("background-visible", "background-fading");
                elements.backgroundTransition.classList.add("background-hidden");
                elements.backgroundTransition.style.opacity = "0";
            }

            dispatchBackgroundChanged(imagePath);
            return;
        }

        crossfadeToImage(imagePath);
    }

    /**
     * Smoothly crossfades from the current background image to a new one,
     * using #background-transition as the incoming layer.
     */
    function crossfadeToImage(imagePath) {
        if (state.isTransitioning) return;
        if (!elements.backgroundTransition || !elements.backgroundImage) return;

        state.isTransitioning = true;

        preloadImage(imagePath)
            .catch(() => imagePath) // fall back to attempting the swap anyway
            .then(() => {
                const nextLayer = elements.backgroundTransition;

                nextLayer.style.backgroundImage = `url("${imagePath}")`;
                nextLayer.style.backgroundSize = "cover";
                nextLayer.style.backgroundPosition = "center";
                nextLayer.classList.remove("background-hidden");

                // Force a reflow so the opacity transition actually runs.
                // eslint-disable-next-line no-unused-expressions
                nextLayer.offsetHeight;

                requestAnimationFrame(() => {
                    nextLayer.classList.add("background-visible");
                    nextLayer.style.opacity = "1";
                });

                window.setTimeout(() => {
                    elements.backgroundImage.src = imagePath;
                    nextLayer.classList.remove("background-visible");
                    nextLayer.classList.add("background-hidden");
                    nextLayer.style.opacity = "0";
                    state.isTransitioning = false;
                    dispatchBackgroundChanged(imagePath);
                }, TRANSITION_DURATION);
            })
            .catch((err) => {
                console.warn("[Sukoon Station] Background transition failed:", err);
                state.isTransitioning = false;
            });
    }

    function nextBackgroundImage() {
        const theme = state.currentTheme;
        if (!theme || !theme.images.length) return;

        state.currentImageIndex = (state.currentImageIndex + 1) % theme.images.length;
        const nextPath = theme.images[state.currentImageIndex];

        setBackgroundImage(nextPath);

        // Preload the image after this one, so it's ready when its turn comes.
        const followingIndex = (state.currentImageIndex + 1) % theme.images.length;
        const followingPath = theme.images[followingIndex];
        if (followingPath && followingPath !== nextPath) {
            preloadImage(followingPath).catch(() => {
                /* handled via console.warn inside preloadImage */
            });
        }
    }

    /* =====================================================
       8. ROTATION TIMER (single active timer, rAF-driven)
       ===================================================== */

    function rotationTick(now) {
        if (!state.rotationStartTime) {
            state.rotationStartTime = now;
        }

        const elapsed = now - state.rotationStartTime;
        const progress = elapsed / BACKGROUND_DURATION;

        if (progress >= 1) {
            resetBackgroundProgress();
            state.rotationStartTime = now;
            nextBackgroundImage();
        } else {
            updateBackgroundProgress(progress);
        }

        state.rotationFrame = requestAnimationFrame(rotationTick);
    }

    function startBackgroundRotation() {
        // Guarantee only one active rotation loop at a time.
        stopBackgroundRotation();
        state.rotationStartTime = 0;
        state.rotationFrame = requestAnimationFrame(rotationTick);
    }

    function stopBackgroundRotation() {
        if (state.rotationFrame !== null) {
            cancelAnimationFrame(state.rotationFrame);
            state.rotationFrame = null;
        }
        state.rotationStartTime = 0;
    }

    /* =====================================================
       9. THEME SWITCHING
       ===================================================== */

    function setTheme(themeId) {
        const theme = THEMES[themeId];

        if (!theme) {
            console.warn(`[Sukoon Station] Unknown theme requested: "${themeId}"`);
            return;
        }

        if (!theme.available) {
            console.info(`[Sukoon Station] Theme "${theme.name}" is not available yet.`);
            return;
        }

        if (!theme.images.length) {
            console.warn(`[Sukoon Station] Theme "${theme.name}" has no images configured.`);
            return;
        }

        // Whether switching themes or reselecting the current one,
        // always restart the sequence from the beginning.
        stopBackgroundRotation();
        state.currentTheme = theme;
        state.currentImageIndex = 0;
        state.isTransitioning = false;
        resetBackgroundProgress();

        setBackgroundImage(theme.images[0], { immediate: true });

        if (theme.images.length > 1) {
            preloadImage(theme.images[1]).catch(() => {
                /* handled via console.warn inside preloadImage */
            });
        }

        startBackgroundRotation();
    }

    function getCurrentTheme() {
        return state.currentTheme;
    }

    /* =====================================================
       10. THEME PANEL EVENT DELEGATION
       ===================================================== */

    function handleThemePanelClick(event) {
        const card = event.target.closest(".theme-card");
        if (!card || !elements.themePanel.contains(card)) return;

        const themeId = card.dataset.theme;
        if (!themeId) return;

        setTheme(themeId);
    }

    function bindThemePanelEvents() {
        if (!elements.themePanel) return;

        elements.themePanel.addEventListener("click", handleThemePanelClick);

        // Basic keyboard support (Enter/Space) for non-button elements,
        // in case future markup changes; theme cards are already <button>s
        // so native activation is handled automatically by the click above.
    }

    /* =====================================================
       11. CUSTOM EVENTS
       ===================================================== */

    function dispatchBackgroundChanged(imagePath) {
        if (!state.currentTheme) return;

        const detail = {
            themeId: state.currentTheme.id,
            imageIndex: state.currentImageIndex,
            imagePath: imagePath || state.currentTheme.images[state.currentImageIndex],
        };

        document.dispatchEvent(new CustomEvent("backgroundChanged", { detail }));
    }

    /* =====================================================
       12. INITIALIZATION
       ===================================================== */

    function initializeThemes() {
        cacheElements();

        if (!elements.backgroundImage || !elements.backgroundTransition) {
            console.warn("[Sukoon Station] Background elements not found — themes.js cannot initialize.");
            return;
        }

        setupProgressRing();
        bindThemePanelEvents();

        // Default: Night theme, image 0, progress 0, 5-minute timer,
        // with night-02 preloaded ahead of time.
        setTheme("night");
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initializeThemes);
    } else {
        initializeThemes();
    }

    /* =====================================================
       13. PUBLIC API
       ===================================================== */

    window.SukoonThemes = {
        setTheme,
        getCurrentTheme,
        THEMES,
    };
})();