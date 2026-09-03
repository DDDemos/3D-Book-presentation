/**
 * Atelier Presentation State Manager & Audio Synthesizer
 */

import { config } from './config.js';

export class PresentationManager {
  constructor(bookScene) {
    this.bookScene = bookScene;
    this.currentSpread = 4; // Spread 4 by default as shown in Stitch design
    this.totalSpreads = config.spreads.length;
    this.isAudioEnabled = true;
    this.audioContext = null;
    this.listeners = [];

    // Pre-bind turn complete
    this.onTurnFinished = (newSpreadIndex) => {
      this.currentSpread = newSpreadIndex;
      this.notifyStateChange();
    };
  }

  subscribe(callback) {
    this.listeners.push(callback);
    // Immediately invoke with current state
    callback(this.getState());
  }

  notifyStateChange() {
    const state = this.getState();
    this.listeners.forEach((fn) => fn(state));
  }

  getState() {
    const spreadData = config.spreads[this.currentSpread - 1] || config.spreads[0];
    return {
      currentSpread: this.currentSpread,
      totalSpreads: this.totalSpreads,
      isFirst: this.currentSpread <= 1,
      isLast: this.currentSpread >= this.totalSpreads,
      spreadData: spreadData,
      isAudioEnabled: this.isAudioEnabled,
      isTurning: this.bookScene.isTurning
    };
  }

  next() {
    if (this.currentSpread >= this.totalSpreads || this.bookScene.isTurning) {
      return false;
    }
    this.playPaperRustle();
    const started = this.bookScene.turnPage('next', this.onTurnFinished);
    if (started) {
      this.notifyStateChange();
    }
    return started;
  }

  previous() {
    if (this.currentSpread <= 1 || this.bookScene.isTurning) {
      return false;
    }
    this.playPaperRustle();
    const started = this.bookScene.turnPage('prev', this.onTurnFinished);
    if (started) {
      this.notifyStateChange();
    }
    return started;
  }

  goToSpread(index) {
    if (index < 1 || index > this.totalSpreads || this.bookScene.isTurning) {
      return false;
    }
    if (index === this.currentSpread) return true;

    this.playPaperRustle();
    const dir = index > this.currentSpread ? 'next' : 'prev';
    // If adjacent, animate turn
    if (Math.abs(index - this.currentSpread) === 1) {
      const started = this.bookScene.turnPage(dir, this.onTurnFinished);
      if (started) {
        this.notifyStateChange();
      }
      return started;
    } else {
      // Instant switch
      this.currentSpread = index;
      this.bookScene.updateSpreadContent(index, false);
      this.notifyStateChange();
      return true;
    }
  }

  toggleAudio() {
    this.isAudioEnabled = !this.isAudioEnabled;
    this.notifyStateChange();
    return this.isAudioEnabled;
  }

  /**
   * Tactile Paper Rustle Sound Generator using Web Audio API
   * Generates realistic cotton rag friction and air swoosh without external assets.
   */
  playPaperRustle() {
    if (!this.isAudioEnabled) return;

    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;

      if (!this.audioContext) {
        this.audioContext = new AudioContext();
      }
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }

      const ctx = this.audioContext;
      const duration = 0.65;
      const bufferSize = ctx.sampleRate * duration;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);

      // Pinkish noise with low-frequency swoosh and dry paper friction crackle
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99765 * b0 + white * 0.0990460;
        b1 = 0.96300 * b1 + white * 0.2965164;
        b2 = 0.57000 * b2 + white * 1.0526913;
        const pink = (b0 + b1 + b2 + white * 0.1848) * 0.05;
        // Envelope: gentle attack, textured sustain, soft flutter decay
        const progress = i / bufferSize;
        const envelope = Math.sin(progress * Math.PI) * Math.pow(1.0 - progress, 0.4);
        data[i] = pink * envelope;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      // Bandpass filter to isolate paper-like flutter range (800Hz - 2400Hz)
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400, ctx.currentTime);
      filter.Q.setValueAtTime(1.2, ctx.currentTime);

      // Filter modulation simulating air rush during arc
      filter.frequency.exponentialRampToValueAtTime(750, ctx.currentTime + duration);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start();
    } catch (e) {
      console.warn('Paper audio rustle not available', e);
    }
  }
}
