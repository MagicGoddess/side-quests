// Visual metering utilities for audio levels

export class AudioMeter {
  constructor(stream) {
    this.audioContext = null;
    this.analyser = null;
    this.dataArray = null;
    this.source = null;
    this.isActive = false;
    
    if (stream) {
      this.connect(stream);
    }
  }

  connect(stream) {
    try {
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) return false;

      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;
      
      this.source = this.audioContext.createMediaStreamSource(stream);
      this.source.connect(this.analyser);
      
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      this.isActive = true;
      return true;
    } catch (err) {
      console.warn('Failed to setup audio metering:', err);
      return false;
    }
  }

  /**
   * Get current audio level (0-100)
   */
  getLevel() {
    if (!this.isActive || !this.analyser || !this.dataArray) return 0;
    
    this.analyser.getByteFrequencyData(this.dataArray);
    
    // Calculate RMS (root mean square) for more accurate level
    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      sum += this.dataArray[i] * this.dataArray[i];
    }
    const rms = Math.sqrt(sum / this.dataArray.length);
    return Math.min(100, (rms / 255) * 100);
  }

  disconnect() {
    this.isActive = false;
    if (this.source) {
      try { this.source.disconnect(); } catch {}
      this.source = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try { this.audioContext.close(); } catch {}
    }
    this.audioContext = null;
    this.analyser = null;
    this.dataArray = null;
  }
}

/**
 * Create a visual meter element
 */
export function createMeterElement(label = 'Audio Level') {
  const wrapper = document.createElement('div');
  wrapper.className = 'flex items-center gap-3 text-sm';
  
  const labelEl = document.createElement('div');
  labelEl.className = 'text-slate-300 min-w-0 flex-shrink-0';
  labelEl.textContent = label;
  
  const meterContainer = document.createElement('div');
  meterContainer.className = 'flex-1 bg-black/40 rounded-full h-2 overflow-hidden border border-white/10';
  
  const meterBar = document.createElement('div');
  meterBar.className = 'h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 transition-all duration-75 ease-out';
  meterBar.style.width = '0%';
  
  const levelText = document.createElement('div');
  levelText.className = 'text-slate-400 text-xs min-w-0 flex-shrink-0 w-8';
  levelText.textContent = '0%';
  
  meterContainer.appendChild(meterBar);
  wrapper.appendChild(labelEl);
  wrapper.appendChild(meterContainer);
  wrapper.appendChild(levelText);
  
  return { element: wrapper, bar: meterBar, text: levelText };
}

/**
 * Update meter display
 */
export function updateMeter(meterElements, level) {
  const { bar, text } = meterElements;
  const percentage = Math.round(level);
  bar.style.width = `${percentage}%`;
  text.textContent = `${percentage}%`;
  
  // Color based on level
  if (level > 80) {
    bar.style.background = 'linear-gradient(to right, #ef4444, #dc2626)'; // Red
  } else if (level > 60) {
    bar.style.background = 'linear-gradient(to right, #f59e0b, #d97706)'; // Yellow
  } else {
    bar.style.background = 'linear-gradient(to right, #10b981, #059669)'; // Green
  }
}

/**
 * Recording timer utility
 */
export class RecordingTimer {
  constructor() {
    this.startTime = null;
    this.intervalId = null;
    this.onUpdate = null;
  }

  start(callback) {
    this.startTime = Date.now();
    this.onUpdate = callback;
    this.intervalId = setInterval(() => {
      const elapsed = Date.now() - this.startTime;
      const seconds = Math.floor(elapsed / 1000);
      const minutes = Math.floor(seconds / 60);
      const displaySeconds = seconds % 60;
      const timeStr = `${minutes.toString().padStart(2, '0')}:${displaySeconds.toString().padStart(2, '0')}`;
      if (this.onUpdate) this.onUpdate(timeStr, elapsed);
    }, 1000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.startTime = null;
    this.onUpdate = null;
  }

  getElapsed() {
    return this.startTime ? Date.now() - this.startTime : 0;
  }
}