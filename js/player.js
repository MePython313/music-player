const HyperPlayerPlayer = {
  audio: null,
  ctx: null,
  analyser: null,
  currentBlobUrl: null,
  queue: [],
  onTrackChange: null,
  onTimeUpdate: null,
  onEnded: null,
  onPlayStateChange: null,

  init(audioId) {
    this.audio = document.getElementById(audioId);

    this.audio.addEventListener('timeupdate', () => {
      if (this.onTimeUpdate) this.onTimeUpdate();
    });

    this.audio.addEventListener('ended', () => {
      if (this.queue.length) {
        const next = this.queue.shift();
        this.load(next);
      } else if (this.onEnded) {
        this.onEnded();
      }
    });

    this.audio.addEventListener('play', () => {
      if (this.onPlayStateChange) this.onPlayStateChange(true);
    });

    this.audio.addEventListener('pause', () => {
      if (this.onPlayStateChange) this.onPlayStateChange(false);
    });

    this.audio.addEventListener('error', (e) => {
      console.error('Audio error:', e);
    });
  },

  async initContext() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    // createMediaElementSource can only be called once per <audio>
    this.src = this.ctx.createMediaElementSource(this.audio);
    this.src.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
    HyperPlayerVisualizer.start(this.analyser);
  },

  async load(file) {
    if (!this.ctx) await this.initContext();
    if (this.ctx.state === 'suspended') await this.ctx.resume();

    this.audio.pause();
    if (this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl);
      this.currentBlobUrl = null;
    }
    this.audio.removeAttribute('src');
    this.audio.load();

    this.currentBlobUrl = URL.createObjectURL(file);
    this.audio.src = this.currentBlobUrl;

    try {
      if (this.audio.readyState >= 2) {
        await this.audio.play();
      } else {
        await new Promise((resolve, reject) => {
          this.audio.onloadeddata = resolve;
          this.audio.onerror = () => reject(new Error('Failed to load audio'));
        });
        await this.audio.play();
      }
    } catch (err) {
      console.error(err);
      return;
    }

    if (this.onTrackChange) this.onTrackChange(file);
  },

  play() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    if (this.audio.src) this.audio.play();
  },

  pause() {
    this.audio.pause();
  },

  togglePlay() {
    this.audio.paused ? this.play() : this.pause();
  },

  seek(percent) {
    if (this.audio.duration && isFinite(this.audio.duration)) {
      this.audio.currentTime = percent * this.audio.duration;
    }
  },

  seekBy(seconds) {
    if (this.audio.duration && isFinite(this.audio.duration)) {
      this.audio.currentTime = Math.max(0, Math.min(this.audio.duration, this.audio.currentTime + seconds));
    }
  },

  setVolume(val) {
    const v = Math.max(0, Math.min(1, val));
    this.audio.volume = v;
    HyperPlayerStorage.setVolume(v);
  },

  getVolume() {
    return this.audio.volume;
  },

  getCurrentTime() {
    return this.audio.currentTime || 0;
  },

  getDuration() {
    return this.audio.duration || 0;
  },

  isPaused() {
    return this.audio.paused;
  },

  addToQueue(file) {
    this.queue.push(file);
  },

  clearQueue() {
    this.queue = [];
  },

  destroy() {
    if (this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl);
      this.currentBlobUrl = null;
    }
    this.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
  }
};
