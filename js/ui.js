/**
 * Atelier UI Controller
 * Wires up the Stitch design controls, drawer, lighting, annotations, and texture inspector.
 */

import { config } from './config.js';

export class UIController {
  constructor(bookScene, presentation) {
    this.bookScene = bookScene;
    this.presentation = presentation;

    // Track active object URLs for cleanup
    this.activeObjectUrls = new Set();

    this.cacheDomElements();
    this.bindEvents();
    this.initInspector();
  }

  cacheDomElements() {
    // Header
    this.topResetCamBtn = document.getElementById('topResetCamBtn');
    this.topAudioBtn = document.getElementById('topAudioBtn');
    this.topDrawerBtn = document.getElementById('topDrawerBtn');
    this.topFullscreenBtn = document.getElementById('topFullscreenBtn');

    // Sub-bar
    this.lightDayBtn = document.getElementById('lightDayBtn');
    this.lightEveningBtn = document.getElementById('lightEveningBtn');
    this.resetCamBtn = document.getElementById('resetCamBtn');
    this.openDrawerBtn = document.getElementById('openDrawerBtn');
    this.galleryStage = document.getElementById('galleryStage');
    this.ambientBackdrop = document.getElementById('ambientBackdrop');

    // Stage & hotspots
    this.prevHotspot = document.getElementById('prevHotspot');
    this.nextHotspot = document.getElementById('nextHotspot');
    this.pageTurningToast = document.getElementById('pageTurningToast');
    this.annotationSpot1 = document.getElementById('annotationSpot1');
    this.annotationSpot2 = document.getElementById('annotationSpot2');
    this.annotationText1 = document.getElementById('annotationText1');
    this.annotationText2 = document.getElementById('annotationText2');

    // Dock
    this.currentSpreadTitle = document.getElementById('currentSpreadTitle');
    this.currentSpreadSubtitle = document.getElementById('currentSpreadSubtitle');
    this.prevSpreadBtn = document.getElementById('prevSpreadBtn');
    this.nextSpreadBtn = document.getElementById('nextSpreadBtn');
    this.pageIndicator = document.getElementById('pageIndicator');
    this.totalSpreadsIndicator = document.getElementById('totalSpreadsIndicator');
    this.dockAudioBtn = document.getElementById('toggleAudioBtn');
    this.dockFullscreenBtn = document.getElementById('toggleFullscreenBtn');

    // Drawer
    this.inspectorDrawer = document.getElementById('inspectorDrawer');
    this.drawerOverlay = document.getElementById('drawerOverlay');
    this.closeDrawerBtn = document.getElementById('closeDrawerBtn');
    this.applyInspectorBtn = document.getElementById('applyInspectorBtn');
    this.resetViewDefaultsBtn = document.getElementById('resetViewDefaultsBtn');
    this.elevationSlider = document.getElementById('elevationSlider');
    this.elevationValue = document.getElementById('elevationValue');
    this.spineSpreadSlider = document.getElementById('spineSpreadSlider');
    this.spineSpreadValue = document.getElementById('spineSpreadValue');
    this.shadowSlider = document.getElementById('shadowSlider');
    this.shadowValue = document.getElementById('shadowValue');
    this.drawerFolioGrid = document.getElementById('drawerFolioGrid');
    this.activeFolioBadge = document.getElementById('activeFolioBadge');

    // Editor / Replacement section
    this.slideSelectInput = document.getElementById('slideSelectInput');
    this.slideFileInput = document.getElementById('slideFileInput');
    this.slideThumbPreview = document.getElementById('slideThumbPreview');
    this.frontCoverFileInput = document.getElementById('frontCoverFileInput');
    this.backCoverFileInput = document.getElementById('backCoverFileInput');
    this.spineFileInput = document.getElementById('spineFileInput');

    // Paper stock radio options
    this.paperStockOptions = document.querySelectorAll('input[name="paper-stock"]');
  }

  bindEvents() {
    // 1. Subscribe to Presentation State
    this.presentation.subscribe((state) => this.renderState(state));

    // 2. Navigation buttons & hotspots
    if (this.nextSpreadBtn) {
      this.nextSpreadBtn.addEventListener('click', () => this.presentation.next());
    }
    if (this.prevSpreadBtn) {
      this.prevSpreadBtn.addEventListener('click', () => this.presentation.previous());
    }
    if (this.nextHotspot) {
      this.nextHotspot.addEventListener('click', () => this.presentation.next());
    }
    if (this.prevHotspot) {
      this.prevHotspot.addEventListener('click', () => this.presentation.previous());
    }

    // 3. Keyboard navigation
    window.addEventListener('keydown', (e) => {
      // Don't intercept if typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
        return;
      }
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        this.presentation.next();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        this.presentation.previous();
      } else if (e.key === 'Escape') {
        this.toggleDrawer(false);
      }
    });

    // 4. Lighting atmosphere toggles
    if (this.lightDayBtn && this.lightEveningBtn) {
      this.lightDayBtn.addEventListener('click', () => this.setLighting('daylight'));
      this.lightEveningBtn.addEventListener('click', () => this.setLighting('chiaroscuro'));
    }

    // 5. Camera Reset (Isometric View)
    const resetCamAction = () => {
      this.bookScene.resetIsometricView();
      if (this.elevationSlider) {
        this.elevationSlider.value = config.book.initialElevation;
        if (this.elevationValue) this.elevationValue.textContent = `${config.book.initialElevation}°`;
      }
    };
    if (this.resetCamBtn) this.resetCamBtn.addEventListener('click', resetCamAction);
    if (this.topResetCamBtn) this.topResetCamBtn.addEventListener('click', resetCamAction);
    if (this.resetViewDefaultsBtn) this.resetViewDefaultsBtn.addEventListener('click', resetCamAction);

    // 6. Camera Elevation slider
    if (this.elevationSlider) {
      this.elevationSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        if (this.elevationValue) this.elevationValue.textContent = `${val}°`;
        this.bookScene.setElevation(val);
      });
    }

    // 7. Spine spread curvature slider
    if (this.spineSpreadSlider) {
      this.spineSpreadSlider.addEventListener('input', (e) => {
        const val = e.target.value;
        if (this.spineSpreadValue) this.spineSpreadValue.textContent = `${val}° (Open flat)`;
      });
    }

    // 8. Raking shadow intensity
    if (this.shadowSlider) {
      this.shadowSlider.addEventListener('input', (e) => {
        const val = e.target.value;
        if (this.shadowValue) this.shadowValue.textContent = `${val}%`;
        const intensity = (parseInt(val, 10) / 100) * 2.2;
        if (this.bookScene.lights.key) {
          this.bookScene.lights.key.shadow.radius = 1.0 + (100 - parseInt(val, 10)) * 0.03;
        }
      });
    }

    // 9. Drawer Open / Close
    const openDrawer = () => this.toggleDrawer(true);
    const closeDrawer = () => this.toggleDrawer(false);

    if (this.openDrawerBtn) this.openDrawerBtn.addEventListener('click', openDrawer);
    if (this.topDrawerBtn) this.topDrawerBtn.addEventListener('click', openDrawer);
    if (this.closeDrawerBtn) this.closeDrawerBtn.addEventListener('click', closeDrawer);
    if (this.applyInspectorBtn) this.applyInspectorBtn.addEventListener('click', closeDrawer);
    if (this.drawerOverlay) this.drawerOverlay.addEventListener('click', closeDrawer);

    // 10. Audio toggle
    const toggleAudioAction = () => {
      const enabled = this.presentation.toggleAudio();
      this.updateAudioIcons(enabled);
    };
    if (this.dockAudioBtn) this.dockAudioBtn.addEventListener('click', toggleAudioAction);
    if (this.topAudioBtn) this.topAudioBtn.addEventListener('click', toggleAudioAction);

    // 11. Fullscreen toggle
    const toggleFullscreenAction = () => this.toggleFullscreen();
    if (this.dockFullscreenBtn) this.dockFullscreenBtn.addEventListener('click', toggleFullscreenAction);
    if (this.topFullscreenBtn) this.topFullscreenBtn.addEventListener('click', toggleFullscreenAction);

    // 12. Texture replacement preview events
    this.setupReplacementInputs();
  }

  renderState(state) {
    // Current spread title and subtitle
    if (this.currentSpreadTitle && state.spreadData) {
      this.currentSpreadTitle.textContent = state.spreadData.title;
    }
    if (this.currentSpreadSubtitle && state.spreadData) {
      this.currentSpreadSubtitle.textContent = state.spreadData.subtitle;
    }

    // Page indicator numbers
    const padIndex = String(state.currentSpread).padStart(2, '0');
    const padTotal = String(state.totalSpreads).padStart(2, '0');
    if (this.pageIndicator) {
      this.pageIndicator.textContent = padIndex;
    }
    if (this.totalSpreadsIndicator) {
      this.totalSpreadsIndicator.textContent = padTotal;
    }
    if (this.activeFolioBadge) {
      this.activeFolioBadge.textContent = `Active: ${padIndex}`;
    }

    // Navigation button disabled state
    if (this.prevSpreadBtn) {
      this.prevSpreadBtn.disabled = state.isFirst;
      this.prevSpreadBtn.style.opacity = state.isFirst ? '0.35' : '1';
      this.prevSpreadBtn.style.cursor = state.isFirst ? 'not-allowed' : 'pointer';
    }
    if (this.nextSpreadBtn) {
      this.nextSpreadBtn.disabled = state.isLast;
      this.nextSpreadBtn.style.opacity = state.isLast ? '0.35' : '1';
      this.nextSpreadBtn.style.cursor = state.isLast ? 'not-allowed' : 'pointer';
    }

    // Hotspot affordances
    if (this.prevHotspot) {
      this.prevHotspot.style.display = state.isFirst ? 'none' : 'flex';
    }
    if (this.nextHotspot) {
      this.nextHotspot.style.display = state.isLast ? 'none' : 'flex';
    }

    // Curatorial annotations update
    if (this.annotationText1 && state.spreadData.annotation1) {
      this.annotationText1.textContent = state.spreadData.annotation1;
    }
    if (this.annotationText2 && state.spreadData.annotation2) {
      this.annotationText2.textContent = state.spreadData.annotation2;
    }

    // Update folio jump grid buttons active class
    if (this.drawerFolioGrid) {
      const buttons = this.drawerFolioGrid.querySelectorAll('button');
      buttons.forEach((btn, idx) => {
        const spreadNum = idx + 1;
        if (spreadNum === state.currentSpread) {
          btn.className = 'py-2.5 rounded-md bg-primary text-on-primary font-label-mono-num text-label-mono-num font-semibold text-center shadow-sm';
        } else {
          btn.className = 'py-2.5 rounded-md bg-surface-container text-on-surface-variant hover:text-on-surface font-label-mono-num text-label-mono-num text-center transition-colors';
        }
      });
    }

    // Trigger toast if turning
    if (state.isTurning && this.pageTurningToast) {
      this.pageTurningToast.textContent = `Leafing Folio ${padIndex} / ${padTotal} • Paper Dynamics Active`;
      this.pageTurningToast.classList.remove('opacity-0');
      clearTimeout(this.toastTimeout);
      this.toastTimeout = setTimeout(() => {
        if (this.pageTurningToast) this.pageTurningToast.classList.add('opacity-0');
      }, 950);
    }
  }

  initInspector() {
    // Populate Folio jump grid in drawer
    if (this.drawerFolioGrid) {
      this.drawerFolioGrid.innerHTML = '';
      config.spreads.forEach((spread, idx) => {
        const num = idx + 1;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = String(num).padStart(2, '0');
        btn.setAttribute('aria-label', `Jump to folio spread ${num}`);
        btn.addEventListener('click', () => {
          this.presentation.goToSpread(num);
        });
        this.drawerFolioGrid.appendChild(btn);
      });
    }

    // Populate Slide replacement dropdown
    if (this.slideSelectInput) {
      this.slideSelectInput.innerHTML = '';
      config.slides.forEach((slidePath, idx) => {
        const opt = document.createElement('option');
        opt.value = idx;
        opt.textContent = `Slide ${String(idx + 1).padStart(2, '0')}: ${slidePath.split('/').pop()}`;
        this.slideSelectInput.appendChild(opt);
      });

      this.slideSelectInput.addEventListener('change', () => {
        this.updateSlideThumbnail();
      });
      this.updateSlideThumbnail();
    }
  }

  updateSlideThumbnail() {
    if (!this.slideSelectInput || !this.slideThumbPreview) return;
    const slideIdx = parseInt(this.slideSelectInput.value, 10);
    const currentPath = config.slides[slideIdx] || '';
    this.slideThumbPreview.src = currentPath;
  }

  setupReplacementInputs() {
    // 1. Slide Image Replacement
    if (this.slideFileInput && this.slideSelectInput) {
      this.slideFileInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        const slideIdx = parseInt(this.slideSelectInput.value, 10);
        const objectUrl = URL.createObjectURL(file);
        this.activeObjectUrls.add(objectUrl);

        // Update local thumbnail preview
        if (this.slideThumbPreview) {
          this.slideThumbPreview.src = objectUrl;
        }

        // Apply immediately to Three.js book page
        this.bookScene.replaceSlidePreview(slideIdx, objectUrl);

        // Feedback toast
        if (this.pageTurningToast) {
          this.pageTurningToast.textContent = `Applied temporary preview to Slide ${String(slideIdx + 1).padStart(2, '0')}`;
          this.pageTurningToast.classList.remove('opacity-0');
          setTimeout(() => this.pageTurningToast.classList.add('opacity-0'), 2500);
        }
      });
    }

    // 2. Cover Replacements
    const handleCoverInput = (inputElem, coverType) => {
      if (!inputElem) return;
      inputElem.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const objectUrl = URL.createObjectURL(file);
        this.activeObjectUrls.add(objectUrl);
        this.bookScene.replaceCoverPreview(coverType, objectUrl);

        if (this.pageTurningToast) {
          this.pageTurningToast.textContent = `Updated ${coverType} cover preview`;
          this.pageTurningToast.classList.remove('opacity-0');
          setTimeout(() => this.pageTurningToast.classList.add('opacity-0'), 2000);
        }
      });
    };

    handleCoverInput(this.frontCoverFileInput, 'front');
    handleCoverInput(this.backCoverFileInput, 'back');
    handleCoverInput(this.spineFileInput, 'spine');
  }

  setLighting(mode) {
    this.bookScene.setLightingAtmosphere(mode);

    if (mode === 'chiaroscuro') {
      this.lightEveningBtn.classList.add('bg-surface', 'text-on-surface', 'shadow-sm');
      this.lightEveningBtn.classList.remove('text-on-surface-variant');
      this.lightDayBtn.classList.remove('bg-surface', 'text-on-surface', 'shadow-sm');
      this.lightDayBtn.classList.add('text-on-surface-variant');

      if (this.galleryStage) this.galleryStage.classList.add('bg-surface-container-high');
      if (this.ambientBackdrop) {
        this.ambientBackdrop.classList.remove('opacity-90');
        this.ambientBackdrop.classList.add('opacity-40');
      }
    } else {
      this.lightDayBtn.classList.add('bg-surface', 'text-on-surface', 'shadow-sm');
      this.lightDayBtn.classList.remove('text-on-surface-variant');
      this.lightEveningBtn.classList.remove('bg-surface', 'text-on-surface', 'shadow-sm');
      this.lightEveningBtn.classList.add('text-on-surface-variant');

      if (this.galleryStage) this.galleryStage.classList.remove('bg-surface-container-high');
      if (this.ambientBackdrop) {
        this.ambientBackdrop.classList.remove('opacity-40');
        this.ambientBackdrop.classList.add('opacity-90');
      }
    }
  }

  toggleDrawer(open) {
    if (!this.inspectorDrawer || !this.drawerOverlay) return;
    if (open) {
      this.inspectorDrawer.classList.remove('translate-x-full');
      this.drawerOverlay.classList.remove('hidden');
      setTimeout(() => this.drawerOverlay.classList.remove('opacity-0'), 10);
    } else {
      this.inspectorDrawer.classList.add('translate-x-full');
      this.drawerOverlay.classList.add('opacity-0');
      setTimeout(() => this.drawerOverlay.classList.add('hidden'), 500);
    }
  }

  updateAudioIcons(enabled) {
    const iconName = enabled ? 'volume_up' : 'volume_off';
    [this.dockAudioBtn, this.topAudioBtn].forEach((btn) => {
      if (!btn) return;
      const icon = btn.querySelector('.material-symbols-outlined');
      if (icon) icon.textContent = iconName;
      if (enabled) {
        btn.classList.remove('text-outline');
      } else {
        btn.classList.add('text-outline');
      }
    });
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      this.updateFullscreenIcons(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        this.updateFullscreenIcons(false);
      }
    }
  }

  updateFullscreenIcons(isFullscreen) {
    const iconName = isFullscreen ? 'fullscreen_exit' : 'crop_free';
    [this.dockFullscreenBtn, this.topFullscreenBtn].forEach((btn) => {
      if (!btn) return;
      const icon = btn.querySelector('.material-symbols-outlined');
      if (icon) icon.textContent = iconName;
    });
  }

  cleanup() {
    // Revoke any created object URLs to prevent memory leaks
    this.activeObjectUrls.forEach((url) => {
      URL.revokeObjectURL(url);
    });
    this.activeObjectUrls.clear();
  }
}
