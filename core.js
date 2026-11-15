'use strict';
/* =========================================================================
   CHICKEN BLAST – Kern: Canvas, Hilfsfunktionen, Speicher, Audio, Retro-Palette
   Ladereihenfolge: core.js -> worlds.js -> game.js
   ========================================================================= */

const cv = document.getElementById('game');
const mainCtx = cv.getContext('2d');
let ctx = mainCtx;
// Retro: Spielwelt wird in niedriger Auflösung gerendert und auf eine kleine Palette reduziert
const PIX = 0.4;
const loCanvas = document.createElement('canvas');
const lctx = loCanvas.getContext('2d', { willReadFrequently: true });
let KL = PIX;

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const rint = (a, b) => Math.floor(rand(a, b + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/* ---------------------------------------------------------------- Speicher */
const store = {
  get(k, d) { try { const v = localStorage.getItem('chickenblast_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('chickenblast_' + k, JSON.stringify(v)); } catch (e) {} },
};
const Settings = { gore: store.get('gore', true), sound: store.get('sound', true) };

/* ---------------------------------------------------------------- Layout */
let W = 1280, H = 720, K = 1, viewScale = 1;
let bgCanvas = null, decalCanvas = null, dctx = null;
const HORIZON = () => H * 0.56;
const groundY = z => H * 0.6 + z * H * 0.37;

/* ---------------------------------------------------------------- Zeichenhilfen */
function ell(g, x, y, rx, ry, rot = 0) { g.beginPath(); g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU); }
function circ(g, x, y, r) { g.beginPath(); g.arc(x, y, Math.max(0.1, r), 0, TAU); }
function rrect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
const FONT = '"Press Start 2P", "Courier New", monospace';
function txt(s, x, y, size, col = '#fff', align = 'center', stroke = '#3b1600') {
  size = Math.round(size * 0.62);
  ctx.font = `${size}px ${FONT}`;
  ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  if (stroke) { ctx.lineWidth = Math.max(4, size * 0.35); ctx.strokeStyle = stroke; ctx.strokeText(s, x, y); }
  ctx.fillStyle = col; ctx.fillText(s, x, y);
}

/* ---------------------------------------------------------------- Palette (32 Farben je Welt) + Dithering */
const LUT = new Uint32Array(32768);
function setPalette(hexes) {
  const pal = hexes.map(h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
  for (let i = 0; i < 32768; i++) {
    const r = ((i >> 10) & 31) * 8 + 4, g = ((i >> 5) & 31) * 8 + 4, b = (i & 31) * 8 + 4;
    let best = 0, bd = Infinity;
    for (const [pr, pg, pb] of pal) {
      const d = 2 * (r - pr) ** 2 + 4 * (g - pg) ** 2 + 3 * (b - pb) ** 2;
      if (d < bd) { bd = d; best = (255 << 24) | (pb << 16) | (pg << 8) | pr; }
    }
    LUT[i] = best >>> 0;
  }
}
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v - 7.5) * 1.6);
function quantize() {
  const w = loCanvas.width, h = loCanvas.height;
  const img = lctx.getImageData(0, 0, w, h);
  const d = new Uint32Array(img.data.buffer);
  for (let y = 0, i = 0; y < h; y++) {
    const row = (y & 3) * 4;
    for (let x = 0; x < w; x++, i++) {
      const v = d[i], t = BAYER[row + (x & 3)];
      let r = (v & 255) + t, g = ((v >> 8) & 255) + t, b = ((v >> 16) & 255) + t;
      r = r < 0 ? 0 : r > 255 ? 255 : r; g = g < 0 ? 0 : g > 255 ? 255 : g; b = b < 0 ? 0 : b > 255 ? 255 : b;
      d[i] = LUT[((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)];
    }
  }
  lctx.putImageData(img, 0, 0);
}

/* ---------------------------------------------------------------- Audio (alles synthetisch) */
const Snd = {
  ctx: null, master: null, noise: null, lastSplat: 0, lastVoice: 0, hum: null,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = 0.55;
    const comp = this.ctx.createDynamicsCompressor();
    this.master.connect(comp); comp.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 2;
    const b = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = b;
  },
  ok() { return Settings.sound && this.ctx && this.ctx.state === 'running'; },
  nz(dur, type, f0, f1, vol, q = 1, delay = 0, dest = null) {
    const c = this.ctx, t = c.currentTime + delay;
    const src = c.createBufferSource(); src.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(dest || this.master);
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
  },
  tone(type, f0, f1, dur, vol, delay = 0) {
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  },
  // Verzerrer-Bus: macht den Schuss "dreckig" und auch auf Handylautsprechern hörbar
  crunch() {
    if (this.dist) return this.dist;
    const ws = this.ctx.createWaveShaper(), n = 1024, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; curve[i] = Math.tanh(3.2 * x) / Math.tanh(3.2); }
    ws.curve = curve;
    const g = this.ctx.createGain(); g.gain.value = 0.8;
    ws.connect(g); g.connect(this.master);
    return (this.dist = ws);
  },
  // Schrotflinte: Knall (Mitten/Höhen für Handys) + Bass + Echo, danach Repetieren
  shot() {
    if (!this.ok()) return;
    const d = this.crunch();
    this.nz(0.14, 'bandpass', 2600, 1100, 1.6, 0.8, 0, d);
    this.nz(0.6, 'lowpass', 6500, 280, 1.2, 0.7, 0, d);
    this.nz(0.03, 'highpass', 5000, 4000, 0.8);
    this.tone('sine', 150, 42, 0.32, 0.9);
    this.tone('square', 220, 60, 0.12, 0.12);
    this.nz(0.35, 'bandpass', 1200, 500, 0.32, 1, 0.13);
    this.nz(0.5, 'bandpass', 800, 380, 0.16, 1, 0.32);
  },
  pump(delay = 0) {
    if (!this.ok()) return;
    this.nz(0.05, 'bandpass', 2800, 2000, 0.8, 4, delay);
    this.tone('square', 900, 500, 0.03, 0.05, delay);
    this.nz(0.07, 'bandpass', 1500, 900, 0.9, 3, delay + 0.09);
    this.tone('square', 600, 300, 0.04, 0.06, delay + 0.09);
  },
  harpoon() {
    if (!this.ok()) return;
    this.nz(0.08, 'highpass', 3000, 1500, 0.6);
    this.tone('triangle', 180, 90, 0.25, 0.5);
    this.nz(0.35, 'bandpass', 2500, 600, 0.5, 4, 0.03);
    this.tone('sawtooth', 420, 260, 0.3, 0.06, 0.02);
  },
  empty() { if (!this.ok()) return; this.nz(0.03, 'highpass', 5000, 4000, 0.5); this.tone('square', 1400, 1000, 0.03, 0.06); },
  reload() {
    if (!this.ok()) return;
    this.nz(0.05, 'bandpass', 2500, 1800, 0.7, 3);
    this.nz(0.12, 'bandpass', 900, 500, 0.6, 2, 0.12);
    this.nz(0.05, 'highpass', 3500, 3000, 0.8, 1, 0.3);
    this.tone('square', 300, 200, 0.04, 0.08, 0.3);
  },
  click() { if (!this.ok()) return; this.nz(0.04, 'bandpass', 2200, 1600, 0.6, 3); this.tone('square', 500, 300, 0.04, 0.06); },
  splat(big = 1) {
    if (!this.ok()) return;
    const now = performance.now(); if (now - this.lastSplat < 40) return; this.lastSplat = now;
    this.nz(0.28 * big, 'lowpass', 2200, 150, 0.9, 3);
    this.nz(0.18, 'bandpass', 1200, 250, 0.7, 6, 0.02);
    this.tone('sine', 260, 55, 0.16, 0.5);
    this.tone('sine', rand(2600, 3400), rand(1200, 1600), 0.09, 0.08);
  },
  splash() { if (!this.ok()) return; this.nz(0.3, 'bandpass', 1800, 500, 0.35, 1.5); this.nz(0.15, 'highpass', 4000, 2500, 0.15, 1, 0.05); },
  glass() {
    if (!this.ok()) return;
    this.nz(0.25, 'highpass', 6000, 3000, 0.6, 2);
    for (let i = 0; i < 4; i++) this.tone('sine', rand(3000, 5200), rand(2500, 4000), 0.12, 0.05, i * 0.03);
  },
  // Stimmen der Gegner
  voice(kind, p = 1, vol = 0.05) {
    if (!this.ok()) return;
    const now = performance.now(); if (now - this.lastVoice < 90) return; this.lastVoice = now;
    switch (kind) {
      case 'peep': this.tone('sine', 2500 * p, 3300 * p, 0.06, vol); this.tone('sine', 3100 * p, 2300 * p, 0.07, vol, 0.08); break;
      case 'squawk': this.tone('sawtooth', 820 * p, 420, 0.18, vol * 2.4); this.tone('sawtooth', 700 * p, 380, 0.22, vol * 2, 0.16); break;
      case 'quack': this.tone('sawtooth', 560 * p, 380 * p, 0.11, vol * 1.6); this.tone('square', 540 * p, 360 * p, 0.1, vol * 0.8); break;
      case 'croak': this.tone('square', 150 * p, 95 * p, 0.12, vol * 1.6); this.tone('square', 140 * p, 90 * p, 0.14, vol * 1.6, 0.13); break;
      case 'honk': this.tone('sawtooth', 330 * p, 260 * p, 0.28, vol * 2.2); break;
      case 'blip': this.tone('sine', 700 * p, 1700 * p, 0.07, vol * 1.4); this.tone('square', 1400 * p, 500 * p, 0.08, vol * 0.6, 0.08); break;
    }
  },
  boom() {
    if (!this.ok()) return;
    this.nz(1.4, 'lowpass', 2800, 50, 1.3, 0.6);
    this.tone('sine', 110, 24, 0.9, 1.0);
    this.nz(0.3, 'highpass', 3000, 1000, 0.5);
  },
  ding() { if (!this.ok()) return; this.tone('triangle', 1318, 1318, 0.15, 0.25); this.tone('triangle', 1975, 1975, 0.35, 0.25, 0.09); },
  multi() { if (!this.ok()) return; [880, 1108, 1318, 1760].forEach((f, i) => this.tone('square', f, f, 0.09, 0.06, i * 0.05)); },
  fanfare() { if (!this.ok()) return; [523, 659, 784, 1046, 784, 1046].forEach((f, i) => this.tone('square', f, f, 0.14, 0.08, i * 0.11)); },
  // Laser: Dauerton solange gefeuert wird
  laserOn() {
    if (!this.ok() || this.hum) return;
    const c = this.ctx, t = c.currentTime;
    const o1 = c.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 95;
    const o2 = c.createOscillator(); o2.type = 'square'; o2.frequency.value = 190.5;
    const lfo = c.createOscillator(); lfo.frequency.value = 14;
    const lg = c.createGain(); lg.gain.value = 30; lfo.connect(lg); lg.connect(o2.frequency);
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1500;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.05);
    o1.connect(f); o2.connect(f); f.connect(g); g.connect(this.master);
    o1.start(); o2.start(); lfo.start();
    this.hum = { o1, o2, lfo, g };
    this.tone('sine', 2400, 600, 0.12, 0.15);
  },
  laserHeat(h) { if (this.hum) this.hum.o1.frequency.setTargetAtTime(95 + h * 90, this.ctx.currentTime, 0.05); },
  laserOff() {
    if (!this.hum) return;
    const { o1, o2, lfo, g } = this.hum, t = this.ctx.currentTime;
    g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    [o1, o2, lfo].forEach(o => o.stop(t + 0.1));
    this.hum = null;
  },
  overheat() {
    if (!this.ok()) return;
    this.nz(0.9, 'highpass', 5000, 1500, 0.5, 1);
    this.tone('square', 220, 110, 0.3, 0.12); this.tone('square', 220, 110, 0.3, 0.12, 0.35);
  },
};
