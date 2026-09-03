/**
 * Main Application Entry Point
 * Orchestrates 3D Book Scene, Presentation Manager, and UI Controls.
 */

import { BookScene } from './book.js';
import { PresentationManager } from './presentation.js';
import { UIController } from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('bookContainer');
  const loader = document.getElementById('loadingIndicator');

  // Check WebGL availability
  if (!isWebGLAvailable()) {
    showWebGLError(container, loader);
    return;
  }

  try {
    const bookScene = new BookScene(container, () => {
      // Scene initialized successfully
      const presentation = new PresentationManager(bookScene);
      const ui = new UIController(bookScene, presentation);

      // Fade out loading indicator
      if (loader) {
        loader.classList.add('opacity-0');
        setTimeout(() => {
          loader.style.display = 'none';
        }, 600);
      }

      console.log('Atelier 3D Book Presentation Initialized Successfully.');
    });
  } catch (error) {
    console.error('Failed to initialize 3D scene:', error);
    showWebGLError(container, loader, error.message);
  }
});

function isWebGLAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
  } catch (e) {
    return false;
  }
}

function showWebGLError(container, loader, msg) {
  if (loader) loader.style.display = 'none';
  if (container) {
    container.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:2rem;text-align:center;color:#4a4640;">
        <span class="material-symbols-outlined" style="font-size:48px;color:#ba1a1a;margin-bottom:1rem;">view_in_ar</span>
        <h3 style="font-family:'Playfair Display',serif;font-size:22px;margin:0 0 0.5rem 0;color:#1b1c19;">Hardware Acceleration Required</h3>
        <p style="font-family:'Source Serif 4',serif;font-size:15px;max-width:480px;line-height:1.6;margin:0;">
          WebGL could not be initialized in this browser context. Please verify that hardware acceleration is enabled in your browser settings to inspect the interactive 3D monograph.
        </p>
        ${msg ? `<pre style="margin-top:1rem;font-size:11px;color:#7b766f;">${msg}</pre>` : ''}
      </div>
    `;
  }
}
