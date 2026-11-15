'use strict';
/* =========================================================================
   Welten: Paletten, Hintergründe, Ambiente, Gegnertypen und deren Zeichnung
   ========================================================================= */

const DEF_HEAD = [14, -58], DEF_BODY = [0, -30, 37, 32];
const BLOODS = {
  red: ['#b3000f', '#d0021b', '#8a000c', '#e3102a', '#9e0010'],
  green: ['#3fbf3f', '#7dff4a', '#2a8a2a', '#a0ff70', '#2a8a2a'],
};
const CONFETTI = ['#ff4d6d', '#ffd23f', '#3bceac', '#4361ee', '#f77f00', '#c77dff'];

/* ---------------------------------------------------------------- Gegnertypen */
const def = o => Object.assign({
  speed: [55, 95], hp: 1, pts: 10, size: 1, col: '#ffd83a', dk: '#d9a200', lt: '#fff1a0',
  hop: 0, peck: 0, blood: 'red', voice: 'peep', tuft: true, bill: 'beak', legs: true, big: 1,
}, o);

const TYPES = {
  // --- Bauernhof
  chick:  def({ hop: 0.35, peck: 0.3 }),
  runner: def({ speed: [170, 240], pts: 20, size: 0.85, col: '#ffc43a', dk: '#d48600', lt: '#ffe39a', hop: 0.8 }),
  flyer:  def({ speed: [110, 170], pts: 25, size: 0.9, col: '#ffe14d', dk: '#d4a400', lt: '#fff4b0', fly: true, hat: 'prop', extra: ['prop'] }),
  gold:   def({ speed: [210, 270], pts: 100, size: 0.8, col: '#ffc81a', dk: '#a8740a', lt: '#fff09a', hop: 2.0, hat: 'crown', gold: true }),
  hen:    def({ speed: [40, 60], hp: 3, pts: 60, size: 1.55, col: '#fbf8ef', dk: '#b6ad98', lt: '#ffffff', peck: 0.4, comb: true, tuft: false, voice: 'squawk', big: 1.7, extra: ['body', 'leg', 'wing'] }),
  tnt:    def({ speed: [60, 90], pts: 15, bomb: 'tnt' }),

  // --- Teich
  duckling: def({ speed: [50, 90], pts: 15, swim: true, dive: 0.22, bill: 'duck', voice: 'quack', legs: false }),
  frog:     def({ kind: 'frog', speed: [200, 280], pts: 25, col: '#5ea832', dk: '#2f6a1a', lt: '#c8ec88', jumper: true, hop: 0.9, voice: 'croak', head: [16, -30], hr: 16, body: [0, -15, 28, 19], legs: false }),
  flyduck:  def({ speed: [130, 190], pts: 25, col: '#c99a5a', dk: '#8a6a3a', lt: '#e8d0a0', headCol: '#2f7a3a', fly: true, bill: 'duck', tuft: false, voice: 'quack' }),
  goldduck: def({ speed: [190, 250], pts: 100, size: 0.8, col: '#ffc81a', dk: '#a8740a', lt: '#fff09a', swim: true, bill: 'duck', hat: 'crown', gold: true, voice: 'quack', legs: false }),
  swan:     def({ speed: [35, 55], hp: 4, pts: 80, size: 1.5, col: '#fbfbf8', dk: '#b8b8b0', lt: '#ffffff', swim: true, bill: 'swan', neck: true, head: [30, -92], tuft: false, voice: 'honk', big: 1.8, legs: false, extra: ['body', 'wing'] }),
  mine:     def({ speed: [45, 70], pts: 15, swim: true, bill: 'duck', bomb: 'mine', voice: 'quack', legs: false }),

  // --- Weltraum
  alien:     def({ speed: [60, 100], pts: 15, col: '#8fff5a', dk: '#3a9a2a', lt: '#d8ffb0', hat: 'antenna', tuft: false, lowGrav: true, hop: 1.2, blood: 'green', voice: 'blip', bigEye: true }),
  ufo:       def({ speed: [120, 180], pts: 30, col: '#8fff5a', dk: '#3a9a2a', lt: '#d8ffb0', hat: 'antenna', tuft: false, fly: true, saucer: true, zig: true, blood: 'green', voice: 'blip', bigEye: true, extra: ['saucer'] }),
  astro:     def({ speed: [55, 85], pts: 30, helmet: true, lowGrav: true, hop: 0.8 }),
  goldalien: def({ speed: [200, 260], pts: 100, size: 0.8, col: '#ffc81a', dk: '#a8740a', lt: '#fff09a', hat: 'crown', gold: true, lowGrav: true, hop: 2.0, blood: 'green', voice: 'blip' }),
  brute:     def({ speed: [35, 55], hp: 5, pts: 90, size: 1.6, col: '#b070ff', dk: '#6a3aa0', lt: '#e0c0ff', comb: true, combCol: '#ff40c0', tuft: false, hat: 'antenna', blood: 'green', voice: 'blip', big: 1.9, bigEye: true, extra: ['body', 'leg', 'wing'] }),
  plasma:    def({ speed: [60, 90], pts: 15, col: '#8fff5a', dk: '#3a9a2a', lt: '#d8ffb0', hat: 'antenna', tuft: false, bomb: 'plasma', lowGrav: true, hop: 0.6, blood: 'green', voice: 'blip', bigEye: true }),
};

/* ---------------------------------------------------------------- Welten */
const WORLDS = [
  {
    id: 'farm', name: 'BAUERNHOF', weapon: 'shotgun', need: 0, sky: '#4fa6ee', grav: 1500, gv: 1,
    desc: 'Küken, Hennen & TNT', parade: 'chick',
    weights: p => ({ chick: 10, runner: 2 + 6 * p, flyer: 1.5 + 5 * p, gold: 0.5, hen: 1 + 2.5 * p, tnt: 0.9 + 2 * p }),
    palette: [
      '#000000', '#1a1210', '#3b2a1e', '#6b4a2a', '#9a6a3a', '#c99a5a',
      '#ffffff', '#d8d8d0', '#9a968c', '#5a5650',
      '#2a4fa0', '#3f7fd8', '#6cb0f0', '#b8e0ff',
      '#1f4a14', '#3a7a22', '#5ea832', '#94d050', '#c8ec88',
      '#5c0008', '#9a0010', '#d0021b', '#ff4a4a', '#ffaaaa',
      '#e8820c', '#ffa020', '#ffd83a', '#fff3a0',
      '#7a4cc0', '#40c0a0', '#ff70b0', '#3050e0',
    ],
    bg: g => bgFarm(g), preview: ['#4fa6ee', '#93d057', '#b5302a'],
  },
  {
    id: 'pond', name: 'TEICH', weapon: 'harpoon', need: 1500, sky: '#5aaee8', grav: 1500, gv: 1, water: true,
    desc: 'Entenküken, Frösche & Schwäne', parade: 'duckling',
    weights: p => ({ duckling: 10, frog: 2 + 5 * p, flyduck: 1.5 + 4 * p, goldduck: 0.5, swan: 1 + 2 * p, mine: 0.9 + 2 * p }),
    palette: [
      '#000000', '#14202a', '#2a3a20', '#5a4a2a', '#9a7a4a', '#d8c08a',
      '#ffffff', '#d0d8e0', '#8a96a0', '#4a5660',
      '#1a3a7a', '#2a5aaa', '#3f7fd8', '#6cb0f0', '#a8d8ff',
      '#1f4a14', '#3a7a22', '#5ea832', '#94d050', '#3f8f7a',
      '#5c0008', '#9a0010', '#d0021b', '#ff4a4a',
      '#e8820c', '#ffa020', '#ffd83a', '#fff3a0',
      '#2a6a5a', '#ff70b0', '#7a4cc0', '#c8ec88',
    ],
    bg: g => bgPond(g), preview: ['#5aaee8', '#2a5aaa', '#5ea832'],
  },
  {
    id: 'space', name: 'WELTRAUM', weapon: 'laser', need: 1500, sky: '#0a0a1e', grav: 170, gv: 0.38, floaty: true,
    desc: 'Aliens, UFOs & Astro-Küken', parade: 'alien',
    weights: p => ({ alien: 10, ufo: 2 + 5 * p, astro: 2 + 4 * p, goldalien: 0.5, brute: 1 + 2 * p, plasma: 0.9 + 2 * p }),
    palette: [
      '#000000', '#0a0a1e', '#1a1440', '#2e1f5e', '#4a2f8a', '#7a4cc0',
      '#ffffff', '#c8c8d0', '#9090a0', '#606070', '#3a3a48', '#24242e',
      '#3f7fd8', '#6cb0f0', '#40e0ff', '#a0f0ff',
      '#2a8a2a', '#3fbf3f', '#7dff4a', '#c8ff9a',
      '#5c0008', '#9a0010', '#d0021b', '#ff4a4a',
      '#e8820c', '#ffa020', '#ffd83a', '#fff3a0',
      '#ff40c0', '#ff90e0', '#b070ff', '#c08040',
    ],
    bg: g => bgSpace(g), preview: ['#0a0a1e', '#606070', '#7dff4a'],
  },
];

/* ---------------------------------------------------------------- Hintergründe */
function grassTufts(g, hz, n, cols) {
  for (let i = 0; i < n; i++) {
    const ty = rand(hz + 24, H), f = (ty - hz) / (H - hz), tx = rand(0, W), s = 2 + f * 9;
    g.strokeStyle = pick(cols); g.lineWidth = 0.6 + f * 1.6;
    g.beginPath();
    g.moveTo(tx, ty); g.lineTo(tx - s * 0.5, ty - s);
    g.moveTo(tx, ty); g.lineTo(tx, ty - s * 1.3);
    g.moveTo(tx, ty); g.lineTo(tx + s * 0.5, ty - s);
    g.stroke();
  }
}
function sun(g, sx, sy) {
  const gr = g.createRadialGradient(sx, sy, 10, sx, sy, 190);
  gr.addColorStop(0, 'rgba(255,250,210,0.85)'); gr.addColorStop(1, 'rgba(255,250,210,0)');
  g.fillStyle = gr; g.fillRect(sx - 200, sy - 200, 400, 400);
  g.fillStyle = '#fff7c9'; circ(g, sx, sy, 46); g.fill();
}

function bgFarm(g) {
  const hz = HORIZON();
  let gr = g.createLinearGradient(0, 0, 0, hz);
  gr.addColorStop(0, '#4fa6ee'); gr.addColorStop(1, '#c6eaff');
  g.fillStyle = gr; g.fillRect(0, 0, W, hz + 2);
  sun(g, W * 0.82, 105);

  g.fillStyle = '#a5d67f';
  g.beginPath(); g.moveTo(0, hz);
  for (let x = 0; x <= W; x += 8) g.lineTo(x, hz - 55 - 32 * Math.sin(x * 0.0043 + 1) - 14 * Math.sin(x * 0.013));
  g.lineTo(W, hz); g.closePath(); g.fill();
  for (let i = 0; i < 9; i++) {
    const x = (i + 0.5) * W / 9 + rand(-40, 40);
    const y = hz - 50 - 32 * Math.sin(x * 0.0043 + 1) - 14 * Math.sin(x * 0.013) + 12;
    g.fillStyle = '#6b4a2a'; g.fillRect(x - 2, y - 10, 4, 12);
    g.fillStyle = '#5fa040'; circ(g, x, y - 18, 13); g.fill(); circ(g, x - 8, y - 12, 9); g.fill(); circ(g, x + 8, y - 12, 9); g.fill();
  }
  g.fillStyle = '#8cc45e';
  g.beginPath(); g.moveTo(0, hz + 2);
  for (let x = 0; x <= W; x += 8) g.lineTo(x, hz - 16 - 18 * Math.sin(x * 0.006 + 3));
  g.lineTo(W, hz + 2); g.closePath(); g.fill();

  // Scheune + Silo
  const bx = W * 0.09, by = hz + 2;
  g.fillStyle = '#b5302a'; g.fillRect(bx, by - 78, 120, 78);
  g.fillStyle = '#7d1f1a';
  g.beginPath(); g.moveTo(bx - 10, by - 76); g.lineTo(bx + 60, by - 128); g.lineTo(bx + 130, by - 76); g.closePath(); g.fill();
  g.fillStyle = '#f2ead8'; g.fillRect(bx + 40, by - 50, 40, 50);
  g.strokeStyle = '#b5302a'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(bx + 40, by - 50); g.lineTo(bx + 80, by); g.moveTo(bx + 80, by - 50); g.lineTo(bx + 40, by); g.stroke();
  g.fillStyle = '#f2ead8'; g.fillRect(bx + 50, by - 100, 20, 16);
  g.fillStyle = '#c9c4b8'; g.fillRect(bx + 128, by - 105, 30, 105);
  g.fillStyle = '#9b968c'; ell(g, bx + 143, by - 105, 15, 14); g.fill();

  gr = g.createLinearGradient(0, hz, 0, H);
  gr.addColorStop(0, '#93d057'); gr.addColorStop(1, '#4b922a');
  g.fillStyle = gr; g.fillRect(0, hz, W, H - hz);
  let y = hz, h = 6, k = 0;
  while (y < H) { if (k % 2 === 0) { g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(0, y, W, h); } y += h; h *= 1.28; k++; }

  const fy = hz + 20;
  g.fillStyle = '#8a5a32'; g.fillRect(0, fy - 22, W, 4); g.fillRect(0, fy - 11, W, 4);
  for (let x = 10; x < W; x += 58) { g.fillStyle = '#7a4c28'; g.fillRect(x, fy - 30, 6, 32); }

  grassTufts(g, hz, 900, ['rgba(46,110,26,0.55)', 'rgba(170,220,110,0.5)']);
  for (let i = 0; i < 70; i++) {
    const ty = rand(hz + 30, H), f = (ty - hz) / (H - hz), tx = rand(0, W);
    g.fillStyle = pick(['#ffffff', '#fff27a', '#ffb3d1']); circ(g, tx, ty, 1 + f * 3); g.fill();
  }
}

function bgPond(g) {
  const hz = HORIZON();
  let gr = g.createLinearGradient(0, 0, 0, hz);
  gr.addColorStop(0, '#5aaee8'); gr.addColorStop(1, '#d6f0ff');
  g.fillStyle = gr; g.fillRect(0, 0, W, hz + 2);
  sun(g, W * 0.18, 95);

  // Waldkante
  g.fillStyle = '#3a7a52';
  g.beginPath(); g.moveTo(0, hz);
  for (let x = 0; x <= W; x += 14) g.lineTo(x, hz - 40 - 22 * Math.abs(Math.sin(x * 0.02)) - 14 * Math.sin(x * 0.005));
  g.lineTo(W, hz); g.closePath(); g.fill();
  g.fillStyle = '#2a6a5a';
  for (let i = 0; i < 26; i++) {
    const x = rand(0, W), h = rand(40, 80);
    g.beginPath(); g.moveTo(x - 14, hz - 6); g.lineTo(x, hz - 6 - h); g.lineTo(x + 14, hz - 6); g.closePath(); g.fill();
  }
  // Ufer
  g.fillStyle = '#d8c08a'; g.fillRect(0, hz - 6, W, 10);
  g.fillStyle = '#5ea832'; g.fillRect(0, hz - 10, W, 5);

  // Steg rechts
  const dx = W * 0.72;
  g.fillStyle = '#7a5a32'; g.fillRect(dx, hz + 2, 170, 8);
  g.fillStyle = '#5a4020'; for (let i = 0; i < 5; i++) g.fillRect(dx + 8 + i * 38, hz + 2, 5, 22);

  // Wasser
  gr = g.createLinearGradient(0, hz, 0, H);
  gr.addColorStop(0, '#6cb0f0'); gr.addColorStop(0.35, '#3f7fd8'); gr.addColorStop(1, '#1a3a7a');
  g.fillStyle = gr; g.fillRect(0, hz + 4, W, H - hz);
  // Spiegelung Wald
  g.fillStyle = 'rgba(42,106,90,0.35)'; g.fillRect(0, hz + 4, W, 26);
  // Glitzerstreifen
  for (let i = 0; i < 260; i++) {
    const ty = rand(hz + 10, H), f = (ty - hz) / (H - hz), tx = rand(0, W);
    g.fillStyle = Math.random() < 0.7 ? 'rgba(200,235,255,0.55)' : 'rgba(255,255,255,0.8)';
    g.fillRect(tx, ty, 6 + f * 30, 1 + f * 2);
  }
  // Seerosenblätter
  for (let i = 0; i < 28; i++) {
    const ty = rand(hz + 30, H - 10), f = (ty - hz) / (H - hz), tx = rand(0, W), r = 6 + f * 26;
    g.fillStyle = pick(['#3a7a22', '#5ea832']);
    g.beginPath(); g.ellipse(tx, ty, r, r * 0.32, 0, 0.3, TAU - 0.1); g.lineTo(tx, ty); g.closePath(); g.fill();
    if (Math.random() < 0.3) { g.fillStyle = '#ffb3d1'; circ(g, tx + r * 0.2, ty - r * 0.15, r * 0.22); g.fill(); }
  }
  // Schilf an den Rändern
  for (const side of [0, 1]) {
    for (let i = 0; i < 40; i++) {
      const bx = side ? W - rand(0, 110) : rand(0, 110), by = rand(H * 0.72, H + 10), h = rand(70, 170);
      g.strokeStyle = pick(['#3a7a22', '#2a5a1a', '#5ea832']); g.lineWidth = rand(2, 4);
      g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(bx + rand(-12, 12), by - h * 0.5, bx + rand(-20, 20), by - h); g.stroke();
      if (Math.random() < 0.3) { g.fillStyle = '#5a4a2a'; ell(g, bx + rand(-6, 6), by - h * 0.85, 4, 13); g.fill(); }
    }
  }
}

function bgSpace(g) {
  const hz = HORIZON();
  let gr = g.createLinearGradient(0, 0, 0, hz);
  gr.addColorStop(0, '#05051a'); gr.addColorStop(1, '#2e1f5e');
  g.fillStyle = gr; g.fillRect(0, 0, W, hz + 2);
  // Nebel
  for (let i = 0; i < 6; i++) {
    const x = rand(0, W), y = rand(20, hz - 60), r = rand(80, 200);
    const ng = g.createRadialGradient(x, y, 5, x, y, r);
    ng.addColorStop(0, pick(['rgba(255,64,192,0.22)', 'rgba(64,224,255,0.18)', 'rgba(176,112,255,0.25)']));
    ng.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = ng; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 0; i < 260; i++) {
    g.fillStyle = pick(['#ffffff', '#c8c8d0', '#a0f0ff', '#fff3a0']);
    const s = Math.random() < 0.9 ? 2 : 4;
    g.fillRect(rand(0, W), rand(0, hz), s, s);
  }
  // Ringplanet
  const px = W * 0.2, py = 120;
  g.fillStyle = '#c08040'; circ(g, px, py, 58); g.fill();
  g.fillStyle = '#e8820c'; g.fillRect(px - 56, py - 18, 112, 10); g.fillRect(px - 50, py + 12, 100, 8);
  g.strokeStyle = '#fff3a0'; g.lineWidth = 5; ell(g, px, py, 105, 22, -0.25); g.stroke();
  g.fillStyle = '#c08040'; g.beginPath(); g.arc(px, py, 58, Math.PI + 0.3, TAU - 0.5); g.fill();
  // Erde
  const ex = W * 0.84, ey = 90;
  g.fillStyle = '#3f7fd8'; circ(g, ex, ey, 30); g.fill();
  g.fillStyle = '#3fbf3f'; ell(g, ex - 8, ey - 6, 12, 8); g.fill(); ell(g, ex + 10, ey + 10, 9, 6); g.fill();
  g.fillStyle = 'rgba(0,0,0,0.45)'; g.beginPath(); g.arc(ex, ey, 30, -1.2, 1.9); g.fill();

  // Mondgebirge
  g.fillStyle = '#3a3a48';
  g.beginPath(); g.moveTo(0, hz);
  for (let x = 0; x <= W; x += 20) g.lineTo(x, hz - 30 - 40 * Math.abs(Math.sin(x * 0.007)) - rand(0, 18));
  g.lineTo(W, hz); g.closePath(); g.fill();
  // Boden
  gr = g.createLinearGradient(0, hz, 0, H);
  gr.addColorStop(0, '#9090a0'); gr.addColorStop(1, '#4a4a58');
  g.fillStyle = gr; g.fillRect(0, hz, W, H - hz);
  // Krater
  for (let i = 0; i < 34; i++) {
    const ty = rand(hz + 20, H), f = (ty - hz) / (H - hz), tx = rand(0, W), r = 8 + f * 60 * rand(0.4, 1);
    g.fillStyle = 'rgba(40,40,52,0.55)'; ell(g, tx, ty, r, r * 0.3); g.fill();
    g.strokeStyle = 'rgba(210,210,225,0.5)'; g.lineWidth = 1 + f * 2;
    g.beginPath(); g.ellipse(tx, ty, r, r * 0.3, 0, 0.1, Math.PI - 0.1); g.stroke();
  }
  for (let i = 0; i < 300; i++) {
    const ty = rand(hz + 10, H), f = (ty - hz) / (H - hz);
    g.fillStyle = pick(['rgba(60,60,72,0.6)', 'rgba(200,200,215,0.5)']);
    g.fillRect(rand(0, W), ty, 1 + f * 4, 1 + f * 2);
  }
  // Landefähre
  const lx = W * 0.62, ly = hz + 14;
  g.strokeStyle = '#c8c8d0'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(lx - 22, ly); g.lineTo(lx - 12, ly - 20); g.moveTo(lx + 22, ly); g.lineTo(lx + 12, ly - 20); g.stroke();
  g.fillStyle = '#ffd83a'; g.fillRect(lx - 16, ly - 34, 32, 18);
  g.fillStyle = '#c8c8d0'; g.fillRect(lx - 10, ly - 48, 20, 14);
  g.fillStyle = '#40e0ff'; g.fillRect(lx - 5, ly - 44, 10, 5);
}

/* ---------------------------------------------------------------- Ambiente (Wolken, Sterne …) */
const amb = { clouds: [], stars: [], shoot: [] };
function ambInit(world) {
  amb.clouds = []; amb.stars = []; amb.shoot = [];
  const nc = world.id === 'farm' ? 7 : world.id === 'pond' ? 4 : 0;
  for (let i = 0; i < nc; i++) amb.clouds.push({ x: rand(0, W), y: rand(30, H * 0.3), s: rand(0.6, 1.4), v: rand(6, 18) });
  if (world.id === 'space') for (let i = 0; i < 40; i++) amb.stars.push({ x: rand(0, W), y: rand(0, HORIZON() - 40), ph: rand(0, TAU), sp: rand(1, 4) });
}
function ambUpdate(dt, world) {
  for (const c of amb.clouds) { c.x += c.v * dt; if (c.x > W + 120) { c.x = -160; c.y = rand(30, H * 0.3); } }
  for (const s of amb.stars) s.ph += dt * s.sp;
  if (world.id === 'space') {
    if (Math.random() < dt * 0.35) amb.shoot.push({ x: rand(0, W), y: rand(0, H * 0.3), vx: rand(-900, -500), vy: rand(200, 400), life: 0.6 });
    for (const s of amb.shoot) { s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt; }
    amb.shoot = amb.shoot.filter(s => s.life > 0);
  }
  if (world.id === 'pond' && Math.random() < dt * 1.5) {
    const z = rand(0, 1);
    parts.push({ k: 'ring', x: rand(0, W), y: groundY(z), r: 2, s: chickScale(z), life: 1.2, max: 1.2 });
  }
}
function ambDraw() {
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  for (const c of amb.clouds) {
    for (const [ox, oy, r] of [[0, 0, 26], [28, -14, 34], [62, -4, 28], [34, 8, 28], [-20, 8, 18], [86, 8, 18]]) {
      circ(ctx, c.x + ox * c.s, c.y + oy * c.s, r * c.s); ctx.fill();
    }
  }
  for (const s of amb.stars) {
    const a = 0.5 + 0.5 * Math.sin(s.ph);
    ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.fillRect(s.x - 2, s.y - 2, 5, 5);
    if (a > 0.85) { ctx.fillRect(s.x - 6, s.y, 13, 1.5); ctx.fillRect(s.x, s.y - 6, 1.5, 13); }
  }
  for (const s of amb.shoot) {
    ctx.strokeStyle = `rgba(255,255,255,${s.life / 0.6})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * 0.08, s.y - s.vy * 0.08); ctx.stroke();
  }
}

/* ---------------------------------------------------------------- Gegner zeichnen */
function leg(g, x0, y0, x1, y1) {
  g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
  g.beginPath(); g.moveTo(x1 - 5, y1); g.lineTo(x1 + 6, y1); g.moveTo(x1, y1); g.lineTo(x1 + 4, y1 - 3); g.stroke();
}

function drawHead(g, T, col, dk, t, dead) {
  const hc = T.headCol || col;
  if (T.hat === 'antenna') {
    g.strokeStyle = dk; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(-4, -12); g.lineTo(-11, -32); g.moveTo(4, -13); g.lineTo(10, -33); g.stroke();
    g.fillStyle = '#ff40c0'; circ(g, -11, -33, 4.5); g.fill(); circ(g, 10, -34, 4.5); g.fill();
  }
  if (T.comb) {
    g.fillStyle = T.combCol || '#e0262b';
    circ(g, -6, -16, 6); g.fill(); circ(g, 1, -20, 7); g.fill(); circ(g, 8, -16, 6); g.fill();
    ell(g, 15, 10, 4, 7); g.fill();
  }
  g.fillStyle = hc; g.strokeStyle = dk; g.lineWidth = 2.5;
  circ(g, 0, 0, 18); g.fill(); g.stroke();
  if (T.tuft) {
    g.beginPath(); g.moveTo(-2, -17); g.quadraticCurveTo(-4, -24, -8, -27);
    g.moveTo(2, -18); g.quadraticCurveTo(3, -25, 6, -28); g.stroke();
  }
  // Schnabel
  g.lineWidth = 1.5;
  if (T.bill === 'duck') {
    g.fillStyle = '#ff9a1a'; g.strokeStyle = '#c96a00';
    ell(g, 21, dead ? 5 : 3, 11, 5); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(12, 3); g.lineTo(30, 3); g.stroke();
  } else if (T.bill === 'swan') {
    g.fillStyle = '#ff8a1a'; g.strokeStyle = '#c96a00';
    g.beginPath(); g.moveTo(12, -5); g.lineTo(32, dead ? 6 : 3); g.lineTo(12, 6); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#1a1a1a'; ell(g, 14, 0, 4, 6); g.fill();
  } else {
    g.fillStyle = '#ff9a1a'; g.strokeStyle = '#c96a00';
    g.beginPath(); g.moveTo(14, -5); g.lineTo(27, dead ? 4 : 0); g.lineTo(14, 6); g.closePath(); g.fill(); g.stroke();
  }
  // Auge
  if (dead) {
    g.strokeStyle = '#1a1a1a'; g.lineWidth = 2.2;
    g.beginPath(); g.moveTo(3, -8); g.lineTo(11, 0); g.moveTo(11, -8); g.lineTo(3, 0); g.stroke();
  } else if ((t % 3.3) < 0.12) {
    g.strokeStyle = '#1a1a1a'; g.lineWidth = 2; g.beginPath(); g.moveTo(3, -4); g.lineTo(11, -4); g.stroke();
  } else if (T.bigEye) {
    g.fillStyle = '#1a1a1a'; circ(g, 6, -4, 6.5); g.fill();
    g.fillStyle = '#fff'; circ(g, 8, -6.5, 2.2); g.fill();
  } else {
    g.fillStyle = '#1a1a1a'; circ(g, 7, -4, 4.2); g.fill();
    g.fillStyle = '#fff'; circ(g, 8.5, -5.8, 1.5); g.fill();
  }
  if (!T.headCol) { g.fillStyle = 'rgba(255,110,110,0.45)'; circ(g, 3, 7, 4); g.fill(); }
  if (T.hat === 'prop') {
    g.fillStyle = '#e63946';
    g.beginPath(); g.arc(0, -12, 13, Math.PI, 0); g.closePath(); g.fill();
    g.fillStyle = '#ffd23f'; g.fillRect(-2, -32, 4, 8);
    const w = 20 * Math.abs(Math.cos(t * 40));
    g.fillStyle = '#4361ee'; ell(g, 0, -32, w, 3); g.fill();
  }
  if (T.hat === 'crown') {
    g.fillStyle = '#ffe066'; g.strokeStyle = '#a8740a'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(-10, -14); g.lineTo(-10, -26); g.lineTo(-5, -20); g.lineTo(0, -29); g.lineTo(5, -20); g.lineTo(10, -26); g.lineTo(10, -14); g.closePath();
    g.fill(); g.stroke();
  }
}

function drawTNT(g, t) {
  g.save(); g.translate(-22, -44); g.rotate(-0.35);
  g.fillStyle = '#c1121f'; g.strokeStyle = '#5c0a0f'; g.lineWidth = 2;
  for (let i = 0; i < 3; i++) { rrect(g, -8 + i * 9 - 9, -22, 9, 40, 3); g.fill(); g.stroke(); }
  g.fillStyle = '#222'; g.fillRect(-19, -6, 28, 5);
  g.strokeStyle = '#333'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(-4, -22); g.quadraticCurveTo(0, -34, 8, -36); g.stroke();
  if (Math.sin(t * 40) > -0.3) {
    g.fillStyle = '#ffdf3f'; circ(g, 8, -37, 4 + Math.random() * 2); g.fill();
    g.fillStyle = '#ff7b00'; circ(g, 8, -37, 2); g.fill();
  }
  g.restore();
}
function drawCanister(g, t) {
  g.save(); g.translate(-24, -46); g.rotate(-0.3);
  g.fillStyle = '#9090a0'; g.strokeStyle = '#3a3a48'; g.lineWidth = 2;
  rrect(g, -11, -22, 22, 42, 6); g.fill(); g.stroke();
  const a = 0.6 + 0.4 * Math.sin(t * 9);
  g.fillStyle = `rgba(125,255,74,${a})`; rrect(g, -6, -15, 12, 28, 4); g.fill();
  g.fillStyle = '#3a3a48'; g.fillRect(-4, -28, 8, 6);
  g.restore();
}
function drawMine(g, t) {
  g.save(); g.translate(44, -14);
  g.strokeStyle = '#1a1a1a'; g.lineWidth = 3;
  for (let i = 0; i < 8; i++) {
    const a = i * TAU / 8;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 22, Math.sin(a) * 22); g.stroke();
    g.fillStyle = '#1a1a1a'; circ(g, Math.cos(a) * 22, Math.sin(a) * 22, 3); g.fill();
  }
  g.fillStyle = '#2a2a2a'; circ(g, 0, 0, 16); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.25)'; circ(g, -5, -6, 5); g.fill();
  if (Math.sin(t * 8) > 0) { g.fillStyle = '#ff2020'; circ(g, 0, -16, 3.5); g.fill(); }
  g.restore();
}
function drawSaucer(g, t) {
  g.fillStyle = '#9090a0'; g.strokeStyle = '#3a3a48'; g.lineWidth = 2.5;
  ell(g, 0, -10, 52, 13); g.fill(); g.stroke();
  g.fillStyle = '#606070'; ell(g, 0, -4, 34, 6); g.fill();
  for (let i = 0; i < 5; i++) {
    const on = (Math.floor(t * 8) + i) % 2 === 0;
    g.fillStyle = on ? '#40e0ff' : '#ff40c0'; circ(g, -32 + i * 16, -10, 3.5); g.fill();
  }
  const a = 0.25 + 0.15 * Math.sin(t * 12);
  g.fillStyle = `rgba(160,240,255,${a})`;
  g.beginPath(); g.moveTo(-20, -2); g.lineTo(20, -2); g.lineTo(36, 40); g.lineTo(-36, 40); g.closePath(); g.fill();
}

function drawChickBody(g, c, T) {
  const fl = c.flash > 0;
  const col = fl ? '#ff8080' : T.col, dk = fl ? '#b03030' : T.dk, lt = fl ? '#ffb0b0' : T.lt;
  g.lineCap = 'round'; g.lineJoin = 'round';
  const hd = T.head || DEF_HEAD;
  if (T.legs && !T.fly) {
    g.strokeStyle = '#e8820c'; g.lineWidth = 4;
    const a = (c.pause > 0 || c.hop > 0) ? 0 : Math.sin(c.walk) * 7;
    leg(g, -7, -10, -7 + a, 0); leg(g, 7, -10, 7 - a, 0);
  } else if (T.fly && !T.saucer) {
    g.strokeStyle = '#e8820c'; g.lineWidth = 4;
    leg(g, -5, -8, -9, 7); leg(g, 6, -8, 2, 8);
  }
  if (T.bomb === 'tnt') drawTNT(g, c.t);
  if (T.bomb === 'plasma') drawCanister(g, c.t);
  const pk = c.peck || 0;
  const hx = hd[0] + pk * 12, hy = hd[1] + pk * 36;
  if (T.neck) {
    for (const [cl, lw] of [[dk, 16], [col, 11]]) {
      g.strokeStyle = cl; g.lineWidth = lw;
      g.beginPath(); g.moveTo(12, -42); g.quadraticCurveTo(hx + 10, -50, hx - 2, hy + 10); g.stroke();
    }
  }
  g.fillStyle = col; g.strokeStyle = dk; g.lineWidth = 2.5;
  ell(g, 0, -30, 30, 26); g.fill(); g.stroke();
  g.fillStyle = lt; ell(g, 8, -22, 16, 11); g.fill();
  g.fillStyle = col; g.strokeStyle = dk;
  g.beginPath(); g.moveTo(-26, -38); g.lineTo(-38, -46); g.lineTo(-30, -30); g.closePath(); g.fill(); g.stroke();
  // Flügel
  const flap = T.fly ? Math.sin(c.t * (T.saucer ? 6 : 38)) * (T.saucer ? 0.2 : 0.9) - 0.4 : (c.pause > 0 ? 0 : Math.sin(c.walk * 2) * 0.15) - (c.hop > 0 ? 0.7 : 0);
  g.save(); g.translate(-6, -36); g.rotate(-0.25 + flap);
  g.fillStyle = dk; ell(g, -10, 6, T.fly && !T.saucer ? 20 : 15, T.fly && !T.saucer ? 11 : 9); g.fill();
  g.restore();
  if (T.saucer) drawSaucer(g, c.t);
  if (T.bomb === 'mine') drawMine(g, c.t);
  g.save(); g.translate(hx, hy); g.rotate(pk * 0.6);
  drawHead(g, T, col, dk, c.t, false);
  if (T.helmet && c.helmet) {
    g.fillStyle = 'rgba(180,230,255,0.3)'; circ(g, 4, -2, 27); g.fill();
    g.strokeStyle = 'rgba(230,250,255,0.9)'; g.lineWidth = 2.5; g.stroke();
    g.strokeStyle = '#ffffff'; g.lineWidth = 3;
    g.beginPath(); g.arc(4, -2, 20, -2.6, -1.8); g.stroke();
  }
  g.restore();
  if (T.helmet) { g.fillStyle = '#c8c8d0'; g.fillRect(6, -54, 18, 6); }
}

function drawFrog(c, T) {
  const s = c.s, g = ctx, air = c.hop > 0;
  if (!air) { g.strokeStyle = 'rgba(220,240,255,0.7)'; g.lineWidth = 1.5 + s; ell(g, c.x, c.y, 30 * s, 6 * s); g.stroke(); }
  else { g.fillStyle = 'rgba(0,0,30,0.2)'; ell(g, c.x, c.gy, 20 * s, 4 * s); g.fill(); }
  g.save(); g.translate(c.x, c.y); g.scale(s * c.dir, s);
  const fl = c.flash > 0;
  const col = fl ? '#ff8080' : T.col, dk = fl ? '#b03030' : T.dk, lt = fl ? '#ffb0b0' : T.lt;
  g.lineCap = 'round'; g.lineJoin = 'round';
  if (air) {
    g.strokeStyle = dk; g.lineWidth = 8;
    g.beginPath(); g.moveTo(-14, -14); g.lineTo(-36, -6); g.lineTo(-54, 4); g.stroke();
    g.strokeStyle = col; g.lineWidth = 5;
    g.beginPath(); g.moveTo(-14, -14); g.lineTo(-36, -6); g.lineTo(-54, 4); g.stroke();
  } else {
    g.fillStyle = col; g.strokeStyle = dk; g.lineWidth = 2;
    ell(g, -14, -8, 14, 9); g.fill(); g.stroke();
    ell(g, -4, -2, 10, 3); g.fill();
  }
  g.fillStyle = col; g.strokeStyle = dk; g.lineWidth = 2.5;
  ell(g, 0, -17, 25, 16, air ? -0.25 : 0); g.fill(); g.stroke();
  g.fillStyle = lt; ell(g, 7, -10, 15, 7); g.fill();
  g.strokeStyle = dk; g.lineWidth = 4;
  g.beginPath(); g.moveTo(14, -10); g.lineTo(air ? 26 : 18, air ? -4 : 0); g.stroke();
  for (const ex of [7, 21]) {
    g.fillStyle = col; g.strokeStyle = dk; g.lineWidth = 2;
    circ(g, ex, -31, 8); g.fill(); g.stroke();
    g.fillStyle = '#fff'; circ(g, ex + 1, -32, 5.5); g.fill();
    g.fillStyle = '#1a1a1a'; circ(g, ex + 2, -32, 3); g.fill();
  }
  g.strokeStyle = dk; g.lineWidth = 2;
  g.beginPath(); g.moveTo(8, -17); g.quadraticCurveTo(18, -12, 26, -19); g.stroke();
  g.restore();
}

function drawEnemy(c) {
  const T = TYPES[c.type], s = c.s, g = ctx;
  if (T.kind === 'frog') return drawFrog(c, T);
  if (!T.swim) {
    const k = T.fly ? 0.6 : 1;
    g.fillStyle = 'rgba(0,0,0,0.22)';
    ell(g, c.x, c.gy, 27 * s * k * (T.saucer ? 1.8 : 1), 6.5 * s * k); g.fill();
  }
  if (T.gold) {
    const gr = g.createRadialGradient(c.x, c.y - 40 * s, 5, c.x, c.y - 40 * s, 80 * s);
    gr.addColorStop(0, 'rgba(255,240,120,0.55)'); gr.addColorStop(1, 'rgba(255,240,120,0)');
    g.fillStyle = gr; circ(g, c.x, c.y - 40 * s, 80 * s); g.fill();
  }
  g.save(); g.translate(c.x, c.y); g.scale(s * c.dir, s);
  if (T.swim) { g.beginPath(); g.rect(-140, -300, 280, 300); g.clip(); g.translate(0, c.yoff || 0); }
  drawChickBody(g, c, T);
  g.restore();
  if (T.swim) {
    const under = (c.yoff || 0) > 50;
    g.strokeStyle = 'rgba(220,240,255,0.85)'; g.lineWidth = 1.5 + 1.5 * s;
    const w = 1 + Math.sin(c.t * 3) * 0.08;
    ell(g, c.x, c.y, (under ? 20 : 36) * s * w * Math.max(1, T.size * 0.8), (under ? 4 : 7) * s); g.stroke();
    if (under && Math.random() < 0.15) parts.push({ k: 'bubble', x: c.x + rand(-10, 10) * s, y: c.y, r: rand(2, 4) * s + 1, life: 0.5, max: 0.5 });
  }
}

/* ---------------------------------------------------------------- Körperteile */
function drawPiece(g, p) {
  const T = TYPES[p.type];
  g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.scale(p.s * (p.dir || 1), p.s);
  g.lineCap = 'round'; g.lineJoin = 'round';
  const bc = p.bc || BLOODS.red;
  switch (p.part) {
    case 'head':
      if (T.kind === 'frog') {
        g.fillStyle = bc[2]; ell(g, 0, 8, 14, 5); g.fill();
        g.fillStyle = p.col; g.strokeStyle = p.dk; g.lineWidth = 2; ell(g, 0, 0, 18, 10); g.fill(); g.stroke();
        for (const ex of [-6, 8]) {
          g.fillStyle = '#fff'; circ(g, ex, -8, 6); g.fill();
          g.strokeStyle = '#1a1a1a'; g.lineWidth = 2;
          g.beginPath(); g.moveTo(ex - 3, -11); g.lineTo(ex + 3, -5); g.moveTo(ex + 3, -11); g.lineTo(ex - 3, -5); g.stroke();
        }
      } else {
        g.fillStyle = bc[2]; ell(g, -2, 15, 11, 7); g.fill();
        drawHead(g, T, p.col, p.dk, 0, true);
        g.fillStyle = bc[1]; ell(g, -2, 17, 7, 4); g.fill();
        g.fillStyle = '#f2e6d8'; circ(g, 1, 17, 2.2); g.fill();
      }
      break;
    case 'leg':
      if (T.kind === 'frog') {
        g.strokeStyle = p.dk; g.lineWidth = 6;
        g.beginPath(); g.moveTo(0, -12); g.lineTo(0, 4); g.lineTo(10, 10); g.stroke();
      } else {
        g.strokeStyle = '#e8820c'; g.lineWidth = 4; leg(g, 0, -12, 0, 8);
      }
      g.fillStyle = bc[0]; circ(g, 0, -13, 5); g.fill();
      break;
    case 'wing':
      g.fillStyle = p.dk; ell(g, 0, 0, 15, 9); g.fill();
      g.fillStyle = bc[0]; ell(g, 11, 0, 5, 7); g.fill();
      break;
    case 'eye':
      g.strokeStyle = bc[2]; g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-8, 6, -14, 2); g.stroke();
      g.fillStyle = '#fff'; circ(g, 0, 0, 6); g.fill();
      g.fillStyle = '#1a1a1a'; circ(g, 2, -1, 3); g.fill();
      break;
    case 'body':
      g.fillStyle = p.col; ell(g, 0, 0, 14, 10); g.fill();
      g.fillStyle = bc[1]; ell(g, 4, 2, 9, 6); g.fill();
      g.fillStyle = bc[2]; ell(g, 5, 3, 4, 3); g.fill();
      g.fillStyle = '#f0e0d0'; g.fillRect(-2, -1, 10, 2.5);
      break;
    case 'prop':
      g.fillStyle = '#4361ee'; ell(g, 0, 0, 20, 3); g.fill();
      g.fillStyle = '#ffd23f'; g.fillRect(-2, -2, 4, 8);
      break;
    case 'saucer':
      g.fillStyle = '#9090a0'; g.strokeStyle = '#3a3a48'; g.lineWidth = 2;
      ell(g, 0, 0, 34, 9); g.fill(); g.stroke();
      g.fillStyle = '#1a1a1a'; ell(g, 10, -2, 8, 4); g.fill();
      break;
  }
  g.restore();
}
function piecesFor(T) {
  const base = T.kind === 'frog' ? ['leg', 'leg', 'leg', 'leg', 'eye', 'eye', 'body', 'body'] : ['leg', 'leg', 'wing', 'wing', 'eye', 'body', 'body'];
  return T.extra ? base.concat(T.extra) : base;
}
