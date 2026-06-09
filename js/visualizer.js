const HyperPlayerVisualizer = {
  canvas: null,
  ctx: null,
  analyser: null,
  data: new Uint8Array(128),
  mode: 'bars',
  running: true,
  time: 0,

  init(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.draw();
  },

  resize() {
    this.canvas.width = this.canvas.clientWidth;
    this.canvas.height = this.canvas.clientHeight;
  },

  start(analyser) {
    this.analyser = analyser;
    this.data = new Uint8Array(analyser.frequencyBinCount);
  },

  stop() {
    this.analyser = null;
  },

  getAccent() {
    return getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#6ea8ff';
  },

  draw() {
    requestAnimationFrame(() => this.draw());
    this.time = (this.time + 1) % 1000;
    const w = this.canvas.width;
    const h = this.canvas.height;
    if (!w || !h) return;

    this.ctx.clearRect(0, 0, w, h);

    if (!this.analyser) {
      this.drawIdle(w, h);
      return;
    }

    this.analyser.getByteFrequencyData(this.data);

    if (this.mode === 'wave') {
      this.drawWave(w, h);
    } else {
      this.drawBars(w, h);
    }
  },

  drawIdle(w, h) {
    const accent = this.getAccent();
    const t = this.time / 60;
    const barCount = 24;
    const barW = w / barCount;
    for (let i = 0; i < barCount; i++) {
      const barH = h * 0.06 * (0.6 + 0.4 * Math.sin(t + i * 0.35));
      this.ctx.fillStyle = accent + '18';
      this.ctx.fillRect(i * barW + 1, h - barH, barW - 2, barH);
    }
  },

  drawBars(w, h) {
    const accent = this.getAccent();
    const grad = this.ctx.createLinearGradient(0, h, 0, 0);
    grad.addColorStop(0, accent + '60');
    grad.addColorStop(1, accent);
    this.ctx.fillStyle = grad;

    const len = this.data.length;
    const barW = w / len;
    for (let i = 0; i < len; i++) {
      const barH = (this.data[i] / 255) * h;
      if (barH < 1) continue;
      this.ctx.fillRect(i * barW, h - barH, Math.max(barW - 0.5, 1), barH);
    }
  },

  drawWave(w, h) {
    const accent = this.getAccent();
    this.ctx.strokeStyle = accent;
    this.ctx.lineWidth = 2;
    this.ctx.shadowColor = accent;
    this.ctx.shadowBlur = 8;
    this.ctx.beginPath();
    const len = this.data.length;
    const step = Math.max(1, Math.floor(len / w));
    for (let i = 0; i < w; i++) {
      const idx = Math.min(i * step, len - 1);
      const y = h / 2 + ((this.data[idx] / 255) * h * 0.4 - h * 0.2);
      i === 0 ? this.ctx.moveTo(i, y) : this.ctx.lineTo(i, y);
    }
    this.ctx.stroke();
    this.ctx.shadowBlur = 0;
  },

  toggleMode() {
    this.mode = this.mode === 'bars' ? 'wave' : 'bars';
  }
};
