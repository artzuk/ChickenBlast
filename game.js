'use strict';
/* =========================================================================
   CHICKEN BLAST – Spiellogik: Zustand, Waffen, Gegner, Gore, Darstellung, Menüs, Eingabe
   ========================================================================= */

/* ---------------------------------------------------------------- Waffen */
const WEAPONS = {
  shotgun: { name: 'SCHROTFLINTE', short: 'SCHROT', ammo: 8, reload: 0.55, cool: 0.26 },
  harpoon: { name: 'HARPUNE', short: 'HARPUNE', ammo: 5, reload: 0.9, cool: 0.32 },
  laser:   { name: 'LASER', short: 'LASER' },
};
const WEAPON_ORDER = ['shotgun', 'harpoon', 'laser'];
const ROUND_TIME = 90;
const SPEAR_SPEED = 9;      // Tiefen-Einheiten pro Sekunde (perspektivisch)
const SPEAR_W0 = 1.3;
const SG_SCALE = 1.25;       // Größe der Flinte am Bildrand       // Perspektiv-Maßstab am Schützen (unterer Bildrand)

/* ---------------------------------------------------------------- Zustand */
const G = {
  state: 'menu', paused: false, t: 0, world: 0, weapon: 'shotgun',
  score: 0, time: ROUND_TIME, elapsed: 0, ammo: { shotgun: 8, harpoon: 5 }, reload: 0, cool: 0, switchT: 0,
  heat: 0, over: false, firing: false, laserTick: 0, burst: null,
  streak: 0, maxStreak: 0, kills: 0, shots: 0, hits: 0, heads: 0,
  spawnT: 0.5, shake: 0, flash: 0, recoil: 0, overT: 0, newBest: false, unlockedNew: null,
  pending: [], shotT: 9, eject: false, egg: null, eggCool: 0, wish: 0, keyBuf: '', titleTaps: [],
};
const newEggState = () => ({
  door: 0, doorHit: 0, doorOpen: false, aval: 0, avalT: 0, pads: {}, nova: 0, novaHit: 0, novaDone: false, wave: -1,
  silo: 0, siloHit: 0, siloOpen: false, grainT: 0, peckT: 0, sun: 0, sunHit: 0, sunset: false, cloud: 0, eggRain: 0, eggT: 0, eggCloud: null, hatch: [],
  anglerGone: false, monster: false, earth: 0, earthHit: 0, earthGone: false, landerGone: false,
});
G.egg = newEggState();
let chicks = [], parts = [], splats = [], slicks = [];
const progress = { unlocked: store.get('unlocked', 0), best: {}, eggs: store.get('eggs', []) };
for (const w of WORLDS) progress.best[w.id] = store.get('best_' + w.id, w.id === 'farm' ? store.get('best', 0) : 0);
const world = () => WORLDS[G.world];
const weaponsUnlocked = () => WORLDS.filter((w, i) => i <= progress.unlocked).map(w => w.weapon);

const mouse = { x: -100, y: -100, touch: !!(window.matchMedia && matchMedia('(pointer: coarse)').matches) };
const isPortrait = () => mouse.touch && window.innerHeight > window.innerWidth;
let buttons = [];
let paletteMode = '';

// Handy: Vollbild + Querformat erzwingen (geht nur nach einer Nutzeraktion)
function goFullscreenLandscape() {
  if (!mouse.touch) return;
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!document.fullscreenElement && !document.webkitFullscreenElement && req) {
    try {
      const pr = req.call(el, { navigationUI: 'hide' });
      if (pr && pr.then) pr.then(lockLandscape).catch(() => {});
    } catch (e) {}
  } else lockLandscape();
}
function lockLandscape() { try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) {} }

/* ---------------------------------------------------------------- Layout / Welt wechseln */
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const vw = window.innerWidth, vh = window.innerHeight;
  H = 720;
  W = Math.round(clamp((vw / vh) * H, 960, 1700));
  viewScale = Math.min(vw / W, vh / H);
  cv.style.width = Math.round(W * viewScale) + 'px';
  cv.style.height = Math.round(H * viewScale) + 'px';
  cv.width = Math.round(W * viewScale * dpr);
  cv.height = Math.round(H * viewScale * dpr);
  K = cv.width / W;
  loCanvas.width = Math.round(W * PIX); loCanvas.height = Math.round(H * PIX);
  KL = loCanvas.width / W;
  rebuildBg();
  const old = decalCanvas;
  decalCanvas = document.createElement('canvas');
  decalCanvas.width = loCanvas.width; decalCanvas.height = loCanvas.height;
  dctx = decalCanvas.getContext('2d');
  if (old) dctx.drawImage(old, 0, 0, decalCanvas.width, decalCanvas.height);
  dctx.setTransform(KL, 0, 0, KL, 0, 0);
}
function rebuildBg() {
  bgCanvas = document.createElement('canvas');
  bgCanvas.width = loCanvas.width; bgCanvas.height = loCanvas.height;
  const g = bgCanvas.getContext('2d');
  g.setTransform(KL, 0, 0, KL, 0, 0);
  // fester Zufalls-Startwert: Hintergrund sieht bei jedem Neuaufbau gleich aus
  const orig = Math.random; let seed = 1234567 + G.world * 999;
  Math.random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  try { world().bg(g, paletteMode === 'sunset'); } finally { Math.random = orig; }
}
function clearField() {
  chicks = []; parts = []; splats = []; slicks = []; G.pending = [];
  dctx.save(); dctx.setTransform(1, 0, 0, 1, 0, 0); dctx.clearRect(0, 0, decalCanvas.width, decalCanvas.height); dctx.restore();
}
function setWorld(i) {
  G.world = i;
  setPalette(WORLDS[i].palette); paletteMode = WORLDS[i].id;
  rebuildBg();
  ambInit(WORLDS[i]);
  clearField();
  G.spawnT = 0.3;
}

function multiplier() { return 1 + Math.min(3, Math.floor(G.streak / 5) * 0.5); }

function startGame(i = G.world) {
  goFullscreenLandscape();
  stopLaser();
  if (i !== G.world) setWorld(i); else clearField();
  store.set('world', i);
  Object.assign(G, {
    state: 'play', paused: false, score: 0, time: ROUND_TIME, elapsed: 0,
    ammo: { shotgun: WEAPONS.shotgun.ammo, harpoon: WEAPONS.harpoon.ammo }, reload: 0, cool: 0.2, switchT: 0,
    heat: 0, over: false, firing: false, burst: null, weapon: WORLDS[i].weapon,
    streak: 0, maxStreak: 0, kills: 0, shots: 0, hits: 0, heads: 0, spawnT: 0.4, newBest: false, unlockedNew: null,
    egg: newEggState(), eggCool: 0, wish: 0,
  });
  if (world().id === 'farm' && amb.clouds.length) { amb.clouds.forEach(c => { c.rain = false; }); amb.clouds[0].rain = true; }
}
function endGame() {
  stopLaser();
  G.state = 'over'; G.overT = 0;
  const w = world();
  if (G.score > progress.best[w.id]) { progress.best[w.id] = G.score; G.newBest = true; store.set('best_' + w.id, G.score); }
  const next = WORLDS[G.world + 1];
  if (next && progress.unlocked < G.world + 1 && G.score >= next.need) {
    progress.unlocked = G.world + 1; store.set('unlocked', progress.unlocked);
    G.unlockedNew = next; Snd.fanfare();
  }
}

/* ---------------------------------------------------------------- Spawnen */
function pickType(p) {
  const w = world().weights(p);
  if (chicks.some(c => c.alive && TYPES[c.type].gold)) for (const k in w) if (TYPES[k].gold) w[k] = 0;
  let sum = 0; for (const k in w) sum += w[k];
  let r = Math.random() * sum;
  for (const k in w) { r -= w[k]; if (r <= 0) return k; }
  return world().parade;
}
const chickScale = z => 0.28 + 0.5 * z;
function spawnChick(type, opts = {}) {
  const T = TYPES[type];
  const dir = opts.dir ?? (Math.random() < 0.5 ? 1 : -1);
  const z = opts.z ?? (T.fly ? rand(0.15, 0.85) : rand(0, 1));
  const c = {
    type, dir, z, alive: true, hp: T.hp, t: rand(0, 10), walk: rand(0, 6), peck: 0, pause: 0, hop: 0, hopV: 0, flash: 0,
    speed: rand(T.speed[0], T.speed[1]), s: chickScale(z) * T.size, gy: groundY(z),
    yoff: T.swim ? 18 : 0, sub: 0, diving: false, diveT: rand(2, 5), helmet: !!T.helmet, sit: rand(0.2, 1),
  };
  c.x = (dir > 0 ? -70 * c.s : W + 70 * c.s) - dir * (opts.offset || 0);
  if (T.fly) { c.ay0 = rand(80, HORIZON() - 60); c.y = c.ay0; } else c.y = c.gy;
  chicks.push(c);
  chicks.sort((a, b) => a.z - b.z);
  return c;
}
function spawnWave(p) {
  if (Math.random() < 0.12 + 0.1 * p) {
    // Parade: mehrere hintereinander – ideal für Mehrfachtreffer / Harpune
    const n = rint(3, 5), z = rand(0.1, 0.9), dir = Math.random() < 0.5 ? 1 : -1;
    for (let i = 0; i < n; i++) spawnChick(world().parade, { z, dir, offset: i * 55 * chickScale(z) });
  } else spawnChick(pickType(p));
}

/* ---------------------------------------------------------------- Trefferprüfung */
function headPos(c) {
  const T = TYPES[c.type], h = T.head || DEF_HEAD, pk = c.peck || 0;
  return { x: c.x + c.dir * (h[0] + pk * 12) * c.s, y: c.y + (h[1] + pk * 36 + (c.yoff || 0)) * c.s };
}
function bodyPos(c) {
  const T = TYPES[c.type], b = T.body || DEF_BODY;
  return { x: c.x + c.dir * b[0] * c.s, y: c.y + (b[1] + (c.yoff || 0)) * c.s, rx: b[2] * c.s, ry: b[3] * c.s };
}
const hittable = c => c.alive && (c.yoff || 0) < 50;
const touchF = () => (mouse.touch ? 1.35 : 1);
function hitTest(c, px, py) {
  if (!hittable(c)) return null;
  const T = TYPES[c.type], f = touchF();
  if (T.swim && py > c.y + 3 * c.s) return null; // unter Wasser
  const h = headPos(c), hr = (T.hr || 23) * c.s * f * (Settings.bighead && !T.kind ? 1.7 : 1);
  if ((px - h.x) ** 2 + (py - h.y) ** 2 < hr * hr) return 'head';
  const b = bodyPos(c);
  const bx = (px - b.x) / (b.rx * f), by = (py - b.y) / (b.ry * f);
  if (bx * bx + by * by < 1) return 'body';
  return null;
}
// Linie (Harpune): Abstand der Trefferzonen zur Schusslinie
function lineHit(c, ox, oy, dx, dy) {
  if (!hittable(c)) return null;
  const T = TYPES[c.type], f = mouse.touch ? 1.2 : 1;
  const h = headPos(c), hr = (T.hr || 23) * c.s * f;
  const th = (h.x - ox) * dx + (h.y - oy) * dy;
  if (th > 0 && (ox + dx * th - h.x) ** 2 + (oy + dy * th - h.y) ** 2 < hr * hr) return { part: 'head', t: th };
  const b = bodyPos(c), br = Math.min(b.rx, b.ry) * f;
  const tb = (b.x - ox) * dx + (b.y - oy) * dy;
  if (tb > 0 && (ox + dx * tb - b.x) ** 2 + (oy + dy * tb - b.y) ** 2 < br * br) return { part: 'body', t: tb };
  return null;
}

/* ---------------------------------------------------------------- Schaden & Gore */
function popText(x, y, s, col = '#fff', size = 28, life = 1.0) {
  parts.push({ k: 'text', x, y, vy: -60, s, col, size, life, max: life });
}
const bloodCols = c => (Settings.gore ? BLOODS[TYPES[c.type].blood] : CONFETTI);

function damage(c, head, dmg = 1, force = false) {
  const T = TYPES[c.type];
  if (T.helmet && c.helmet && !force) {
    c.helmet = false; c.flash = 0.12;
    const h = headPos(c);
    for (let i = 0; i < 14; i++) parts.push({ k: 'glass', x: h.x, y: h.y, vx: rand(-260, 260) * c.s, vy: rand(-380, -60) * c.s, rot: rand(0, TAU), vr: rand(-15, 15), r: rand(3, 7) * c.s + 1.5, life: 0.9, max: 0.9 });
    Snd.glass();
    popText(c.x, h.y - 35 * c.s, 'KLIRR!', '#a0f0ff', 22, 0.7);
    return { killed: false, pts: 5 };
  }
  if (T.rubber && !c.boss && !force) {
    c.rhits = (c.rhits || 0) + 1; c.flash = 0.1;
    Snd.voice('squeak', 1.1, 0.12);
    for (let i = 0; i < 5; i++) parts.push({ k: 'star', x: c.x, y: bodyPos(c).y, vx: rand(-200, 200) * c.s, vy: rand(-300, -80) * c.s, rot: 0, life: 0.5, max: 0.5, s: c.s * 0.5 });
    if (c.rhits >= 10) {
      c.boss = true; c.s *= 2.6; c.hp = 14; c.speed *= 0.5; G.shake = Math.max(G.shake, 12);
      popText(c.x, c.y - 140 * c.s, 'BOSS-GUMMIENTE!', '#ffe600', 44, 2);
      discover('rubber');
    } else popText(c.x, c.y - 60 * c.s, 'QUIETSCH!', '#fff3a0', 18, 0.5);
    return { killed: false, pts: 2 };
  }
  c.hp -= force ? 99 : head ? dmg + 1 : dmg;
  if (c.hp > 0) {
    c.flash = 0.18; c.speed *= 1.3; c.pause = 0;
    spurt(c, 22); feathers(c, 6);
    Snd.voice(T.voice === 'peep' ? 'squawk' : T.voice, 0.9, 0.08);
    popText(c.x, headPos(c).y - 40 * c.s, pick(['AUA!', 'GAAACK!', 'HEY!']), '#ffdddd', 22, 0.7);
    return { killed: false, pts: 5 };
  }
  c.alive = false;
  gore(c, head, c.boss ? 2.2 : T.big);
  Snd.splat(c.boss ? 2 : T.big);
  if (T.bomb) G.pending.push({ t: 0.14, x: c.x, y: bodyPos(c).y, s: c.s, z: c.z, kind: T.bomb });
  let pts = T.pts * (1 + (1 - c.z) * 0.9);
  if (head) pts *= 1.5;
  if (T.rubber && !c.boss) pts = 20;
  if (G.egg.sunset && world().id === 'farm') pts *= 2;
  if (T.fishBonus && G.state === 'play') popText(c.x, c.y - 60 * c.s, 'FISCH-BONUS!', '#7dffb0', 34, 1.4);
  if (T.gold && G.state === 'play') {
    G.time += 5; Snd.ding();
    popText(c.x, headPos(c).y - 50 * c.s, '+5 SEK!', '#7dffb0', 30, 1.4);
  }
  return { killed: true, pts: Math.round(pts) };
}

function bloodDrop(x, y, vx, vy, r, gy, cols) {
  parts.push({ k: 'blood', x, y, vx, vy, r: Math.max(2.6, r), gy: Math.max(gy, HORIZON() + 22), col: pick(cols) });
}
function spurt(c, n) {
  const s = c.s, b = bodyPos(c), cols = bloodCols(c), gv = world().gv;
  for (let i = 0; i < n; i++) bloodDrop(b.x, b.y, rand(-250, 250) * s * gv, rand(-450, -100) * s * gv, rand(1.5, 4) * (0.5 + s * 0.6), c.gy + rand(-15, 15) * s, cols);
}
function feathers(c, n) {
  const s = c.s, T = TYPES[c.type], b = bodyPos(c);
  for (let i = 0; i < n; i++) {
    parts.push({
      k: 'feather', x: b.x + rand(-20, 20) * s, y: b.y + rand(-25, 25) * s,
      vx: rand(-200, 200) * s, vy: rand(-320, -60) * s, rot: rand(0, TAU), ph: rand(0, TAU),
      s, col: pick([T.col, T.lt, T.dk]), life: rand(1.8, 3.2), max: 3.2,
    });
  }
}

function gore(c, head, big = 1) {
  const T = TYPES[c.type], s = c.s, b = bodyPos(c), cx = b.x, cy = b.y;
  const gv = world().gv, sv = (0.55 + s * 0.6) * gv, cols = bloodCols(c);

  const n = Math.round((55 + 45 * big) * (0.6 + s * 0.5));
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), sp = rand(80, 720) * sv * big;
    bloodDrop(cx + rand(-12, 12) * s, cy + rand(-12, 12) * s,
      Math.cos(a) * sp, Math.sin(a) * sp * 0.8 - rand(150, 500) * sv,
      rand(1.5, 5.5) * (0.45 + s * 0.65), c.gy + rand(-28, 28) * s, cols);
  }
  const h = headPos(c);
  if (head) for (let i = 0; i < 30; i++) bloodDrop(h.x, h.y + 10 * s, rand(-120, 120) * sv, rand(-900, -400) * sv, rand(2, 5) * (0.5 + s * 0.6), c.gy + rand(-20, 20) * s, cols);
  feathers(c, Math.round(rint(12, 20) * big));

  if (!Settings.gore) {
    for (let i = 0; i < 6; i++) parts.push({ k: 'star', x: cx, y: cy, vx: rand(-300, 300) * sv, vy: rand(-400, -50) * sv, rot: 0, life: 0.8, max: 0.8, s });
    parts.push({ k: 'poof', x: cx, y: cy, r: 10 * s, life: 0.45, max: 0.45, s });
    return;
  }
  const base = { type: c.type, col: T.col, dk: T.dk, s, rest: 0, bc: cols };
  const chunkGy = () => Math.max(HORIZON() + 24, c.gy + rand(-18, 18) * s);
  if (!T.noHead) parts.push({
    ...base, k: 'chunk', part: 'head', x: h.x, y: h.y,
    vx: rand(-220, 220) * sv, vy: (head ? rand(-950, -700) : rand(-650, -350)) * sv,
    rot: 0, vr: rand(-14, 14) * gv, gy: chunkGy(), dir: c.dir, life: rand(3.5, 5),
  });
  for (const part of piecesFor(T)) {
    parts.push({
      ...base, k: 'chunk', part, x: cx + rand(-15, 15) * s, y: cy + rand(-15, 15) * s,
      vx: rand(-420, 420) * sv * big, vy: rand(-750, -250) * sv,
      rot: rand(0, TAU), vr: rand(-18, 18) * gv, gy: chunkGy(), dir: 1, life: rand(3, 5),
    });
  }
  if (!T.fly) stampSplat(c.x, c.gy, s * big, cols);
  if ((c.z > 0.72 && Math.random() < 0.55) || (head && Math.random() < 0.15) || big > 1.2) {
    screenSplat(clamp(c.x + rand(-160, 160), 60, W - 60), clamp(cy + rand(-140, 60), 60, H - 120), rand(0.7, 1.3) * big, cols[0]);
  }
}

// Blut auf dem Wasser: treibt, breitet sich aus, verblasst
function addSlick(x, y, r, col, grow = 2.6) {
  slicks.push({ x, y, r: r * 0.6, gr: r * grow * rand(0.8, 1.2), col, vx: rand(-4, 4) + 7, ph: rand(0, TAU), life: rand(6, 10), max: 10 });
  if (slicks.length > 900) slicks.splice(0, slicks.length - 900);
}
function stampSplat(x, y, s, cols) {
  if (!Settings.gore) return;
  if (world().water) {
    addSlick(x, y, 30 * s, cols[2], 2);
    for (let i = 0; i < 8; i++) addSlick(x + rand(-60, 60) * s, y + rand(-12, 12) * s, rand(6, 14) * s, pick(cols), 2.5);
    return;
  }
  const g = dctx;
  g.globalAlpha = 0.85; g.fillStyle = cols[2];
  ell(g, x, y, 42 * s, 11 * s); g.fill();
  g.globalAlpha = 1;
  for (let i = 0; i < 16; i++) {
    const a = rand(0, TAU), d = rand(25, 90) * s;
    g.fillStyle = pick(cols);
    ell(g, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.3, rand(3, 10) * s, rand(1.5, 4) * s); g.fill();
  }
  g.strokeStyle = cols[2]; g.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    const a = rand(0, TAU), d = rand(40, 110) * s;
    g.lineWidth = rand(1.5, 4) * s;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.3); g.stroke();
  }
}

function screenSplat(x, y, size, col = '#96000e') {
  if (!Settings.gore) return;
  const r = size * rand(28, 55);
  const sp = { x, y, col, life: 4.5, max: 4.5, blobs: [{ ox: 0, oy: 0, r }], drips: [] };
  for (let i = 0; i < 14; i++) {
    const a = rand(0, TAU), d = rand(r * 0.7, r * 2.0);
    sp.blobs.push({ ox: Math.cos(a) * d, oy: Math.sin(a) * d, r: rand(2, r * 0.32) });
  }
  for (let i = rint(2, 5); i > 0; i--) sp.drips.push({ ox: rand(-r * 0.7, r * 0.7), w: rand(4, 9) * size, len: 0, max: rand(60, 260) * size, v: rand(15, 55) });
  splats.push(sp);
}

function pelletFx(px, py) {
  if (py <= HORIZON() + 10) return;
  const id = world().id;
  const col = id === 'pond' ? '#d0e8ff' : id === 'space' ? '#9090a0' : '#6b4a2a';
  for (let i = 0; i < 3; i++) parts.push({ k: 'dirt', x: px, y: py, vx: rand(-60, 60), vy: rand(-160, -50) * world().gv, gy: py + 2, life: 0.6, r: rand(1.2, 2.5), col });
  if (id === 'pond') parts.push({ k: 'ring', x: px, y: py, r: 1, s: 0.4, life: 0.5, max: 0.5 });
  else { dctx.fillStyle = 'rgba(30,20,10,0.4)'; dctx.fillRect(px - 1.5, py - 1, 3, 2); }
}
function missFx(px, py) {
  if (py <= HORIZON() + 10) return;
  const id = world().id;
  const col = id === 'pond' ? '#d0e8ff' : id === 'space' ? '#9090a0' : '#6b4a2a';
  for (let i = 0; i < 10; i++) parts.push({ k: 'dirt', x: px, y: py, vx: rand(-120, 120), vy: rand(-260, -80), gy: py + rand(-4, 4), life: 1.2, r: rand(1.5, 3.5), col });
  if (id === 'pond') { parts.push({ k: 'ring', x: px, y: py, r: 3, s: 1, life: 0.9, max: 0.9 }); Snd.splash(); }
  else { dctx.fillStyle = 'rgba(40,30,20,0.35)'; ell(dctx, px, py, 6, 2.5); dctx.fill(); }
}

function explode(x, y, s, z, kind) {
  Snd.boom();
  G.shake = Math.max(G.shake, 26); G.flash = 0.7;
  const green = kind === 'plasma';
  for (let i = 0; i < 28; i++) parts.push({ k: 'fire', green, x: x + rand(-20, 20) * s, y: y + rand(-20, 20) * s, vx: rand(-260, 260) * s, vy: rand(-300, 80) * s, r: rand(14, 34) * s, life: rand(0.3, 0.6), max: 0.6 });
  for (let i = 0; i < 18; i++) parts.push({ k: 'smoke', x: x + rand(-30, 30) * s, y: y + rand(-30, 30) * s, vx: rand(-60, 60), vy: rand(-90, -20), r: rand(18, 40) * s, life: rand(1.2, 2.2), max: 2.2 });
  if (kind === 'mine') {
    for (let i = 0; i < 40; i++) parts.push({ k: 'dirt', x, y: groundY(z), vx: rand(-200, 200) * s, vy: rand(-1100, -400) * s, gy: groundY(z) + rand(-10, 10), life: 2, r: rand(2, 6) * s + 1, col: pick(['#d0e8ff', '#ffffff', '#a8d8ff']) });
    parts.push({ k: 'ring', x, y: groundY(z), r: 10, s: s * 3, life: 1.2, max: 1.2 });
  } else { dctx.fillStyle = 'rgba(30,20,10,0.55)'; ell(dctx, x, groundY(z), 75 * s, 20 * s); dctx.fill(); }
  if (Settings.gore) {
    screenSplat(rand(W * 0.2, W * 0.8), rand(H * 0.2, H * 0.6), 1.3);
    screenSplat(rand(W * 0.1, W * 0.9), rand(H * 0.15, H * 0.5), 0.9);
  }
  const R = 240 * (0.5 + s * 0.6);
  let total = 0, n = 0;
  for (const c of chicks) {
    if (!c.alive) continue;
    const b = bodyPos(c), dx = b.x - x, dy = b.y - y, dz = (c.z - z) * 250;
    if (dx * dx + dy * dy + dz * dz < R * R) {
      const r = damage(c, false, 1, true);
      if (r.killed) { total += r.pts; n++; }
    }
  }
  const label = kind === 'plasma' ? 'ZAPPP!' : 'KABUMM!';
  if (G.state === 'play') {
    const pts = Math.round((total + 50 * n) * multiplier());
    G.score += pts; G.kills += n;
    popText(x, y - 80 * s, n > 0 ? `${label} +${pts}` : label, green ? '#7dff4a' : '#ffb347', 40, 1.4);
  } else popText(x, y - 80 * s, label, green ? '#7dff4a' : '#ffb347', 40, 1.2);
}

/* ---------------------------------------------------------------- Easter Eggs */
function discover(id) {
  if (progress.eggs.includes(id)) return;
  progress.eggs.push(id); store.set('eggs', progress.eggs);
  popText(W / 2, 200, 'GEHEIMNIS ENTDECKT!', '#ff90e0', 42, 2.4);
  Snd.fanfare();
}
// prüft, ob ein Schuss ein Easter-Egg-Ziel getroffen hat
function eggShot(px, py) {
  if (G.state !== 'play') return false;
  const id = world().id, E = G.egg;
  if (id === 'farm') {
    for (const cl of amb.clouds) {
      if (!cl.rain || !cloudHit(cl, px, py)) continue;
      E.cloud++;
      for (let i = 0; i < 6; i++) parts.push({ k: 'dirt', x: px, y: py, vx: rand(-60, 60), vy: rand(-40, 120), gy: py + 200, life: 0.6, r: 2, col: '#a8d8ff' });
      if (E.cloud >= 3) {
        cl.rain = false; E.eggRain = 15; E.eggT = 0; E.eggCloud = cl;
        popText(cl.x + 30 * cl.s, cl.y + 50, 'EIER-REGEN!', '#fff3a0', 36, 1.6);
        discover('cloud');
      } else popText(px, py - 20, 'GRUMMEL', '#d8d8d0', 16, 0.5);
      return true;
    }
    const sn = farmSun();
    if (!E.sunset && (px - sn.x) ** 2 + (py - sn.y) ** 2 < (sn.r + 6) ** 2) {
      E.sun++; E.sunHit = 0.2;
      if (E.sun >= 10) {
        E.sunset = true;
        popText(W / 2, 300, 'SONNENUNTERGANG!', '#ffa020', 44, 2.2);
        popText(W / 2, 360, 'DOPPELTE PUNKTE!', '#fff3a0', 30, 2.2);
        discover('sun');
      }
      return true;
    }
    const sr = siloRect();
    if (!E.siloOpen && px > sr.x && px < sr.x + sr.w && py > sr.y && py < sr.y + sr.h) {
      E.silo++; E.siloHit = 0.2;
      for (let i = 0; i < 4; i++) parts.push({ k: 'dirt', x: px, y: py, vx: rand(-100, 100), vy: rand(-150, -30), gy: sr.y + sr.h, life: 1, r: 2, col: '#c9c4b8' });
      Snd.click();
      if (E.silo >= 6) {
        E.siloOpen = true; E.grainT = 1.6; E.peckT = 7;
        G.shake = Math.max(G.shake, 8); Snd.boom();
        popText(sr.x + 140, sr.y + 10, 'KÖRNER-REGEN!', '#ffd83a', 38, 2);
        discover('silo');
      } else popText(px, py - 16, 'PLONK', '#d8d8d0', 16, 0.4);
      return true;
    }
  }
  if (id === 'pond' && !E.anglerGone) {
    const d = dockRect();
    if (px > d.x && px < d.x + d.w && py > d.y && py < d.y + d.h) {
      E.anglerGone = true;
      const ax = W * 0.72 + 180, z = 0.03;
      const c = spawnChick('angler', { dir: 1, z });
      c.x = ax;
      parts.push({ k: 'ring', x: ax, y: c.gy, r: 4, s: c.s * 2, life: 1, max: 1 });
      for (let i = 0; i < 10; i++) parts.push({ k: 'dirt', x: ax, y: c.gy, vx: rand(-80, 80), vy: rand(-260, -80), gy: c.gy, life: 1, r: 2, col: '#d0e8ff' });
      Snd.splash(); Snd.voice('squawk', 1, 0.12);
      popText(ax, c.gy - 60, 'PLATSCH!', '#a0f0ff', 30, 1.4);
      discover('dock');
      return true;
    }
  }
  if (id === 'space') {
    for (const st of amb.shoot) {
      if ((px - st.x) ** 2 + (py - st.y) ** 2 > 38 * 38) continue;
      st.life = 0; G.wish = 10;
      for (let i = 0; i < 14; i++) parts.push({ k: 'star', x: st.x, y: st.y, vx: rand(-300, 300), vy: rand(-300, 200), rot: 0, life: 1, max: 1, s: 0.6 });
      Snd.wish();
      popText(W / 2, 300, 'WUNSCH ERFÜLLT!', '#ff90e0', 44, 2.2);
      popText(W / 2, 360, '10 SEK UNENDLICH FEUER', '#fff3a0', 28, 2.2);
      discover('star');
      return true;
    }
    const ep = earthPos();
    if (!E.earthGone && (px - ep.x) ** 2 + (py - ep.y) ** 2 < (ep.r + 6) ** 2) {
      E.earth++; E.earthHit = 0.3;
      if (E.earth >= 3) {
        E.earthGone = true; G.shake = Math.max(G.shake, 20); G.flash = 0.8;
        Snd.boom();
        for (let i = 0; i < 24; i++) parts.push({ k: 'fire', x: ep.x + rand(-15, 15), y: ep.y + rand(-15, 15), vx: rand(-200, 200), vy: rand(-200, 200), r: rand(8, 20), life: rand(0.4, 0.9), max: 0.9 });
        for (let i = 0; i < 30; i++) parts.push({ k: 'glass', x: ep.x, y: ep.y, vx: rand(-260, 260), vy: rand(-260, 260), rot: rand(0, TAU), vr: rand(-6, 6), r: rand(3, 7), life: 2.5, max: 2.5 });
        popText(W / 2, 280, 'DU HAST DIE ERDE', '#ff4a4a', 46, 3);
        popText(W / 2, 340, 'GESPRENGT!', '#ff4a4a', 46, 3);
        discover('earth');
      } else popText(ep.x - 40, ep.y + 60, 'NICHT DIE ERDE!', '#ff4a4a', 24, 1.2);
      return true;
    }
    const lp = landerPos();
    if (!E.landerGone && px > lp.x - 26 && px < lp.x + 26 && py > lp.y - 52 && py < lp.y + 4) {
      E.landerGone = true;
      const c = spawnChick('lander', { dir: lp.x > W / 2 ? -1 : 1, z: 0 });
      c.x = lp.x; c.y0 = lp.y - 34; c.y = c.y0; c.rt = 0;
      Snd.rocket();
      popText(lp.x, lp.y - 80, 'ABHEBEN!', '#40e0ff', 30, 1.4);
      discover('lander');
      return true;
    }
  }
  if (id === 'farm' && !E.doorOpen) {
    const d = farmDoor();
    if (px > d.x - 6 && px < d.x + d.w + 6 && py > d.y - 6 && py < d.y + d.h + 2) {
      E.door++; E.doorHit = 0.25;
      for (let i = 0; i < 6; i++) parts.push({ k: 'dirt', x: px, y: py, vx: rand(-120, 120), vy: rand(-200, -40), gy: d.y + d.h, life: 1, r: rand(1.5, 3), col: pick(['#f2ead8', '#b5302a']) });
      Snd.click();
      if (E.door >= 5) {
        E.doorOpen = true; E.aval = 22; E.avalT = 0.35;
        G.shake = Math.max(G.shake, 12);
        Snd.boom(); Snd.voice('squawk', 1, 0.12);
        popText(d.x + 120, d.y - 40, 'SCHEUNEN-LAWINE!', '#ffd83a', 40, 2);
        discover('barn');
      } else popText(d.x + d.w / 2, d.y - 16, 'KNACK!', '#f2ead8', 18, 0.5);
      return true;
    }
  }
  if (id === 'pond') {
    for (let i = 0; i < pondPads.length; i++) {
      const pd = pondPads[i], rx = pd.r * 1.2 + 4, ry = Math.max(pd.r * 0.45, 7);
      if (((px - pd.x) / rx) ** 2 + ((py - pd.y) / ry) ** 2 > 1) continue;
      E.pads[i] = (E.pads[i] || 0) + 1;
      parts.push({ k: 'ring', x: pd.x, y: pd.y, r: pd.r * 0.3, s: chickScale(clamp(zFromScreenY(pd.y), 0, 1)), life: 0.7, max: 0.7 });
      if (E.pads[i] >= 3) { E.pads[i] = 0; launchPike(pd); }
      return true;
    }
  }
  if (id === 'space' && !E.novaDone) {
    const P = planetPos();
    if ((px - P.x) ** 2 + (py - P.y) ** 2 < (P.r + 6) ** 2) {
      E.nova++; E.novaHit = 0.2;
      for (let i = 0; i < 6; i++) parts.push({ k: 'spark', x: px, y: py, vx: rand(-200, 200), vy: rand(-200, 200), life: 0.3, max: 0.3 });
      if (E.nova >= 10) supernova();
      return true;
    }
  }
  return false;
}
function launchPike(pd) {
  const z = clamp(zFromScreenY(pd.y), 0, 1);
  let target = null, best = 420;
  for (const c of chicks) {
    if (!c.alive || !TYPES[c.type].swim) continue;
    const d = Math.abs(c.x - pd.x) + Math.abs(c.gy - pd.y) * 2;
    if (d < best) { best = d; target = c; }
  }
  const dir = target ? (target.x >= pd.x ? 1 : -1) : (pd.x < W / 2 ? 1 : -1);
  const c = spawnChick('pike', { dir, z });
  c.x = pd.x; c.lx0 = pd.x; c.lx1 = target ? target.x + target.dir * target.speed * 0.4 : pd.x + dir * 220;
  c.leap = 0; c.target = target; c.y = c.gy;
  for (let i = 0; i < 14; i++) parts.push({ k: 'dirt', x: pd.x, y: pd.y, vx: rand(-150, 150) * c.s, vy: rand(-500, -200) * c.s, gy: pd.y, life: 1.2, r: rand(2, 4) * c.s + 1, col: pick(['#d0e8ff', '#ffffff']) });
  parts.push({ k: 'ring', x: pd.x, y: pd.y, r: 6, s: c.s * 2, life: 1, max: 1 });
  Snd.splash();
  popText(pd.x, pd.y - 120 * c.s, 'HECHT!', '#7dffb0', 34, 1.2);
  discover('pike');
}
function supernova() {
  const E = G.egg, P = planetPos();
  E.novaDone = true; E.wave = 0;
  G.flash = 1.4; G.shake = 40;
  Snd.boom(); Snd.nova();
  for (let i = 0; i < 40; i++) parts.push({ k: 'fire', green: Math.random() < 0.3, x: P.x + rand(-30, 30), y: P.y + rand(-30, 30), vx: rand(-500, 500), vy: rand(-500, 500), r: rand(20, 50), life: rand(0.5, 1.1), max: 1.1 });
  popText(P.x + 220, P.y + 190, 'SUPERNOVA!', '#fff3a0', 60, 2.5);
  discover('nova');
}
function updateEggs(dt) {
  const E = G.egg;
  E.doorHit = Math.max(0, E.doorHit - dt); E.novaHit = Math.max(0, E.novaHit - dt);
  G.eggCool = Math.max(0, G.eggCool - dt);
  G.wish = Math.max(0, G.wish - dt);
  E.siloHit = Math.max(0, E.siloHit - dt); E.sunHit = Math.max(0, E.sunHit - dt); E.earthHit = Math.max(0, E.earthHit - dt);
  E.peckT = Math.max(0, E.peckT - dt);
  // Körner-Regen aus dem Silo
  if (E.grainT > 0) {
    E.grainT -= dt;
    const sr = siloRect();
    for (let i = 0; i < 3; i++) parts.push({ k: 'dirt', stamp: true, x: sr.x + sr.w / 2, y: sr.y + 10, vx: rand(40, 650), vy: rand(-650, -250), gy: rand(HORIZON() + 30, H), life: 3, r: rand(1.5, 3), col: pick(['#ffd83a', '#e8b84a', '#fff3a0']) });
  }
  // Eier-Regen aus der Wolke
  if (E.eggRain > 0) {
    E.eggT -= dt;
    if (E.eggT <= 0) {
      E.eggT = 0.15; E.eggRain--;
      const cl = E.eggCloud, c = spawnChick('egg', { dir: 1, z: rand(0.05, 1) });
      c.x = cl.x + rand(-10, 90) * cl.s; c.y = cl.y + 15; c.vy = rand(0, 80); c.rot = rand(0, TAU);
    }
  }
  // geschlüpfte Küken aus gelandeten Eiern
  for (const h of E.hatch) { const c = spawnChick('chick', { dir: Math.random() < 0.5 ? 1 : -1, z: h.z }); c.x = h.x; }
  E.hatch.length = 0;
  // Seeungeheuer erwacht nach vielen Abschüssen
  if (world().id === 'pond' && G.state === 'play' && !E.monster && G.kills >= 40) {
    E.monster = true;
    const c = spawnChick('monster', { dir: Math.random() < 0.5 ? 1 : -1, z: 0.12 });
    c.x = rand(300, W - 300); c.mt = 0; c.yoff = 140;
    Snd.voice('roar', 1, 0.3);
    popText(c.x, c.gy - 150, 'SEEUNGEHEUER!', '#7dffb0', 40, 2);
    discover('monster');
  }
  // Scheunen-Lawine: Küken strömen aus dem Tor
  if (E.aval > 0) {
    E.avalT -= dt;
    if (E.avalT <= 0) {
      E.avalT = 0.13; E.aval--;
      const d = farmDoor();
      const c = spawnChick(pick(['chick', 'chick', 'chick', 'runner', 'chick', 'hen']), { dir: Math.random() < 0.85 ? 1 : -1, z: rand(0, 0.1) });
      c.x = d.x + d.w / 2 + rand(-8, 8); c.speed *= 1.5;
      if (Math.random() < 0.4) Snd.voice('peep', rand(0.9, 1.2), 0.05);
    }
  }
  // Supernova: Schockwelle zerfetzt alles, was sie erreicht
  if (E.wave >= 0) {
    E.wave += dt * 1100;
    const P = planetPos();
    let pts = 0, n = 0;
    for (const c of chicks) {
      if (!c.alive) continue;
      const b = bodyPos(c);
      if ((b.x - P.x) ** 2 + (b.y - P.y) ** 2 < E.wave * E.wave) {
        const r = damage(c, false, 1, true);
        if (r.killed) { pts += r.pts * 2; n++; }
      }
    }
    if (n && G.state === 'play') {
      const add = Math.round(pts * multiplier());
      G.score += add; G.kills += n;
      popText(clamp(P.x + E.wave * 0.7, 100, W - 100), clamp(P.y + E.wave * 0.5, 120, H - 120), '+' + add, '#fff3a0', 30, 1);
    }
    if (E.wave > 2600) E.wave = -1;
  }
}
function drawAngler() {
  const ax = W * 0.72 + 150, ay = HORIZON() + 3, t = G.t;
  ctx.strokeStyle = '#e8820c'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(ax - 2, ay - 2); ctx.lineTo(ax + 2, ay + 8); ctx.moveTo(ax + 4, ay - 2); ctx.lineTo(ax + 8, ay + 8); ctx.stroke();
  ctx.save(); ctx.translate(ax, ay); ctx.scale(0.36, 0.36);
  drawChickBody(ctx, { flash: 0, pause: 1, hop: 0, walk: 0, t, peck: 0 }, TYPES.angler);
  ctx.restore();
  const bob = Math.sin(t * 2.2) * 1.5;
  ctx.strokeStyle = '#5a4020'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(ax + 6, ay - 10); ctx.lineTo(ax + 44, ay - 44); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(ax + 44, ay - 44); ctx.lineTo(ax + 52, ay + 30 + bob); ctx.stroke();
  ctx.fillStyle = '#ff4a4a'; circ(ctx, ax + 52, ay + 30 + bob, 3); ctx.fill();
}
function drawEggs() {
  const id = world().id, active = G.state === 'play' || G.state === 'over', E = active ? G.egg : newEggState();
  if (id === 'farm') {
    const sn = farmSun();
    if (E.sun > 0 && !E.sunset) { ctx.fillStyle = `rgba(255,110,40,${Math.min(0.7, E.sun * 0.07) + E.sunHit})`; circ(ctx, sn.x, sn.y, sn.r); ctx.fill(); }
    if (E.sunset) {   // Sonne mit Sonnenbrille
      ctx.fillStyle = '#1a1a1a';
      rrect(ctx, sn.x - 36, sn.y - 12, 30, 20, 7); ctx.fill(); rrect(ctx, sn.x + 6, sn.y - 12, 30, 20, 7); ctx.fill();
      ctx.fillRect(sn.x - 8, sn.y - 8, 16, 4);
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(sn.x - 30, sn.y - 8, 8, 4); ctx.fillRect(sn.x + 12, sn.y - 8, 8, 4);
      ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(sn.x, sn.y + 14, 14, 0.3, Math.PI - 0.3); ctx.stroke();
    }
    const sr = siloRect();
    if (E.siloOpen) {
      ctx.fillStyle = '#3b2a1e'; ell(ctx, sr.x + sr.w / 2, sr.y + 45, 9, 20); ctx.fill();
      ctx.fillStyle = '#ffd83a'; ell(ctx, sr.x + sr.w / 2 + 10, sr.y + sr.h, 34, 9); ctx.fill();
    } else if (E.silo > 0) {
      const sh = E.siloHit > 0 ? rand(-2, 2) : 0;
      ctx.strokeStyle = '#5a5650'; ctx.lineWidth = 2;
      for (let i = 0; i < Math.min(E.silo, 5); i++) {
        const yy = sr.y + 20 + i * 18;
        ctx.beginPath(); ctx.moveTo(sr.x + 6 + sh, yy); ctx.lineTo(sr.x + 18 + sh, yy + 8); ctx.lineTo(sr.x + 30 + sh, yy + 2); ctx.stroke();
      }
    }
    const d = farmDoor();
    if (E.doorOpen) {
      ctx.fillStyle = '#1a1210'; ctx.fillRect(d.x, d.y, d.w, d.h);
      ctx.fillStyle = '#f2ead8';
      ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - 16, d.y + 4); ctx.lineTo(d.x - 16, d.y + d.h + 4); ctx.lineTo(d.x, d.y + d.h); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(d.x + d.w, d.y); ctx.lineTo(d.x + d.w + 16, d.y + 4); ctx.lineTo(d.x + d.w + 16, d.y + d.h + 4); ctx.lineTo(d.x + d.w, d.y + d.h); ctx.closePath(); ctx.fill();
    } else if (E.door > 0) {
      const sh = E.doorHit > 0 ? rand(-2, 2) : 0;
      ctx.strokeStyle = '#3b2a1e'; ctx.lineWidth = 2;
      const cracks = [[0.2, 0.1, 0.5, 0.45], [0.8, 0.2, 0.55, 0.6], [0.3, 0.9, 0.5, 0.55], [0.9, 0.8, 0.6, 0.4]];
      for (let i = 0; i < Math.min(E.door, 4); i++) {
        const [x0, y0, x1, y1] = cracks[i];
        ctx.beginPath(); ctx.moveTo(d.x + sh + x0 * d.w, d.y + y0 * d.h); ctx.lineTo(d.x + sh + x1 * d.w, d.y + y1 * d.h); ctx.stroke();
      }
    }
  }
  if (id === 'pond' && !E.anglerGone) drawAngler();
  if (id === 'space') {
    const P = planetPos();
    if (E.novaDone) drawNovaRemnant(ctx, G.t);
    else if (E.nova > 0) {
      const a = Math.min(1, E.nova / 9) * (0.6 + 0.4 * Math.sin(G.t * (6 + E.nova * 2)));
      ctx.strokeStyle = `rgba(255,243,160,${a})`; ctx.lineWidth = 3;
      for (let i = 0; i < E.nova; i++) {
        const ang = i * 2.4;
        ctx.beginPath(); ctx.moveTo(P.x, P.y);
        ctx.lineTo(P.x + Math.cos(ang) * P.r * 0.55, P.y + Math.sin(ang) * P.r * 0.55 + 6);
        ctx.lineTo(P.x + Math.cos(ang + 0.3) * P.r * 0.95, P.y + Math.sin(ang + 0.3) * P.r * 0.95);
        ctx.stroke();
      }
      if (E.novaHit > 0) { ctx.fillStyle = `rgba(255,255,255,${E.novaHit * 2})`; circ(ctx, P.x, P.y, P.r); ctx.fill(); }
    }
    const ep = earthPos();
    if (!E.earthGone) {
      drawEarth(ctx);
      if (E.earthHit > 0) { ctx.fillStyle = `rgba(255,60,60,${E.earthHit * 2})`; circ(ctx, ep.x, ep.y, ep.r); ctx.fill(); }
    } else {   // Trümmerring, wo die Erde war
      ctx.fillStyle = '#9090a0';
      for (let i = 0; i < 14; i++) {
        const a = i * 0.45 + G.t * 0.2, r = 22 + (i % 3) * 7;
        ctx.fillRect(ep.x + Math.cos(a) * r, ep.y + Math.sin(a) * r * 0.5, 3 + (i % 2) * 2, 3);
      }
    }
    if (!E.landerGone) drawLanderTop(ctx);
  }
}
// Abendrot: eigene Palette (Himmelblau -> Orange/Rosa/Violett) + warmer Verlauf
const SUNSET_PAL = WORLDS[0].palette.map(c => ({ '#2a4fa0': '#5a2a6a', '#3f7fd8': '#c0506a', '#6cb0f0': '#ff9a5a', '#b8e0ff': '#ffd0a0', '#3050e0': '#8a3a7a' }[c] || c));

function syncPalette() {
  const want = world().id === 'farm' && (G.state === 'play' || G.state === 'over') && G.egg.sunset ? 'sunset' : world().id;
  if (want === paletteMode) return;
  paletteMode = want;
  setPalette(want === 'sunset' ? SUNSET_PAL : world().palette);
  rebuildBg();
}
function drawSunset() {
  const gr = ctx.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, 'rgba(255,120,80,0.12)'); gr.addColorStop(0.55, 'rgba(255,150,60,0.18)'); gr.addColorStop(1, 'rgba(90,20,70,0.32)');
  ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
}
function drawNovaWave() {
  const E = G.egg;
  if (E.wave < 0) return;
  const P = planetPos(), f = clamp(1 - E.wave / 2600, 0, 1);
  ctx.strokeStyle = `rgba(255,250,220,${0.9 * f})`; ctx.lineWidth = 10 + 40 * f;
  circ(ctx, P.x, P.y, E.wave); ctx.stroke();
  ctx.strokeStyle = `rgba(64,224,255,${0.7 * f})`; ctx.lineWidth = 8;
  circ(ctx, P.x, P.y, Math.max(1, E.wave - 50)); ctx.stroke();
}

/* ---------------------------------------------------------------- Waffen: Logik */
const gunOrigin = () => ({ x: W / 2, y: H + 20 });

function reload() {
  const w = WEAPONS[G.weapon];
  if (!w.ammo || G.reload > 0 || G.ammo[G.weapon] === w.ammo || G.state !== 'play') return;
  G.reload = w.reload; Snd.reload();
}
function switchWeapon(key) {
  if (G.state !== 'play' || key === G.weapon || !weaponsUnlocked().includes(key)) return;
  stopLaser();
  G.weapon = key; G.reload = 0; G.switchT = 0.25;
  Snd.click();
  popText(W / 2, H - 170, WEAPONS[key].name, '#fff3a0', 32, 1.0);
}
function cycleWeapon(d) {
  const list = WEAPON_ORDER.filter(k => weaponsUnlocked().includes(k));
  if (list.length < 2) return;
  const i = list.indexOf(G.weapon);
  switchWeapon(list[(i + d + list.length) % list.length]);
}

function triggerDown(px, py) {
  if (G.state !== 'play') { pointShot(px, py, false); return; }
  if (G.switchT > 0) return;
  if (G.weapon === 'laser') { startLaser(); return; }
  if (G.reload > 0 || G.cool > 0) return;
  const w = WEAPONS[G.weapon];
  if (G.ammo[G.weapon] <= 0) {
    if (mouse.touch) { reload(); return; }
    Snd.empty(); popText(px, py - 40, 'NACHLADEN!', '#ff6b6b', 24, 0.6); G.cool = 0.15; return;
  }
  if (G.wish <= 0) G.ammo[G.weapon]--;
  G.shots++; G.cool = w.cool;
  if (G.weapon === 'shotgun') pointShot(px, py, true);
  else harpoonShot(px, py);
}

function finishShot(px, py, res, kind) {
  G.hits++; G.streak++; G.maxStreak = Math.max(G.maxStreak, G.streak);
  G.kills += res.kills; G.heads += res.heads;
  let total = res.total;
  if (res.kills >= 2) {
    total += 30 * res.kills * res.kills;
    Snd.multi();
    const msg = kind === 'harpoon'
      ? (res.kills === 2 ? 'DOPPELSPIESS!' : 'SCHASCHLIK!')
      : (res.kills === 2 ? 'DOPPELT!' : res.kills === 3 ? 'DREIFACH!' : 'MASSAKER!');
    popText(px, py - 70, msg, '#ff4d6d', 40, 1.3);
  }
  const pts = Math.round(total * multiplier());
  G.score += pts;
  popText(px, py - 30, '+' + pts, '#ffffff', 30, 0.9);
  if (G.streak % 5 === 0) popText(W / 2, 150, `COMBO x${multiplier().toFixed(1)}`, '#7dd3ff', 44, 1.2);
}

// Mündung der Waffe am unteren Bildrand (zeigt aufs Fadenkreuz)
// Waffe weicht bei nahen Zielen zurück, damit die Mündung immer vor dem Fadenkreuz bleibt
const GUN_LEN = { shotgun: 352 * SG_SCALE, harpoon: 262, laser: 196 };
function gunPull() {
  const O = gunOrigin(), d = Math.hypot(mouse.x - O.x, mouse.y - O.y);
  return Math.max(0, GUN_LEN[G.weapon] + 90 - d);
}
function muzzle(len) {
  const O = gunOrigin(), a = Math.atan2(mouse.y - O.y, mouse.x - O.x), l = len - gunPull();
  return { x: O.x + Math.cos(a) * l, y: O.y + Math.sin(a) * l, a };
}
// Schrotflinte: Schrotgarbe um das Fadenkreuz, trifft alles darunter
function pointShot(px, py, playing) {
  if (!playing) { if (G.cool > 0) return; G.cool = 0.15; }
  G.recoil = 1; G.shake = Math.max(G.shake, 7);
  Snd.shot();
  if (playing) { G.shotT = 0; G.eject = true; Snd.pump(0.12); }
  const spread = 15 * (mouse.touch ? 1.4 : 1);
  const pellets = [];
  for (let i = 0; i < 9; i++) {
    const a = rand(0, TAU), r = spread * Math.sqrt(Math.random());
    pellets.push({ x: px + Math.cos(a) * r, y: py + Math.sin(a) * r });
  }
  const M = muzzle(GUN_LEN.shotgun);
  for (const q of pellets) parts.push({ k: 'tracer', x0: M.x + rand(-6, 6), y0: M.y + rand(-6, 6), x1: q.x, y1: q.y, life: 0.08, max: 0.08 });
  for (let i = 0; i < 4; i++) parts.push({ k: 'smoke', x: M.x, y: M.y, vx: Math.cos(M.a) * rand(40, 120), vy: Math.sin(M.a) * rand(40, 120) - 20, r: rand(8, 16), life: 0.6, max: 0.6 });
  const hits = [];
  for (let i = chicks.length - 1; i >= 0; i--) {
    const c = chicks[i];
    let h = hitTest(c, px, py);
    if (!h && pellets.some(q => hitTest(c, q.x, q.y))) h = 'body';
    if (h) hits.push([c, h]);
  }
  const egg = playing && eggShot(px, py);
  // Schrotkörner, die nichts getroffen haben, schlagen in Boden/Wasser ein
  for (const q of pellets) if (!chicks.some(c => hitTest(c, q.x, q.y))) pelletFx(q.x, q.y);
  if (!hits.length) { if (playing && !egg) G.streak = 0; return; }
  const res = { kills: 0, total: 0, heads: 0 };
  for (const [c, h] of hits) {
    const r = damage(c, h === 'head');
    res.total += r.pts;
    if (r.killed) {
      res.kills++;
      if (h === 'head') { res.heads++; popText(c.x, headPos(c).y - 50 * c.s, 'KOPFSCHUSS!', '#ffe14d', 22, 0.9); }
    }
  }
  if (playing) finishShot(px, py, res, 'shotgun');
}

// Harpune: fliegt perspektivisch in die Szene. Eine 3D-Gerade erscheint auf dem Bildschirm
// linear im Kehrwert der Tiefe (w = Perspektiv-Maßstab = chickScale(z)). Der Speer trifft
// nur Gegner in der Tiefe, die er gerade erreicht, fliegt im leichten Bogen und landet
// im Wasser/Boden statt endlos durch den Himmel.
const zFromScreenY = y => (y - H * 0.6) / (H * 0.37);
const groundAtW = w => H * 0.6 + ((w - 0.28) / 0.5) * H * 0.37;
function spearPos(p, w) {
  const f = (w - p.w0) / (p.wA - p.w0);
  return { x: p.ox + (p.ax - p.ox) * f, y: p.oy + (p.ay - p.oy) * f - p.K * (p.w0 - w) * (w - p.wA) };
}
function harpoonShot(px, py) {
  const O = gunOrigin();
  G.recoil = 1; G.shake = Math.max(G.shake, 3);
  Snd.harpoon();
  eggShot(px, py);
  // Zieltiefe: angeklickter Gegner > Wasser-/Bodenpunkt > ferner Himmel
  let wA = null;
  for (let i = chicks.length - 1; i >= 0; i--) if (hitTest(chicks[i], px, py)) { wA = chickScale(chicks[i].z); break; }
  if (wA === null) wA = py > HORIZON() + 8 ? chickScale(clamp(zFromScreenY(py), 0, 1)) : 0.3;
  parts.push({
    k: 'spear', ox: O.x, oy: O.y, ax: px, ay: py, w0: SPEAR_W0, wA, K: 260,
    dist: 1 / SPEAR_W0, stuck: 0, hit: new Set(), shot: { kills: 0, total: 0, heads: 0, any: false, x: px, y: py },
  });
}
function spearEnd(p) {
  const s = p.shot;
  if (G.state !== 'play') return;
  if (s.any) finishShot(s.x, s.y, s, 'harpoon'); else G.streak = 0;
}
function updateSpear(p, dt) {
  if (p.stuck) { p.stuck -= dt; if (p.stuck <= 0) p.dead = true; return; }
  const wPrev = 1 / p.dist;
  p.dist += SPEAR_SPEED * dt;
  const w = 1 / p.dist;
  for (const c of chicks) {
    if (!c.alive || p.hit.has(c)) continue;
    const wc = chickScale(c.z);
    if (wc > wPrev || wc <= w) continue;
    const q = spearPos(p, wc), h = hitTest(c, q.x, q.y);
    if (!h) continue;
    p.hit.add(c); p.shot.any = true;
    const r = damage(c, h === 'head', 2);
    p.shot.total += r.pts;
    if (r.killed) {
      p.shot.kills++;
      if (h === 'head') { p.shot.heads++; popText(c.x, headPos(c).y - 50 * c.s, 'KOPFSCHUSS!', '#ffe14d', 22, 0.9); }
    }
  }
  const q = spearPos(p, w);
  if (q.y >= groundAtW(w) || w < 0.12 || q.x < -300 || q.x > W + 300) {
    if (q.y >= groundAtW(w) && w > 0.26) {
      p.stuck = 1.6; p.sx = q.x; p.sy = q.y;
      if (world().water) { parts.push({ k: 'ring', x: q.x, y: q.y, r: 3, s: w, life: 1, max: 1 }); Snd.splash(); }
      const col = world().water ? '#d0e8ff' : world().id === 'space' ? '#9090a0' : '#6b4a2a';
      for (let i = 0; i < 8; i++) parts.push({ k: 'dirt', x: q.x, y: q.y, vx: rand(-90, 90) * w, vy: rand(-300, -100) * w * world().gv, gy: q.y + 2, life: 1, r: rand(1.5, 3) * w + 1, col });
    } else p.dead = true;
    spearEnd(p);
  }
}

// Laser: Dauerfeuer, überhitzt
function startLaser() {
  if (G.over) { Snd.empty(); popText(mouse.x, mouse.y - 40, 'ZU HEISS!', '#ff6b6b', 24, 0.6); return; }
  G.firing = true; G.burst = { kills: 0 }; G.shots++; G.laserTick = 0;
  Snd.laserOn();
}
function stopLaser() {
  Snd.laserOff();
  if (!G.firing) return;
  G.firing = false;
  const b = G.burst; G.burst = null;
  if (G.state !== 'play' || !b) return;
  if (b.kills > 0) G.hits++; else G.streak = 0;
}
function laserTick() {
  const px = mouse.x, py = mouse.y;
  for (let i = 0; i < 3; i++) parts.push({ k: 'spark', x: px, y: py, vx: rand(-300, 300), vy: rand(-300, 200), life: 0.2, max: 0.2 });
  if (G.eggCool <= 0 && eggShot(px, py)) G.eggCool = 0.12;
  if (py > HORIZON() + 10 && Math.random() < 0.5) { dctx.fillStyle = 'rgba(20,20,30,0.4)'; ell(dctx, px + rand(-4, 4), py, 5, 2); dctx.fill(); }
  let kills = 0, total = 0;
  for (let i = chicks.length - 1; i >= 0; i--) {
    const c = chicks[i], h = hitTest(c, px, py);
    if (!h) continue;
    const r = damage(c, h === 'head');
    if (r.killed) {
      kills++; total += r.pts;
      G.kills++; G.streak++; G.maxStreak = Math.max(G.maxStreak, G.streak);
      if (h === 'head') { G.heads++; popText(c.x, headPos(c).y - 50 * c.s, 'KOPFSCHUSS!', '#ffe14d', 22, 0.9); }
      if (G.streak % 5 === 0) popText(W / 2, 150, `COMBO x${multiplier().toFixed(1)}`, '#7dd3ff', 44, 1.2);
      for (let j = 0; j < 6; j++) parts.push({ k: 'smoke', x: c.x, y: bodyPos(c).y, vx: rand(-40, 40), vy: rand(-80, -20), r: rand(6, 14) * c.s + 3, life: 0.8, max: 0.8 });
    }
  }
  if (!kills) return;
  if (G.burst) G.burst.kills += kills;
  if (kills >= 2) { total += 30 * kills * kills; Snd.multi(); popText(px, py - 70, kills === 2 ? 'DOPPELT!' : 'MASSAKER!', '#ff4d6d', 40, 1.3); }
  const pts = Math.round(total * multiplier());
  G.score += pts;
  popText(px, py - 30, '+' + pts, '#ffffff', 30, 0.9);
}

/* ---------------------------------------------------------------- Update */
function update(dt) {
  G.t += dt;
  const W0 = world();
  if (G.state === 'play') {
    G.time -= dt; G.elapsed += dt;
    if (G.time <= 0) { G.time = 0; endGame(); }
  }
  if (G.state === 'over') G.overT += dt;

  // Spawnen
  G.spawnT -= dt;
  if (G.spawnT <= 0) {
    const playing = G.state === 'play';
    const p = playing ? clamp(G.elapsed / ROUND_TIME, 0, 1) : 0.15;
    const max = playing ? 7 + p * 11 : 6;
    if (chicks.length < max) spawnWave(p);
    G.spawnT = playing ? rand(0.8, 1.3) * (1 - 0.6 * p) : rand(1.0, 2.0);
  }

  // Gegner bewegen
  for (const c of chicks) {
    if (!c.alive) continue;
    const T = TYPES[c.type];
    c.t += dt; c.flash = Math.max(0, c.flash - dt);
    const persp = 0.45 + 0.75 * c.z;
    if (T.leap) {
      // Hecht: Sprung im Bogen, schnappt sich das Ziel und taucht wieder ab
      c.leap += dt / 1.1;
      const u = Math.min(1, c.leap), hgt = 160;
      c.x = c.lx0 + (c.lx1 - c.lx0) * u;
      c.y = c.gy - Math.sin(Math.PI * u) * hgt * c.s;
      c.ang = Math.atan2(-Math.cos(Math.PI * u) * Math.PI * hgt * c.s, Math.abs(c.lx1 - c.lx0) + 1);
      if (u >= 1) {
        if (c.target && c.target.alive) {
          damage(c.target, false, 1, true);
          popText(c.x, c.gy - 70 * c.s, 'SCHNAPP!', '#7dffb0', 32, 1.2);
        }
        c.alive = false;
        parts.push({ k: 'ring', x: c.x, y: c.gy, r: 6, s: c.s * 2, life: 1, max: 1 });
        for (let i = 0; i < 12; i++) parts.push({ k: 'dirt', x: c.x, y: c.gy, vx: rand(-150, 150) * c.s, vy: rand(-450, -150) * c.s, gy: c.gy, life: 1.2, r: rand(2, 4) * c.s + 1, col: pick(['#d0e8ff', '#ffffff']) });
        Snd.splash();
      }
      continue;
    }
    if (T.monster) {
      // taucht auf, bleibt kurz, taucht wieder ab
      c.mt += dt;
      c.yoff = c.mt < 1.2 ? 140 * (1 - c.mt / 1.2) : c.mt < 4.7 ? 0 : 140 * Math.min(1, (c.mt - 4.7) / 1.2);
      c.y = c.gy + Math.sin(c.t * 1.5) * 2 * c.s;
      if (c.mt > 6) c.alive = false;
    } else if (T.rocket) {
      // Landefähre: steigt auf, fliegt dann quer übers Bild
      c.rt += dt;
      if (c.rt < 1.6) c.y = c.y0 - 91 * c.rt * c.rt;
      else { c.x += c.dir * 240 * dt; c.y = c.y0 - 233 + Math.sin(c.rt * 3) * 15; }
    } else if (T.fall) {
      // Ei fällt aus der Wolke; landet es, schlüpft ein Küken
      c.vy += 700 * dt; c.y += c.vy * dt; c.rot += dt * 3;
      if (c.y >= c.gy) {
        c.alive = false;
        dctx.fillStyle = '#ffd83a'; ell(dctx, c.x, c.gy, 10 * c.s, 3 * c.s); dctx.fill();
        dctx.fillStyle = '#fbfbf5'; dctx.fillRect(c.x - 8 * c.s, c.gy - 2, 4, 2); dctx.fillRect(c.x + 5 * c.s, c.gy - 1, 4, 2);
        G.egg.hatch.push({ x: c.x, z: c.z });
        Snd.voice('peep', 1.2, 0.05);
      }
    } else if (T.fly) {
      const sp = T.zig ? c.speed * (1 + 0.7 * Math.sin(c.t * 2.1)) : c.speed;
      c.x += c.dir * sp * persp * dt;
      c.y = c.ay0 + Math.sin(c.t * (T.zig ? 1.4 : 2.3)) * (T.zig ? 60 : 26);
    } else if (T.kind === 'frog') {
      if (c.hop === 0 && c.hopV === 0) {
        c.sit -= dt;
        if (c.sit <= 0) { c.hopV = rand(520, 720); c.sit = rand(0.4, 1.3); }
      }
      if (c.hopV !== 0 || c.hop > 0) {
        c.x += c.dir * c.speed * persp * dt;
        c.hop += c.hopV * dt; c.hopV -= 1700 * dt;
        if (c.hop <= 0) { c.hop = 0; c.hopV = 0; parts.push({ k: 'ring', x: c.x, y: c.gy, r: 4, s: c.s, life: 0.7, max: 0.7 }); }
      }
      c.y = c.gy - c.hop * c.s;
    } else if (T.swim) {
      c.x += c.dir * c.speed * persp * dt;
      if (T.dive) {
        c.diveT -= dt;
        if (c.diveT <= 0) {
          c.diving = !c.diving;
          c.diveT = c.diving ? rand(1, 2.2) : rand(2.5, 5);
          parts.push({ k: 'ring', x: c.x, y: c.gy, r: 4, s: c.s, life: 0.8, max: 0.8 });
          for (let i = 0; i < 6; i++) parts.push({ k: 'dirt', x: c.x, y: c.gy, vx: rand(-80, 80) * c.s, vy: rand(-250, -100) * c.s, gy: c.gy, life: 1, r: rand(1.5, 3), col: '#d0e8ff' });
        }
      }
      c.sub += ((c.diving ? 1 : 0) - c.sub) * Math.min(1, dt * 6);
      c.yoff = (T.size > 1.2 ? 14 : 18) + c.sub * 90;
      c.y = c.gy + Math.sin(c.t * 3) * 1.5 * c.s;
    } else {
      if (G.egg.peckT > 0 && W0.id === 'farm') c.pause = Math.max(c.pause, 0.15); // Körner picken
      if (c.pause > 0) {
        c.pause -= dt;
        c.peck = Math.max(0, Math.sin(c.t * 14));
      } else {
        c.peck = 0;
        c.x += c.dir * c.speed * persp * dt;
        c.walk += dt * (6 + c.speed * 0.06);
        if (c.hop === 0 && Math.random() < dt * T.peck) c.pause = rand(0.5, 1.3);
      }
      const hg = T.lowGrav ? 520 : 1500;
      if (c.hop === 0 && c.hopV === 0 && c.pause <= 0 && Math.random() < dt * T.hop) c.hopV = T.lowGrav ? rand(220, 330) : rand(260, 420);
      if (c.hopV !== 0 || c.hop > 0) {
        c.hop += c.hopV * dt; c.hopV -= hg * dt;
        if (c.hop <= 0) { c.hop = 0; c.hopV = 0; }
      }
      c.y = c.gy - c.hop * c.s;
    }
    if ((c.dir > 0 && c.x > W + 120 * c.s) || (c.dir < 0 && c.x < -120 * c.s)) c.alive = false;
  }
  chicks = chicks.filter(c => c.alive);

  // Stimmen
  if (chicks.length && Math.random() < dt * Math.min(2.5, chicks.length * 0.18)) {
    const c = pick(chicks), T = TYPES[c.type];
    if (T.voice !== 'squawk' && T.voice !== 'honk' || Math.random() < 0.3) Snd.voice(T.voice, rand(0.9, 1.15) * (T.gold ? 1.2 : 1), 0.02 + 0.04 * c.z);
  }

  updateEggs(dt);

  // Explosionen
  for (const p of G.pending) { p.t -= dt; if (p.t <= 0) { p.done = true; explode(p.x, p.y, p.s, p.z, p.kind); } }
  G.pending = G.pending.filter(p => !p.done);

  // Laser
  if (G.firing && G.state === 'play' && G.weapon === 'laser') {
    if (G.wish <= 0) G.heat = Math.min(1, G.heat + dt * 0.42);
    Snd.laserHeat(G.heat);
    G.laserTick -= dt;
    if (G.laserTick <= 0) { G.laserTick = 0.05; laserTick(); }
    if (G.heat >= 1) { G.over = true; stopLaser(); Snd.overheat(); popText(W / 2, H - 170, 'ÜBERHITZT!', '#ff5a5a', 36, 1.2); }
  } else {
    if (G.firing) stopLaser();
    G.heat = Math.max(0, G.heat - dt * (G.over ? 0.4 : 0.65));
    if (G.over && G.heat <= 0.2) G.over = false;
  }

  // Partikel
  const grav = W0.grav;
  for (const p of parts) {
    switch (p.k) {
      case 'blood':
        p.vy += grav * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.vy > 0 && p.y >= p.gy) {
          p.dead = true;
          if (W0.water && Settings.gore) { if (p.x > -20 && p.x < W + 20) addSlick(p.x, p.gy, p.r * 1.3, p.col); break; }
          if (p.x > -20 && p.x < W + 20) {
            dctx.fillStyle = p.col;
            if (Settings.gore) { ell(dctx, p.x, p.gy, p.r * 1.5, p.r * 0.55); dctx.fill(); }
            else dctx.fillRect(p.x - p.r * 0.7, p.gy - p.r * 0.35, p.r * 1.4, p.r * 0.7);
          }
        }
        break;
      case 'feather':
        p.vy = Math.min(p.vy + grav * 0.4 * dt, 45 * (0.5 + p.s)); p.vx *= Math.pow(0.12, dt);
        p.ph += dt * 4; p.x += (p.vx + Math.sin(p.ph) * 40 * p.s) * dt; p.y += p.vy * dt;
        p.rot = Math.sin(p.ph) * 0.8; p.life -= dt; if (p.life <= 0) p.dead = true;
        break;
      case 'chunk':
        if (p.rest === 2) { // treibt auf dem Wasser, geht langsam unter
          p.t2 += dt; p.x += 8 * dt; p.y = p.gy + Math.sin(p.t2 * 2.5 + p.ph) * 1.5 + Math.max(0, p.t2 - p.life + 1.5) * 6 * p.s;
          p.rot += Math.sin(p.t2 * 1.7) * 0.2 * dt;
          if (Math.random() < dt * 3) addSlick(p.x, p.gy, rand(3, 6) * p.s, pick(p.bc));
          if (p.t2 >= p.life) p.dead = true;
          break;
        }
        if (p.rest === 0) {
          p.vy += grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
          if (Math.random() < dt * 30) bloodDrop(p.x, p.y, p.vx * 0.15 + rand(-30, 30), p.vy * 0.15, rand(1, 3) * (0.5 + p.s * 0.5), p.gy + rand(-4, 4), p.bc);
          if (p.y >= p.gy && p.vy > 0) {
            p.y = p.gy;
            if (W0.water) {
              p.rest = 2; p.t2 = 0; p.ph = rand(0, TAU); p.life += 2;
              parts.push({ k: 'ring', x: p.x, y: p.gy, r: 2, s: p.s, life: 0.8, max: 0.8 });
              addSlick(p.x, p.gy, 10 * p.s, pick(p.bc));
            } else if (p.vy > (W0.floaty ? 40 : 180)) {
              p.vy *= W0.floaty ? -0.55 : -0.32; p.vx *= W0.floaty ? 0.8 : 0.55; p.vr *= W0.floaty ? 0.8 : 0.5;
              dctx.fillStyle = pick(p.bc); ell(dctx, p.x, p.gy, 9 * p.s, 3 * p.s); dctx.fill();
            } else { p.rest = 1; p.vy = 0; }
          }
        } else {
          p.life -= dt;
          if (p.life <= 0) { p.dead = true; dctx.globalAlpha = 0.9; drawPiece(dctx, p); dctx.globalAlpha = 1; }
        }
        if (p.x < -200 || p.x > W + 200) p.dead = true;
        break;
      case 'dirt':
        p.vy += grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
        if ((p.vy > 0 && p.y >= p.gy) || p.life <= 0) {
          p.dead = true;
          if (p.stamp) { dctx.fillStyle = p.col; dctx.fillRect(p.x - 1.5, p.gy - 1, 3, 2); }
        }
        break;
      case 'glass':
        p.vy += grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.life -= dt; if (p.life <= 0) p.dead = true;
        break;
      case 'star':
        p.vy += 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += dt * 8; p.life -= dt; if (p.life <= 0) p.dead = true;
        break;
      case 'fire': case 'smoke':
        p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= Math.pow(0.2, dt); p.vy *= Math.pow(0.4, dt);
        p.r += dt * (p.k === 'fire' ? 60 : 25); p.life -= dt; if (p.life <= 0) p.dead = true;
        break;
      case 'spark':
        p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; if (p.life <= 0) p.dead = true;
        break;
      case 'poof':
        p.r += dt * 160 * p.s; p.life -= dt; if (p.life <= 0) p.dead = true;
        break;
      case 'ring':
        p.r += dt * 45 * (0.5 + p.s); p.life -= dt; if (p.life <= 0) p.dead = true;
        break;
      case 'bubble':
        p.y -= dt * 25; p.life -= dt; if (p.life <= 0) p.dead = true;
        break;
      case 'spear': updateSpear(p, dt); break;
      case 'tracer': p.life -= dt; if (p.life <= 0) p.dead = true; break;
      case 'shell':
        p.vy += 1500 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
        if (p.y > H + 60) p.dead = true;
        break;
      case 'text':
        p.y += p.vy * dt; p.vy *= Math.pow(0.15, dt); p.life -= dt; if (p.life <= 0) p.dead = true;
        break;
    }
  }
  parts = parts.filter(p => !p.dead);
  if (parts.length > 3500) parts.splice(0, parts.length - 3500);

  for (const s of splats) {
    s.life -= dt;
    for (const d of s.drips) { d.len = Math.min(d.max, d.len + d.v * dt); d.v *= Math.pow(0.7, dt); }
  }
  splats = splats.filter(s => s.life > 0);

  for (const k of slicks) {
    k.life -= dt; k.ph += dt;
    k.r += (k.gr - k.r) * Math.min(1, dt * 1.2);
    k.x += k.vx * dt;
  }
  slicks = slicks.filter(k => k.life > 0);

  // Flinte: Hülse fliegt beim Repetieren raus
  G.shotT += dt;
  if (G.eject && G.shotT > 0.15) {
    G.eject = false;
    const O = gunOrigin(), a = Math.atan2(mouse.y - O.y, mouse.x - O.x), side = Math.cos(a) >= 0 ? -1 : 1;
    parts.push({ k: 'shell', x: O.x + Math.cos(a) * 150, y: O.y + Math.sin(a) * 150,
      vx: Math.cos(a + side * 1.6) * rand(300, 450), vy: Math.sin(a + side * 1.6) * rand(300, 450) - 350, rot: a, vr: rand(10, 20) * side });
  }

  ambUpdate(dt, W0);

  if (G.reload > 0) { G.reload -= dt; if (G.reload <= 0) { G.reload = 0; G.ammo[G.weapon] = WEAPONS[G.weapon].ammo; } }
  G.cool = Math.max(0, G.cool - dt);
  G.switchT = Math.max(0, G.switchT - dt);
  G.recoil = Math.max(0, G.recoil - dt * 6);
  G.shake = Math.max(0, G.shake - dt * 60);
  G.flash = Math.max(0, G.flash - dt * 2.5);
}

/* ---------------------------------------------------------------- Waffen zeichnen */
function drawShotgun() {
  // Pumpgun: Schaft, Verschluss, Lauf, Röhrenmagazin, Vorderschaft (repetiert nach dem Schuss)
  const t = G.shotT, back = t > 0.07 && t < 0.24 ? Math.sin((t - 0.07) / 0.17 * Math.PI) * 42 : 0;
  ctx.scale(SG_SCALE, SG_SCALE);
  ctx.fillStyle = '#6b4a2a';
  ctx.beginPath(); ctx.moveTo(-50, -16); ctx.lineTo(112, -13); ctx.lineTo(112, 15); ctx.lineTo(-50, 26); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#9a6a3a';
  ctx.beginPath(); ctx.moveTo(-44, -12); ctx.lineTo(108, -10); ctx.lineTo(108, 2); ctx.lineTo(-44, 6); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#1a1210'; ctx.fillRect(-58, -16, 10, 42);
  ctx.fillStyle = '#3a3a48'; rrect(ctx, 108, -15, 72, 30, 5); ctx.fill();
  ctx.fillStyle = '#5a5650'; ctx.fillRect(112, -13, 64, 5);
  ctx.strokeStyle = '#3a3a48'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(140, 18, 11, 0, Math.PI); ctx.stroke();
  ctx.fillStyle = '#2a2a32'; ctx.fillRect(176, -1, 132, 9);
  ctx.fillStyle = '#3a3a48'; ctx.fillRect(176, -13, 160, 11);
  ctx.fillStyle = '#9a968c'; ctx.fillRect(180, -12, 152, 3);
  ctx.fillStyle = '#1a1a1a'; ctx.fillRect(330, -14, 8, 13);
  ctx.fillStyle = '#6b4a2a'; rrect(ctx, 205 - back, -5, 66, 20, 6); ctx.fill();
  ctx.strokeStyle = '#3b2a1e'; ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(214 - back + i * 11, -3); ctx.lineTo(214 - back + i * 11, 13); ctx.stroke(); }
  if (t < 0.06) { // Mündungsfeuer
    const r = 30 + Math.random() * 20;
    ctx.fillStyle = '#ffa020'; ctx.beginPath();
    for (let i = 0; i < 12; i++) { const rr = i % 2 ? r * 0.45 : r; const aa = i * TAU / 12; ctx.lineTo(352 + Math.cos(aa) * rr * 1.4, -7 + Math.sin(aa) * rr); }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff3a0'; ell(ctx, 352, -7, r * 0.7, r * 0.45); ctx.fill();
  }
}
function drawGun() {
  if (G.state !== 'play') return;
  const O = gunOrigin(), a = Math.atan2(mouse.y - O.y, mouse.x - O.x), rec = G.recoil * 16;
  ctx.save(); ctx.translate(O.x, O.y); ctx.rotate(a); ctx.translate(-rec - gunPull(), 0);
  if (Math.cos(a) < 0) ctx.scale(1, -1); // Unterseite bleibt unten
  if (G.weapon === 'shotgun') drawShotgun();
  else if (G.weapon === 'harpoon') {
    ctx.fillStyle = '#6b4a2a'; rrect(ctx, -10, -16, 130, 32, 8); ctx.fill();
    ctx.fillStyle = '#3b2a1e'; ctx.fillRect(20, -16, 14, 32);
    ctx.fillStyle = '#8a96a0'; ctx.fillRect(100, -9, 70, 18);
    ctx.fillStyle = '#4a5660'; ctx.fillRect(160, -12, 12, 24);
    const loaded = G.ammo.harpoon > 0 && G.reload <= 0 && G.cool <= 0.1;
    if (loaded) {
      ctx.fillStyle = '#9a7a4a'; ctx.fillRect(110, -4, 120, 8);
      ctx.fillStyle = '#d0d8e0';
      ctx.beginPath(); ctx.moveTo(230, -10); ctx.lineTo(262, 0); ctx.lineTo(230, 10); ctx.closePath(); ctx.fill();
    }
  } else {
    const hc = G.over ? '#ff4a4a' : G.heat > 0.7 ? '#ffa020' : '#7dff4a';
    ctx.fillStyle = '#606070'; rrect(ctx, -10, -20, 160, 40, 10); ctx.fill();
    ctx.fillStyle = '#3a3a48'; ctx.fillRect(140, -9, 50, 18);
    for (let i = 0; i < 3; i++) { ctx.fillStyle = hc; ctx.fillRect(40 + i * 30, -14, 14, 28); }
    if (G.firing) { ctx.fillStyle = '#ffffff'; circ(ctx, 196, 0, 10 + Math.random() * 6); ctx.fill(); }
  }
  ctx.restore();
}
function drawBeam() {
  if (!G.firing) return;
  const O = gunOrigin(), a = Math.atan2(mouse.y - O.y, mouse.x - O.x);
  const sx = O.x + Math.cos(a) * 190, sy = O.y + Math.sin(a) * 190;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(125,255,74,0.55)'; ctx.lineWidth = 16 + Math.random() * 6;
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4 + Math.random() * 3;
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
  ctx.fillStyle = 'rgba(200,255,154,0.8)'; circ(ctx, mouse.x, mouse.y, 14 + Math.random() * 8); ctx.fill();
}
function drawSpear(p) {
  // Spitze und Ende liegen in unterschiedlicher Tiefe -> Speer verkürzt sich perspektivisch
  const w = 1 / p.dist;
  const tip = p.stuck ? { x: p.sx, y: p.sy } : spearPos(p, w);
  const tail = spearPos(p, Math.min(p.w0, 1 / Math.max(0.05, p.dist - 0.3)));
  ctx.globalAlpha = p.stuck ? clamp(p.stuck / 0.6, 0, 1) : 1;
  if (!p.stuck) {
    const M = muzzle(170), mid = spearPos(p, (p.w0 + w) / 2);
    ctx.strokeStyle = '#c8c8d0'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(M.x, M.y); ctx.quadraticCurveTo(mid.x, mid.y + 20, tail.x, tail.y); ctx.stroke();
  }
  ctx.strokeStyle = '#9a7a4a'; ctx.lineWidth = Math.max(1.5, 8 * w); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(tail.x, tail.y); ctx.lineTo(tip.x, tip.y); ctx.stroke();
  let dx = tip.x - tail.x, dy = tip.y - tail.y; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
  const hs = 26 * w + 4;
  ctx.fillStyle = '#e0e8f0';
  ctx.beginPath(); ctx.moveTo(tip.x + dx * hs * 0.4, tip.y + dy * hs * 0.4);
  ctx.lineTo(tip.x - dx * hs - dy * hs * 0.35, tip.y - dy * hs + dx * hs * 0.35);
  ctx.lineTo(tip.x - dx * hs + dy * hs * 0.35, tip.y - dy * hs - dx * hs * 0.35);
  ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1;
}

/* ---------------------------------------------------------------- Rendern */
function render() {
  syncPalette();
  ctx = lctx;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = world().sky; ctx.fillRect(0, 0, loCanvas.width, loCanvas.height);
  ctx.setTransform(KL, 0, 0, KL, 0, 0);

  ctx.save();
  if (G.shake > 0) ctx.translate(rand(-1, 1) * G.shake, rand(-1, 1) * G.shake);
  ctx.drawImage(bgCanvas, 0, 0, W, H);
  drawEggs();
  ambDraw();
  ctx.drawImage(decalCanvas, 0, 0, W, H);

  for (const k of slicks) {
    ctx.globalAlpha = clamp(k.life / 3, 0, 1) * 0.75; ctx.fillStyle = k.col;
    const wob = 1 + Math.sin(k.ph * 1.3) * 0.06;
    ell(ctx, k.x, k.y, k.r * wob, k.r * 0.3 / wob); ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (const p of parts) if (p.k === 'chunk' && p.rest) {
    if (p.rest === 2) {  // im Wasser: nur der Teil über der Oberfläche
      ctx.save(); ctx.beginPath(); ctx.rect(p.x - 80, p.gy - 120, 160, 120 + 2 * p.s); ctx.clip();
      ctx.globalAlpha = clamp((p.life - p.t2) / 1.2, 0, 1); drawPiece(ctx, p); ctx.restore();
    } else drawPiece(ctx, p);
  }
  for (const p of parts) if (p.k === 'ring') {
    ctx.strokeStyle = `rgba(220,240,255,${0.8 * p.life / p.max})`; ctx.lineWidth = 2;
    ell(ctx, p.x, p.y, p.r * 3, p.r * 0.7); ctx.stroke();
  }
  for (const c of chicks) drawEnemy(c);

  for (const p of parts) {
    switch (p.k) {
      case 'blood': ctx.fillStyle = p.col; circ(ctx, p.x, p.y, p.r); ctx.fill(); break;
      case 'feather': {
        ctx.save(); ctx.globalAlpha = clamp(p.life / 0.8, 0, 1);
        ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.col;
        ell(ctx, 0, 0, 9 * p.s, 3.2 * p.s); ctx.fill();
        ctx.restore(); break;
      }
      case 'chunk': if (!p.rest) drawPiece(ctx, p); break;
      case 'dirt': ctx.fillStyle = p.col; circ(ctx, p.x, p.y, p.r); ctx.fill(); break;
      case 'glass':
        ctx.save(); ctx.globalAlpha = clamp(p.life / p.max, 0, 1); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = '#c8f0ff'; ctx.beginPath(); ctx.moveTo(-p.r, 0); ctx.lineTo(0, -p.r * 0.6); ctx.lineTo(p.r, p.r * 0.4); ctx.closePath(); ctx.fill();
        ctx.restore(); break;
      case 'star': {
        ctx.save(); ctx.globalAlpha = clamp(p.life / p.max, 0, 1); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = '#ffe14d'; ctx.beginPath();
        for (let i = 0; i < 10; i++) { const r = (i % 2 ? 5 : 12) * (0.5 + p.s); const a = i * TAU / 10; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
        ctx.closePath(); ctx.fill(); ctx.restore(); break;
      }
      case 'spark': ctx.fillStyle = '#e0ffd0'; ctx.fillRect(p.x - 3, p.y - 3, 6, 6); break;
      case 'bubble': ctx.strokeStyle = 'rgba(230,245,255,0.8)'; ctx.lineWidth = 1.5; circ(ctx, p.x, p.y, p.r); ctx.stroke(); break;
      case 'poof': ctx.fillStyle = `rgba(255,255,255,${0.8 * p.life / p.max})`; circ(ctx, p.x, p.y, p.r); ctx.fill(); break;
      case 'smoke': ctx.fillStyle = `rgba(70,65,60,${0.5 * p.life / p.max})`; circ(ctx, p.x, p.y, p.r); ctx.fill(); break;
      case 'fire': {
        const a = p.life / p.max;
        ctx.fillStyle = p.green ? `rgba(${Math.round(120 + 100 * a)},255,80,${a})` : `rgba(255,${Math.round(120 + 120 * a)},40,${a})`;
        circ(ctx, p.x, p.y, p.r); ctx.fill(); break;
      }
      case 'spear': drawSpear(p); break;
      case 'tracer': {
        const a = p.life / p.max, f = 1 - a;
        ctx.strokeStyle = `rgba(255,250,200,${a})`; ctx.lineWidth = 3.5;
        ctx.beginPath(); ctx.moveTo(p.x0 + (p.x1 - p.x0) * f * 0.7, p.y0 + (p.y1 - p.y0) * f * 0.7); ctx.lineTo(p.x1, p.y1); ctx.stroke();
        ctx.fillStyle = '#fff3a0'; ctx.fillRect(p.x1 - 2, p.y1 - 2, 4, 4);
        break;
      }
      case 'shell':
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = '#c8102e'; ctx.fillRect(-14, -6, 22, 12);
        ctx.fillStyle = '#d9a441'; ctx.fillRect(8, -6, 8, 12);
        ctx.restore(); break;
    }
  }
  if (world().id === 'farm' && (G.state === 'play' || G.state === 'over') && G.egg.sunset) drawSunset();
  drawNovaWave();
  drawBeam();
  drawGun();
  ctx.restore();

  // Blut auf der Linse
  for (const s of splats) {
    ctx.globalAlpha = clamp(s.life / 1.5, 0, 1) * 0.88;
    ctx.fillStyle = s.col;
    for (const b of s.blobs) { circ(ctx, s.x + b.ox, s.y + b.oy, b.r); ctx.fill(); }
    for (const d of s.drips) {
      ctx.fillRect(s.x + d.ox - d.w / 2, s.y, d.w, d.len);
      circ(ctx, s.x + d.ox, s.y + d.len, d.w * 0.75); ctx.fill();
    }
    ctx.globalAlpha *= 0.35; ctx.fillStyle = '#ffffff';
    ell(ctx, s.x - s.blobs[0].r * 0.35, s.y - s.blobs[0].r * 0.4, s.blobs[0].r * 0.3, s.blobs[0].r * 0.15, -0.5); ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (G.flash > 0) { ctx.fillStyle = `rgba(255,240,200,${G.flash * 0.6})`; ctx.fillRect(0, 0, W, H); }
  quantize();

  // hochskalieren ohne Glättung -> Pixel-Look; danach scharfe Oberfläche
  ctx = mainCtx;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(loCanvas, 0, 0, cv.width, cv.height);
  ctx.setTransform(K, 0, 0, K, 0, 0);
  for (const p of parts) if (p.k === 'text') {
    ctx.globalAlpha = clamp(p.life / (p.max * 0.4), 0, 1);
    txt(p.s, p.x, p.y, p.size, p.col);
    ctx.globalAlpha = 1;
  }

  buttons = [];
  if (G.state === 'play') drawHUD();
  else if (G.state === 'menu') drawMenu();
  else if (G.state === 'worlds') drawWorlds();
  else if (G.state === 'album') drawAlbum();
  else if (G.state === 'over') { drawHUD(); drawOver(); }
  if (G.paused) {
    buttons = [];
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H);
    txt('PAUSE', W / 2, H / 2 - 110, 72, '#ffd83a');
    button('WEITER', W / 2 - 290, H / 2 - 20, 270, 72, () => { G.paused = false; });
    button('MENÜ', W / 2 + 20, H / 2 - 20, 270, 72, () => { G.paused = false; G.state = 'menu'; }, '#ffe9a8');
    if (!mouse.touch) txt('P / ESC = weiter', W / 2, H / 2 + 110, 22, '#fff');
  }
  if (isPortrait()) {
    buttons = [];
    ctx.fillStyle = '#14110d'; ctx.fillRect(0, 0, W, H);
    drawRotateHint();
  }
  drawCrosshair();
}

/* ---------------------------------------------------------------- Oberfläche */
function drawRotateHint() {
  const cx = W / 2, cy = H / 2 - 60, a = Math.sin(performance.now() / 500) * 0.8 - 0.4;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(clamp(a, -Math.PI / 2, 0));
  ctx.fillStyle = '#ffd83a'; rrect(ctx, -60, -110, 120, 220, 16); ctx.fill();
  ctx.fillStyle = '#4fa6ee'; ctx.fillRect(-48, -90, 96, 180);
  ctx.restore();
  txt('BITTE HANDY QUER HALTEN', W / 2, H / 2 + 150, 46, '#ffd83a');
}

function drawAmmo() {
  const wk = G.weapon, w = WEAPONS[wk];
  const right = W - 34, base = H - 34;
  let left = right;
  if (wk === 'shotgun') {
    for (let i = 0; i < w.ammo; i++) {
      const x = right - i * 26;
      ctx.globalAlpha = i < G.ammo.shotgun ? 1 : 0.25;
      ctx.fillStyle = '#c8102e'; rrect(ctx, x - 9, base - 46, 18, 36, 4); ctx.fill();
      ctx.fillStyle = '#d9a441'; ctx.fillRect(x - 9, base - 12, 18, 12);
      ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(x - 6, base - 43, 4, 28);
    }
    left = right - w.ammo * 26;
  } else if (wk === 'harpoon') {
    for (let i = 0; i < w.ammo; i++) {
      const x = right - i * 34;
      ctx.globalAlpha = i < G.ammo.harpoon ? 1 : 0.25;
      ctx.fillStyle = '#9a7a4a'; ctx.fillRect(x - 3, base - 50, 6, 50);
      ctx.fillStyle = '#e0e8f0';
      ctx.beginPath(); ctx.moveTo(x, base - 66); ctx.lineTo(x - 8, base - 46); ctx.lineTo(x + 8, base - 46); ctx.closePath(); ctx.fill();
    }
    left = right - w.ammo * 34;
  } else {
    const bw = 240, bx = right - bw, by = base - 34;
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; rrect(ctx, bx - 4, by - 4, bw + 8, 34, 8); ctx.fill();
    const hc = G.over ? '#ff4a4a' : G.heat > 0.7 ? '#ffa020' : '#7dff4a';
    ctx.fillStyle = hc; rrect(ctx, bx, by, Math.max(6, bw * G.heat), 26, 6); ctx.fill();
    txt(G.over ? 'ÜBERHITZT' : 'HITZE', bx + bw / 2, by + 13, 18, '#fff');
    left = bx;
  }
  ctx.globalAlpha = 1;
  txt(w.name, right, base - (wk === 'harpoon' ? 86 : 70), 18, '#ffe9a8', 'right');
  if (wk !== 'laser') buttons.push({ x: left - 20, y: H - 110, w: right - left + 54, h: 110, act: reload, silent: true });
}

function drawHUD() {
  txt('PUNKTE', 28, 30, 16, '#ffe9a8', 'left');
  txt(String(G.score), 28, 66, 44, '#fff', 'left');
  const m = multiplier();
  if (m > 1 && G.state === 'play') txt(`COMBO x${m.toFixed(1)}`, 28, 108, 22, '#7dd3ff', 'left');

  const tt = Math.ceil(G.time);
  const low = G.time <= 10 && G.state === 'play';
  const pulse = low ? 1 + 0.12 * Math.abs(Math.sin(G.t * 6)) : 1;
  txt(`${Math.floor(tt / 60)}:${String(tt % 60).padStart(2, '0')}`, W / 2, 42, 46 * pulse, low ? '#ff5a5a' : '#fff');

  if (G.wish > 0 && G.state === 'play') txt(`UNENDLICH FEUER ${Math.ceil(G.wish)}`, W / 2, 92, 20, `hsl(${(G.t * 300) % 360},100%,70%)`);
  if (G.egg.sunset && G.state === 'play' && world().id === 'farm') txt('x2 PUNKTE', W / 2, 92, 20, '#ffa020');
  txt('REKORD', W - 28, 30, 16, '#ffe9a8', 'right');
  txt(String(Math.max(progress.best[world().id], G.score)), W - 28, 62, 30, '#fff', 'right');

  drawAmmo();
  if (G.state !== 'play') return;

  // Pause-Knopf
  const px = W / 2 + 120, py = 14;
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; rrect(ctx, px, py, 56, 56, 12); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillRect(px + 17, py + 15, 8, 26); ctx.fillRect(px + 31, py + 15, 8, 26);
  buttons.push({ x: px - 10, y: 0, w: 80, h: 80, act: () => { G.paused = true; stopLaser(); }, silent: true });

  if (G.reload > 0) txt('LADE…', W - 150, H - 140, 24, '#ffe14d');
  else if (G.weapon !== 'laser' && G.ammo[G.weapon] === 0 && Math.sin(G.t * 10) > -0.2) {
    txt(mouse.touch ? 'NACHLADEN!' : 'NACHLADEN!  R / LEERTASTE / RECHTSKLICK', W / 2, H - 50, 28, '#ff5a5a');
  }

  // Waffenliste
  const list = WEAPON_ORDER.filter(k => weaponsUnlocked().includes(k));
  if (mouse.touch) {
    if (G.weapon !== 'laser') {
      const rx = 100, ry = H - 100, empty = G.ammo[G.weapon] === 0 && G.reload <= 0;
      const pulse2 = empty ? 1 + 0.08 * Math.sin(G.t * 12) : 1;
      ctx.fillStyle = empty ? 'rgba(220,30,40,0.75)' : 'rgba(0,0,0,0.4)';
      circ(ctx, rx, ry, 70 * pulse2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; circ(ctx, rx, ry, 70 * pulse2); ctx.stroke();
      txt('LADEN', rx, ry, 26, '#fff');
      buttons.push({ x: rx - 85, y: ry - 85, w: 170, h: 170, act: reload, silent: true });
    }
    if (list.length > 1) {
      const wx = 70, wy = H - 300;
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; rrect(ctx, wx - 50, wy - 40, 160, 80, 14); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke();
      txt('WAFFE', wx + 30, wy - 12, 18, '#ffe9a8');
      txt(WEAPONS[G.weapon].short, wx + 30, wy + 16, 18, '#fff');
      buttons.push({ x: wx - 60, y: wy - 50, w: 180, h: 100, act: () => cycleWeapon(1), silent: true });
    }
  } else if (list.length > 1) {
    list.forEach((k, i) => {
      const on = k === G.weapon, y = H - 40 - (list.length - 1 - i) * 30;
      txt(`${WEAPON_ORDER.indexOf(k) + 1} ${WEAPONS[k].short}`, 28, y, on ? 22 : 18, on ? '#fff3a0' : 'rgba(255,255,255,0.6)', 'left');
    });
  }
}

function button(label, x, y, w, h, act, col = '#ffd83a') {
  const hover = mouse.x > x && mouse.x < x + w && mouse.y > y && mouse.y < y + h && !mouse.touch;
  ctx.fillStyle = 'rgba(40,15,0,0.55)'; rrect(ctx, x + 4, y + 6, w, h, 14); ctx.fill();
  ctx.fillStyle = hover ? '#fff3b0' : col; rrect(ctx, x, y, w, h, 14); ctx.fill();
  ctx.strokeStyle = '#3b1600'; ctx.lineWidth = 4; ctx.stroke();
  txt(label, x + w / 2, y + h / 2 + 1, Math.min(30, h * 0.45), '#3b1600', 'center', null);
  buttons.push({ x, y, w, h, act });
}

function drawTitle(y) {
  const title = 'CHICKEN BLAST';
  ctx.save();
  ctx.font = `60px ${FONT}`;
  const total = ctx.measureText(title).width;
  let x = W / 2 - total / 2;
  for (let i = 0; i < title.length; i++) {
    const ch = title[i], w = ctx.measureText(ch).width;
    const dy = Math.sin(G.t * 3 + i * 0.5) * 6;
    ctx.save(); ctx.translate(x + w / 2, y + dy); ctx.rotate(Math.sin(G.t * 2 + i) * 0.05);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.lineWidth = 14; ctx.strokeStyle = '#5c0008'; ctx.strokeText(ch, 0, 0);
    ctx.fillStyle = i < 7 ? '#ffd83a' : '#e3102a'; ctx.fillText(ch, 0, 0);
    ctx.restore();
    x += w;
  }
  ctx.restore();
  if (Settings.gore) {
    ctx.fillStyle = '#b3000f';
    for (let i = 0; i < 6; i++) {
      const dx = W / 2 - 180 + i * 75, len = 10 + ((G.t * 18 + i * 13) % 40);
      ctx.fillRect(dx - 3, y + 40, 6, len); circ(ctx, dx, y + 40 + len, 5); ctx.fill();
    }
  }
}

function drawMenu() {
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, 0, W, H);
  drawTitle(130);
  buttons.push({ x: W / 2 - 420, y: 80, w: 840, h: 100, act: titleTap, silent: true });
  if (Settings.bighead) txt('RIESENKÖPFE', 28, 30, 18, '#ffd83a', 'left');
  txt('Ballere in 90 Sekunden so viele Küken weg wie möglich!', W / 2, 225, 24, '#fff');
  const bw = 340, bx = W / 2 - bw / 2;
  button('SPIELEN', bx, 270, bw, 70, () => { G.state = 'worlds'; });
  button(Settings.gore ? 'BLUT: VOLL' : 'BLUT: KONFETTI', bx, 355, bw, 52, () => { Settings.gore = !Settings.gore; store.set('gore', Settings.gore); }, '#ffb3b3');
  button(Settings.sound ? 'TON: AN' : 'TON: AUS', bx - bw / 2 - 10, 420, bw, 52, () => { Settings.sound = !Settings.sound; store.set('sound', Settings.sound); }, '#b3e0ff');
  button(`GEHEIMNISSE ${progress.eggs.length}/${EGGS.length}`, bx + bw / 2 + 10, 420, bw, 52, () => { G.state = 'album'; }, '#ff90e0');
  const lines = mouse.touch ? [
    'Tippen = Schuss  -  LADEN-Knopf = Nachladen',
    'WAFFE-Knopf = Waffe wechseln',
    'Weit weg = mehr Punkte  -  Kopfschuss x1.5',
    'Gold +5 Sek  -  Bomben reißen alle mit',
  ] : [
    'Klick = Schuss  -  R/Leertaste/Rechtsklick = Laden',
    '1/2/3, Q oder Mausrad = Waffe  -  P = Pause  -  F = Vollbild',
    'Weit weg = mehr Punkte  -  Kopfschuss x1.5',
    'Mehrere auf einmal = Bonus  -  Serie = Combo',
    'Gold +5 Sek  -  Bomben reißen alle in der Nähe mit',
  ];
  const ls = mouse.touch ? 24 : 17, lh = mouse.touch ? 34 : 26;
  lines.forEach((l, i) => txt(l, W / 2, 500 + i * lh, ls, '#fff8e0'));
}

function wrapText(str, n) {
  const lines = []; let cur = '';
  for (const w of str.split(' ')) {
    if ((cur + ' ' + w).trim().length > n && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur);
  return lines;
}
function eggCard(e, x, y, w, h) {
  const found = progress.eggs.includes(e.id);
  ctx.fillStyle = found ? 'rgba(255,233,168,0.95)' : 'rgba(60,40,60,0.85)'; rrect(ctx, x, y, w, h, 12); ctx.fill();
  ctx.strokeStyle = found ? '#3b1600' : '#ff90e0'; ctx.lineWidth = 3; ctx.stroke();
  txt(found ? e.name : '???', x + 14, y + 20, 20, found ? '#3b1600' : '#ffffff', 'left', null);
  const n = Math.max(12, Math.floor((w - 28) / 8.2));
  wrapText(found ? e.desc : e.hint, n).slice(0, 3).forEach((l, i) => txt(l, x + 14, y + 44 + i * 15, 13, found ? '#5c0008' : '#ffd0f0', 'left', null));
}
function drawAlbum() {
  ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(0, 0, W, H);
  txt('GEHEIMNISSE', W / 2, 52, 52, '#ff90e0', 'center', '#3b0030');
  txt(`ENTDECKT: ${progress.eggs.length} / ${EGGS.length}`, W / 2, 100, 22, '#fff');
  const gap = 14, total = Math.min(W - 40, 1400), cw = (total - gap * 2) / 3, x0 = W / 2 - total / 2;
  WORLDS.forEach((w, ci) => {
    const x = x0 + ci * (cw + gap);
    txt(w.name, x + cw / 2, 132, 20, '#ffe9a8');
    EGGS.filter(e => e.world === w.id).forEach((e, ri) => eggCard(e, x, 150 + ri * 94, cw, 86));
  });
  EGGS.filter(e => e.world === 'all').forEach((e, i) => eggCard(e, x0, 530 + i * 70, total, 62));
  button('ZURÜCK', W / 2 - 150, 618, 300, 56, () => { G.state = 'menu'; }, '#ffe9a8');
}

function drawWorlds() {
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, W, H);
  txt('WELT WÄHLEN', W / 2, 80, 56, '#ffd83a', 'center', '#5c0008');
  const cw = 280, ch = 380, gap = 30, x0 = W / 2 - (cw * 3 + gap * 2) / 2, y0 = 140;
  WORLDS.forEach((w, i) => {
    const x = x0 + i * (cw + gap), y = y0, open = i <= progress.unlocked;
    const hover = !mouse.touch && mouse.x > x && mouse.x < x + cw && mouse.y > y && mouse.y < y + ch;
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; rrect(ctx, x + 5, y + 7, cw, ch, 16); ctx.fill();
    ctx.fillStyle = hover && open ? '#fff3b0' : '#ffe9a8'; rrect(ctx, x, y, cw, ch, 16); ctx.fill();
    ctx.strokeStyle = i === G.world ? '#e3102a' : '#3b1600'; ctx.lineWidth = i === G.world ? 6 : 4; ctx.stroke();
    // Vorschaubild
    const [sky, ground, accent] = w.preview;
    ctx.save(); rrect(ctx, x + 16, y + 16, cw - 32, 150, 10); ctx.clip();
    ctx.fillStyle = sky; ctx.fillRect(x + 16, y + 16, cw - 32, 90);
    ctx.fillStyle = ground; ctx.fillRect(x + 16, y + 106, cw - 32, 60);
    ctx.fillStyle = accent; circ(ctx, x + cw / 2, y + 112, 22); ctx.fill();
    ctx.fillStyle = '#ffd83a'; circ(ctx, x + cw / 2 + 40, y + 128, 12); ctx.fill(); circ(ctx, x + cw / 2 + 50, y + 116, 8); ctx.fill();
    ctx.restore();
    txt(w.name, x + cw / 2, y + 200, 32, '#3b1600', 'center', null);
    txt(w.desc, x + cw / 2, y + 240, 15, '#5c3a1a', 'center', null);
    txt('WAFFE: ' + WEAPONS[w.weapon].short, x + cw / 2, y + 280, 19, '#5c0008', 'center', null);
    txt('REKORD: ' + progress.best[w.id], x + cw / 2, y + 320, 19, '#3b1600', 'center', null);
    if (!open) {
      ctx.fillStyle = 'rgba(20,10,0,0.72)'; rrect(ctx, x, y, cw, ch, 16); ctx.fill();
      ctx.fillStyle = '#c8c8d0'; rrect(ctx, x + cw / 2 - 30, y + 120, 60, 50, 8); ctx.fill();
      ctx.strokeStyle = '#c8c8d0'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(x + cw / 2, y + 120, 20, Math.PI, 0); ctx.stroke();
      txt('GESPERRT', x + cw / 2, y + 220, 30, '#ffd83a');
      txt(`${w.need} PUNKTE`, x + cw / 2, y + 270, 20, '#fff');
      txt(`IM ${WORLDS[i - 1].name}`, x + cw / 2, y + 300, 20, '#fff');
    }
    buttons.push({ x, y, w: cw, h: ch, act: () => { if (open) startGame(i); else { Snd.empty(); G.shake = 6; } } });
  });
  button('ZURÜCK', W / 2 - 150, 560, 300, 60, () => { G.state = 'menu'; }, '#ffe9a8');
}

function drawOver() {
  const a = clamp(G.overT * 2, 0, 1);
  ctx.fillStyle = `rgba(20,0,0,${0.55 * a})`; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = a;
  txt('ZEIT UM!', W / 2, 120, 84, '#ffd83a', 'center', '#5c0008');
  txt(String(G.score), W / 2, 210, 72, '#fff');
  if (G.newBest && Math.sin(G.t * 8) > -0.4) txt('NEUER REKORD!', W / 2, 268, 34, '#7dffb0');
  const acc = G.shots ? Math.round(G.hits / G.shots * 100) : 0;
  const stats = [`Erledigt: ${G.kills}   Kopfschüsse: ${G.heads}`, `Trefferquote: ${acc}%   Längste Serie: ${G.maxStreak}`];
  stats.forEach((s, i) => txt(s, W / 2, 315 + i * 34, 22, '#fff8e0'));
  const next = WORLDS[G.world + 1];
  if (G.unlockedNew) {
    const p = 1 + 0.06 * Math.sin(G.t * 6);
    txt(`NEUE WELT: ${G.unlockedNew.name}!`, W / 2, 410, 36 * p, '#7dffb0');
    txt(`NEUE WAFFE: ${WEAPONS[G.unlockedNew.weapon].name}`, W / 2, 452, 24, '#a0f0ff');
  } else if (next && progress.unlocked < G.world + 1) {
    txt(`${next.name} ab ${next.need} Punkten`, W / 2, 420, 24, '#ffe9a8');
  }
  ctx.globalAlpha = 1;
  if (G.overT > 1) {
    button('NOCHMAL', W / 2 - 290, 510, 270, 66, () => startGame(G.world));
    button('WELTEN', W / 2 + 20, 510, 270, 66, () => { G.state = 'worlds'; }, '#ffe9a8');
  }
}

function drawCrosshair() {
  if (mouse.touch) return;
  const x = mouse.x, y = mouse.y, r = 20 + G.recoil * 10;
  const col = G.state !== 'play' ? '#ff2d3d' : G.weapon === 'laser' ? '#7dff4a' : G.weapon === 'harpoon' ? '#40e0ff' : '#ff2d3d';
  ctx.lineCap = 'round';
  for (const [c, lw] of [['rgba(0,0,0,0.6)', 5], [col, 2.5]]) {
    ctx.strokeStyle = c; ctx.lineWidth = lw;
    circ(ctx, x, y, r); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - r - 10, y); ctx.lineTo(x - r + 8, y); ctx.moveTo(x + r - 8, y); ctx.lineTo(x + r + 10, y);
    ctx.moveTo(x, y - r - 10); ctx.lineTo(x, y - r + 8); ctx.moveTo(x, y + r - 8); ctx.lineTo(x, y + r + 10);
    ctx.stroke();
  }
  ctx.fillStyle = col; circ(ctx, x, y, 2.5); ctx.fill();
}

/* ---------------------------------------------------------------- Eingabe */
function toWorld(e) {
  const r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
}
cv.addEventListener('pointermove', e => { const p = toWorld(e); mouse.x = p.x; mouse.y = p.y; mouse.touch = e.pointerType === 'touch'; });
cv.addEventListener('pointerdown', e => {
  e.preventDefault();
  Snd.init();
  const p = toWorld(e); mouse.x = p.x; mouse.y = p.y; mouse.touch = e.pointerType === 'touch';
  try { cv.setPointerCapture(e.pointerId); } catch (err) {}
  if (isPortrait()) { goFullscreenLandscape(); return; }
  if (e.button === 2) { reload(); return; }
  for (const b of buttons) {
    if (p.x > b.x && p.x < b.x + b.w && p.y > b.y && p.y < b.y + b.h) {
      if (!b.silent) Snd.click();
      b.act(); return;
    }
  }
  if (G.paused) return;
  triggerDown(p.x, p.y);
});
const release = () => stopLaser();
cv.addEventListener('pointerup', release);
cv.addEventListener('pointercancel', release);
window.addEventListener('blur', release);
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('wheel', e => { e.preventDefault(); cycleWeapon(e.deltaY > 0 ? 1 : -1); }, { passive: false });
function toggleBighead() {
  Settings.bighead = !Settings.bighead; store.set('bighead', Settings.bighead);
  popText(W / 2, 260, Settings.bighead ? 'RIESENKÖPFE AN!' : 'RIESENKÖPFE AUS', '#ffd83a', 40, 2);
  Snd.voice('squawk', 0.8, 0.15);
  discover('gack');
}
function titleTap() {
  const now = performance.now();
  G.titleTaps = G.titleTaps.filter(t => now - t < 2000);
  G.titleTaps.push(now);
  if (G.titleTaps.length >= 4) { G.titleTaps = []; toggleBighead(); }
}
window.addEventListener('keydown', e => {
  Snd.init();
  const k = e.key.toLowerCase();
  if (k.length === 1 && G.state !== 'play') {
    G.keyBuf = (G.keyBuf + k).slice(-4);
    if (G.keyBuf === 'gack') { G.keyBuf = ''; toggleBighead(); }
  }
  if (k === 'r' || k === ' ') { e.preventDefault(); reload(); }
  else if (k === '1' || k === '2' || k === '3') switchWeapon(WEAPON_ORDER[+k - 1]);
  else if (k === 'q') cycleWeapon(1);
  else if ((k === 'p' || k === 'escape') && G.state === 'play') { G.paused = !G.paused; stopLaser(); }
  else if (k === 'm') { Settings.sound = !Settings.sound; store.set('sound', Settings.sound); if (!Settings.sound) Snd.laserOff(); }
  else if (k === 'f') {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.();
  } else if (k === 'enter' && (G.state === 'over' || G.state === 'menu' || G.state === 'worlds')) startGame(G.world);
});
document.addEventListener('visibilitychange', () => { if (document.hidden && G.state === 'play') { G.paused = true; stopLaser(); } });
window.addEventListener('resize', resize);

/* ---------------------------------------------------------------- Start */
G.world = clamp(store.get('world', 0), 0, progress.unlocked);
resize();
setWorld(G.world);
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (!G.paused && !isPortrait()) update(dt);
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
