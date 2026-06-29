const BAR_COUNT = 16;

const HyperPlayerVisualizer = {
  canvas: null,
  ctx: null,
  analyser: null,
  data: new Uint8Array(128),
  smooth: null,
  mode: 'bars',
  running: true,
  time: 0,
  _circleRot: 0,

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
    this.smooth = new Float32Array(BAR_COUNT);
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
    } else if (this.mode === 'circle') {
      this.drawCircle(w, h);
    } else {
      this.drawBars(w, h);
    }
  },

  drawIdle(w, h) {
    const accent = this.getAccent();
    const ctx = this.ctx;
    const t = this.time / 60;
    const maxDim = Math.min(w, h);

    if (this.mode === 'circle') {
      this.drawCircleIdle(w, h, accent);
      return;
    }

    const offsetX = w * 0.25;
    const areaW = w - offsetX - 10;
    const gap = 4;
    const totalGap = gap * (BAR_COUNT - 1);
    const barW = (areaW - totalGap) / BAR_COUNT;
    const radius = Math.min(barW * 0.4, 10);

    ctx.fillStyle = accent + '18';
    ctx.beginPath();
    for (let i = 0; i < BAR_COUNT; i++) {
      const barH = h * 0.06 * (0.6 + 0.4 * Math.sin(t + i * 0.35));
      ctx.roundRect(offsetX + i * (barW + gap), h - barH, barW, barH, radius);
    }
    ctx.fill();
  },

  drawCircleIdle(w, h, accent) {
    const ctx = this.ctx;
    const cx = w / 2;
    const cy = h / 2;
    const maxR = Math.min(cx, cy) * 0.5;
    const t = this.time / 60;
    const segments = 60;
    const angleStep = (Math.PI * 2) / segments;

    ctx.save();
    ctx.shadowColor = accent;
    ctx.shadowBlur = 8;
    ctx.strokeStyle = accent + '30';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();

    for (let i = 0; i <= segments; i++) {
      const idx = i % segments;
      const r = maxR * (0.6 + 0.4 * Math.sin(t + idx * 0.25));
      const angle = angleStep * i + t * 0.1;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  },

  drawPulseCircle(ctx, accent, cx, cy, baseR, pulseAmp) {
    const r = baseR + pulseAmp * baseR * 1.5;
    ctx.save();
    ctx.shadowColor = accent;
    ctx.shadowBlur = 25;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, accent);
    grad.addColorStop(0.35, accent + 'cc');
    grad.addColorStop(1, accent + '00');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  drawBars(w, h) {
    const accent = this.getAccent();
    const ctx = this.ctx;
    const halfLen = this.data.length / 2;

    // Only use left half of frequency data (low-mid frequencies)
    const raw = new Float32Array(BAR_COUNT);
    for (let i = 0; i < BAR_COUNT; i++) {
      let sum = 0;
      const start = Math.floor(i * halfLen / BAR_COUNT);
      const end = Math.floor((i + 1) * halfLen / BAR_COUNT);
      const count = end - start;
      for (let j = start; j < end; j++) {
        sum += this.data[j];
      }
      raw[i] = count > 0 ? sum / count : 0;
    }

    // Asymmetric smoothing: fast rise, slow fall
    for (let i = 0; i < BAR_COUNT; i++) {
      const diff = raw[i] - this.smooth[i];
      if (diff > 0) {
        this.smooth[i] += diff * 0.35;
      } else {
        this.smooth[i] += diff * 0.12;
      }
    }

    // Accent gradient
    const grad = ctx.createLinearGradient(0, h, 0, 0);
    grad.addColorStop(0, accent + '60');
    grad.addColorStop(1, accent);
    ctx.fillStyle = grad;

    // Glow
    ctx.shadowColor = accent;
    ctx.shadowBlur = 10;

    // Draw bars on the right portion of the canvas
    const offsetX = w * 0.25;
    const areaW = w - offsetX - 10;
    const gap = 4;
    const totalGap = gap * (BAR_COUNT - 1);
    const barW = (areaW - totalGap) / BAR_COUNT;
    const radius = Math.min(barW * 0.4, 10);

    ctx.beginPath();
    for (let i = 0; i < BAR_COUNT; i++) {
      const barH = (this.smooth[i] / 255) * h;
      if (barH < 2) continue;
      ctx.roundRect(offsetX + i * (barW + gap), h - barH, barW, barH, radius);
    }
    ctx.fill();
    ctx.shadowBlur = 0;
  },

  drawCircle(w, h) {
    const accent = this.getAccent();
    const ctx = this.ctx;
    const cx = w / 2;
    const cy = h / 2;
    const maxR = Math.min(cx, cy) * 0.75;
    const halfLen = this.data.length / 2;
    const segments = 90;
    const angleStep = (Math.PI * 2) / segments;
    const groupSize = halfLen / segments;

    // Average left-half freq data into segments
    const vals = new Float32Array(segments);
    for (let i = 0; i < segments; i++) {
      let sum = 0;
      const start = Math.floor(i * groupSize);
      const end = Math.floor((i + 1) * groupSize);
      const count = end - start;
      for (let j = start; j < end; j++) {
        sum += this.data[j];
      }
      vals[i] = count > 0 ? sum / count / 255 : 0;
    }

    // Rotate slowly
    this._circleRot = (this._circleRot + 0.3) % 360;
    const rot = (this._circleRot * Math.PI) / 180;

    const baseR = maxR * 0.45;
    const ampR = maxR * 0.4;

    // Connected ring path
    ctx.save();
    ctx.shadowColor = accent;
    ctx.shadowBlur = 15;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.beginPath();

    for (let i = 0; i <= segments; i++) {
      const idx = i % segments;
      const r = baseR + vals[idx] * ampR;
      const angle = angleStep * i + rot;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    // Center glow
    let bassSum = 0;
    const bassCount = Math.min(4, segments);
    for (let i = 0; i < bassCount; i++) {
      bassSum += vals[i];
    }
    this.drawPulseCircle(ctx, accent, cx, cy, maxR * 0.08, bassSum / bassCount);
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
    const modes = ['bars', 'wave', 'circle'];
    this.mode = modes[(modes.indexOf(this.mode) + 1) % modes.length];
  }
};
