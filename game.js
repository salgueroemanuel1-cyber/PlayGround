(() => {
'use strict';

/* ============================================================
   ÓXIDO AUSTRAL — vertical slice RTS táctil
   Todo el arte es procedural; no hay assets externos.
   ============================================================ */

const $ = s => document.querySelector(s);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const TAU = Math.PI * 2;
const rnd = (a = 1, b = 0) => b + Math.random() * (a - b);
const pick = arr => arr[(Math.random() * arr.length) | 0];
const fmt = n => Math.floor(n).toLocaleString('es-AR');

const canvas = $('#game'), ctx = canvas.getContext('2d', { alpha: false });
const mini = $('#minimap'), mctx = mini.getContext('2d');
const nestBar = $('#nestBar'), rOil = $('#rOil'), rScrap = $('#rScrap'), rPop = $('#rPop');
const waveChip = $('#waveChip'), objectiveChip = $('#objectiveChip');
const dockInfo = $('#dockInfo'), dockActions = $('#dockActions');
const toastEl = $('#toast'), alertsEl = $('#alerts');
const targetBar = $('#targetBar'), targetText = $('#targetText');

const MAP = { w: 44, h: 44 };
MAP.pw = (MAP.w + MAP.h) * 32;
MAP.ph = (MAP.w + MAP.h) * 16;
const iso = (x, y) => ({ x: (x - y) * 32 + MAP.pw / 2, y: (x + y) * 16 });
const unIso = (px, py) => {
  const a = (px - MAP.pw / 2) / 32, b = py / 16;
  return { x: (b + a) / 2, y: (b - a) / 2 };
};

const TEAM = {
  player: { main: '#e0a342', light: '#f0c97e', dark: '#60401f', accent: '#6dd0be', ui: '#e5b45c' },
  enemy:  { main: '#a34d3e', light: '#d07a57', dark: '#4a2622', accent: '#d58f47', ui: '#d27062' },
  neutral:{ main: '#8b8574', light: '#b7ad95', dark: '#443f35', accent: '#8fd0c2', ui: '#b9ae95' }
};

const STATS = {
  tirador:       { label:'Tirador',       short:'TIR', hp:85,  dmg:11, range:4.4, speed:1.55, cd:.85, cost:40, pop:1, role:'inf',   armor:'light',  build:4.0, hit:25, desc:'Infantería barata y versátil', icon:'rifle' },
  lanzachatarra: { label:'Lanzachatarra', short:'LAN', hp:115, dmg:19, range:3.9, speed:1.05, cd:1.5, cost:65, pop:2, role:'at',    armor:'medium', build:6.0, hit:27, desc:'Rompe blindados a distancia', icon:'rocket' },
  mecanico:      { label:'Mecánico',      short:'MEC', hp:90,  dmg:5,  range:1.5, speed:1.5,  cd:1.2, cost:50, pop:1, role:'mech',  armor:'light',  build:5.0, hit:24, desc:'Repara y captura puntos', icon:'wrench' },
  mutil:         { label:'Mútil',         short:'MUT', hp:78,  dmg:9,  range:1.3, speed:1.85, cd:.75, cost:0, pop:0, role:'inf',   armor:'light',  build:0, hit:25, desc:'Mutante rápido de la meseta' },
  piche:         { label:'Piche blindado',short:'PIC', hp:300, dmg:22, range:1.6, speed:.8,  cd:1.35,cost:0, pop:0, role:'heavy', armor:'heavy',  build:0, hit:34, desc:'Tanque orgánico acorazado' }
};
const BSTATS = {
  refinery: { label:'Refinería', hp:1100, radius:1.7, hit:62, visual:80, desc:'Produce tropas y perdió el olor a nuevo' },
  derrick:  { label:'Cigüeña',   hp:260, radius:.8, hit:34, visual:56, desc:'Bombea petróleo. Se agota el pozo' },
  nest:     { label:'Nido bestial', hp:900, radius:1.9, hit:62, visual:58, desc:'El corazón de la horda' },
  antenna:  { label:'Antena de control', hp:1, radius:.7, hit:28, visual:82, desc:'La captura la infantería' }
};
const DMG = {
  inf:   { light:1, medium:1, heavy:.45, building:.45 },
  at:    { light:.85, medium:1.25, heavy:2.1, building:1.55 },
  heavy: { light:1.2, medium:1.05, heavy:1, building:1.5 },
  mech:  { light:.8, medium:.8, heavy:.3, building:.4 }
};
const ACKS = ['Dale, vamos.','Ahí va el óxido.','¿Otra vez al cañadón?','Che, no empujen.','Marchando.','Se hace.','Movéte, gordo.','Al pozo.','Con viento en contra.','Sin miedo al óxido.'];
const ACK_ATK = ['¡Ese de ahí!','A romper chapa.','¡Tomá!','Al nido.','Fuego.','No corre más.'];

const G = {
  state:'menu', time:0, speed:1, muted:false, started:false, kills:0,
  oil:160, scrap:35, cap:20, upgraded:false, queue:[], wave:0, waveTimer:55,
  cam:{ x:1340, y:560, z:.92 }, targetMode:null, baseRally:{ x:12.4, y:17.4 },
  sel:[], selBuilding:null, hover:null, pendingEnd:null, lastAlertPos:null,
  alertCool:0, audio:null, master:null, hudT:0, dockSig:'', lastMiniTap:0
};
const units = [], buildings = [], scraps = [], props = [], effects = [], texts = [], decals = [], pings = [];
let uid = 1, W = 0, H = 0, DPR = 1;
const VIEW = { ax:0, ay:0 };
const terrainC = document.createElement('canvas');
let miniBg = null;
let pointer = null, pointers = new Map(), pinch = null, longPressTimer = 0, suppressTap = false;
let lastTap = null, dragBox = null, gesture = 'none';

/* ---------- terrain texture ---------- */
function hash(x, y) {
  let n = (x * 374761393 + y * 668265263) | 0;
  n = (n ^ (n >> 13)) * 1274126177 | 0;
  return ((n ^ (n >> 16)) >>> 0) / 4294967295;
}
function noise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
const ROADS = [
  [[8.8,15.6],[11.5,17.2],[14.5,18.2],[18,20],[21.6,21.6],[25,23.2],[29,25],[32.5,26.6],[35.5,27.6]],
  [[11.3,19.3],[12.6,18.4],[14.5,18.2]],
  [[33.2,24.9],[33.4,25.9],[32.5,26.6]],
  [[8.8,15.6],[9.8,14.4],[11.8,14.2]]
];
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy || 1;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / l, 0, 1);
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}
function roadDist(x, y) {
  let best = 99;
  for (const r of ROADS) for (let i = 0; i < r.length - 1; i++)
    best = Math.min(best, segDist(x, y, r[i][0], r[i][1], r[i + 1][0], r[i + 1][1]));
  return best;
}
function inBaseArea(x, y) {
  return Math.hypot(x - 8.8, y - 15.6) < 3.2 || Math.hypot(x - 35.5, y - 27.5) < 3.4 || Math.hypot(x - 21.6, y - 21.6) < 2;
}

function buildTerrain() {
  terrainC.width = MAP.pw; terrainC.height = MAP.ph;
  const c = terrainC.getContext('2d');
  c.clearRect(0, 0, MAP.pw, MAP.ph);
  for (let y = 0; y < MAP.h; y++) {
    for (let x = 0; x < MAP.w; x++) {
      const p = iso(x + .5, y + .5);
      const n = noise(x * .18 + 3, y * .18 + 7), n2 = noise(x * .55, y * .55);
      const rd = roadDist(x + .5, y + .5);
      const edge = x < 1.5 || y < 1.5 || x > MAP.w - 2.5 || y > MAP.h - 2.5;
      let r, g, b;
      if (edge) {
        const k = .78 + n * .2;
        r = 93 * k; g = 84 * k; b = 66 * k;
      } else if (rd < 1.05) {
        const k = .9 + n2 * .18;
        r = 137 * k; g = 117 * k; b = 83 * k;
      } else if (rd < 1.7) {
        const k = .9 + n2 * .16;
        r = 158 * k; g = 135 * k; b = 92 * k;
      } else if (n > .78) {
        const k = .86 + n2 * .22;
        r = 145 * k; g = 128 * k; b = 76 * k;
      } else {
        const k = .88 + n2 * .22;
        r = 171 * k; g = 146 * k; b = 96 * k;
      }
      c.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
      c.beginPath();
      c.moveTo(p.x, p.y - 16.2); c.lineTo(p.x + 32.2, p.y);
      c.lineTo(p.x, p.y + 16.2); c.lineTo(p.x - 32.2, p.y); c.closePath(); c.fill();
    }
  }

  // roads: broad gravel ribbon with tracks
  for (const road of ROADS) {
    const pts = road.map(p => iso(p[0], p[1]));
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = 'rgba(108,91,64,.95)'; c.lineWidth = 45;
    c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.stroke();
    c.strokeStyle = 'rgba(153,131,94,.95)'; c.lineWidth = 34;
    c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.stroke();
    c.strokeStyle = 'rgba(178,155,112,.6)'; c.lineWidth = 20;
    c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.stroke();
    c.strokeStyle = 'rgba(92,76,53,.5)'; c.lineWidth = 1.6;
    c.setLineDash([7, 11]);
    c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.stroke();
    c.setLineDash([]);
  }

  // oil stains around wells
  for (const s of [[11.3,19.3,2.4,.70],[33.2,24.9,1.9,.62],[21.6,21.6,1.05,.42]]) {
    const p = iso(s[0], s[1]);
    const rad = s[2] * 26;
    const grd = c.createRadialGradient(p.x, p.y, 2, p.x, p.y, rad);
    grd.addColorStop(0, `rgba(49,40,31,${s[3]})`); grd.addColorStop(.55, `rgba(57,47,34,${s[3] * .62})`);
    grd.addColorStop(1, 'rgba(60,50,35,0)');
    c.fillStyle = grd; c.beginPath(); c.ellipse(p.x, p.y, s[2] * 29, s[2] * 14.5, 0, 0, TAU); c.fill();
    c.fillStyle = 'rgba(120,163,144,.2)';
    c.beginPath(); c.ellipse(p.x - 13, p.y - 5, 10, 3.5, -.25, 0, TAU); c.fill();
  }

  // scrub, stones, grass
  for (let i = 0; i < 950; i++) {
    const x = rnd(MAP.w - 3, 1.5), y = rnd(MAP.h - 3, 1.5);
    if (roadDist(x, y) < 1.25 || inBaseArea(x, y)) continue;
    const p = iso(x, y), r = hash(i, 9);
    if (r > .9) {
      c.fillStyle = 'rgba(85,76,54,.45)'; c.beginPath(); c.ellipse(p.x, p.y + 1, 4 + r * 3, 2, 0, 0, TAU); c.fill();
      c.fillStyle = 'rgba(188,167,121,.5)'; c.fillRect(p.x - .7, p.y - 5, 1.4, 4);
    } else if (r > .76) {
      c.strokeStyle = 'rgba(100,89,52,.55)'; c.lineWidth = 1;
      for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - 3 + k * 3, p.y - 5 - k); c.stroke(); }
    } else {
      c.fillStyle = 'rgba(107,96,61,.34)'; c.beginPath(); c.ellipse(p.x, p.y, 2.5, 1.2, 0, 0, TAU); c.fill();
    }
  }
  for (let i = 0; i < 95; i++) {
    const x = rnd(MAP.w - 4, 2), y = rnd(MAP.h - 4, 2);
    if (roadDist(x, y) < 1.35 || inBaseArea(x, y)) continue;
    const p = iso(x, y), s = .5 + hash(i, 2) * .8;
    c.fillStyle = 'rgba(55,50,41,.28)'; c.beginPath(); c.ellipse(p.x + 2, p.y + 2, 9 * s, 4 * s, 0, 0, TAU); c.fill();
    c.fillStyle = `rgb(${104 + s * 18},${97 + s * 16},${82 + s * 14})`;
    c.beginPath(); c.moveTo(p.x - 8 * s, p.y + 1); c.lineTo(p.x - 4 * s, p.y - 7 * s);
    c.lineTo(p.x + 4 * s, p.y - 6 * s); c.lineTo(p.x + 8 * s, p.y + 1); c.closePath(); c.fill();
    c.fillStyle = 'rgba(194,181,150,.28)'; c.beginPath(); c.ellipse(p.x - 2 * s, p.y - 4 * s, 3 * s, 1.5 * s, -.3, 0, TAU); c.fill();
  }

  // border rock teeth
  for (let i = 0; i < MAP.w * 4; i++) {
    const side = i % 4, t = (i / 4) / MAP.w;
    let gx, gy;
    if (side === 0) { gx = t * MAP.w; gy = rnd(1.4, .1); }
    else if (side === 1) { gx = MAP.w - rnd(1.4, .1); gy = t * MAP.h; }
    else if (side === 2) { gx = t * MAP.w; gy = MAP.h - rnd(1.4, .1); }
    else { gx = rnd(1.4, .1); gy = t * MAP.h; }
    const p = iso(gx, gy), s = .7 + hash(i, 4) * 1.2;
    c.fillStyle = 'rgba(58,52,42,.5)';
    c.beginPath(); c.ellipse(p.x + 3, p.y + 3, 12 * s, 5 * s, 0, 0, TAU); c.fill();
    c.fillStyle = `rgb(${86 + s * 12},${78 + s * 10},${63 + s * 8})`;
    c.beginPath(); c.moveTo(p.x - 12 * s, p.y + 2); c.lineTo(p.x - 5 * s, p.y - 13 * s);
    c.lineTo(p.x + 3 * s, p.y - 9 * s); c.lineTo(p.x + 12 * s, p.y + 2); c.closePath(); c.fill();
  }

  // landmarks: fallen turbine + burnt truck
  drawFallenTurbine(c, iso(26.5, 15.2));
  drawWreck(c, iso(14.4, 23.6));

  miniBg = document.createElement('canvas'); miniBg.width = 240; miniBg.height = 120;
  const mc = miniBg.getContext('2d');
  mc.fillStyle = '#17130f'; mc.fillRect(0, 0, 240, 120);
  mc.drawImage(terrainC, 0, 0, 240, 120);
  mc.strokeStyle = 'rgba(224,180,110,.25)'; mc.lineWidth = 1; mc.strokeRect(.5, .5, 239, 119);
}

function drawFallenTurbine(c, p) {
  c.save(); c.translate(p.x, p.y); c.rotate(-.18);
  c.fillStyle = 'rgba(46,42,35,.32)'; c.beginPath(); c.ellipse(10, 5, 68, 12, 0, 0, TAU); c.fill();
  c.strokeStyle = '#a8a18e'; c.lineWidth = 6; c.lineCap = 'round';
  c.beginPath(); c.moveTo(-62, 0); c.lineTo(30, -4); c.stroke();
  c.strokeStyle = '#79756a'; c.lineWidth = 2; c.beginPath(); c.moveTo(-60, 4); c.lineTo(28, 0); c.stroke();
  c.fillStyle = '#c8c2af'; c.beginPath(); c.ellipse(32, -4, 8, 6, -.2, 0, TAU); c.fill();
  for (let i = 0; i < 3; i++) {
    c.save(); c.translate(32, -4); c.rotate(i * TAU / 3 + .5);
    c.fillStyle = '#b7b09c'; c.beginPath(); c.moveTo(0, -1); c.lineTo(38, -7); c.lineTo(40, 2); c.lineTo(0, 4); c.closePath(); c.fill();
    c.restore();
  }
  c.fillStyle = '#5e5a4c'; c.font = 'bold 6px monospace'; c.fillText('AERO 04', -29, -10);
  c.restore();
}
function drawWreck(c, p) {
  c.save(); c.translate(p.x, p.y);
  c.fillStyle = 'rgba(45,38,30,.35)'; c.beginPath(); c.ellipse(0, 3, 20, 7, 0, 0, TAU); c.fill();
  c.fillStyle = '#5f3b2a'; c.fillRect(-16, -8, 32, 13);
  c.fillStyle = '#7a4b31'; c.fillRect(-12, -13, 16, 7);
  c.fillStyle = '#2d2822'; c.fillRect(-10, -16, 12, 4);
  c.fillStyle = '#3b342b'; c.beginPath(); c.arc(-12, 6, 5, 0, TAU); c.fill();
  c.beginPath(); c.arc(12, 6, 5, 0, TAU); c.fill();
  c.strokeStyle = '#9a6541'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-16, -3); c.lineTo(16, -3); c.stroke();
  c.restore();
}

/* ---------- entity creation ---------- */
function spawnUnit(kind, team, x, y) {
  const st = STATS[kind];
  const hpMul = team === 'player' && G.upgraded ? 1.2 : 1;
  const u = {
    id: uid++, kind, team, x, y, hp: st.hp * hpMul, maxHp: st.hp * hpMul,
    cd: rnd(st.cd), order: null, anchor: { x, y }, face: 1, walk: rnd(TAU),
    moving: false, flash: 0, recoil: 0, kills: 0, rank: 0, speech: '', speechT: 0,
    dead: false, bob: rnd(TAU), selected: false, repairT: 0, repPoint: null,
    armor: st.armor, radius: kind === 'piche' ? .46 : kind === 'lanzachatarra' ? .35 : .3
  };
  units.push(u); return u;
}
function addBuilding(kind, team, x, y) {
  const st = BSTATS[kind];
  const b = {
    id: uid++, kind, team, x, y, hp: st.hp, maxHp: st.hp, radius: st.radius,
    dead: false, flash: 0, selected: false, cd: rnd(1.5), angle: 0, capture: 0,
    smokeT: rnd(3), pulse: rnd(TAU), armor:'building'
  };
  buildings.push(b); return b;
}
function getEntity(id) {
  return units.find(u => u.id === id && !u.dead) || buildings.find(b => b.id === id && !b.dead);
}
function base() { return buildings.find(b => b.kind === 'refinery' && !b.dead); }
function nest() { return buildings.find(b => b.kind === 'nest' && !b.dead); }
function playerUnits() { return units.filter(u => u.team === 'player' && !u.dead); }
function enemyUnits() { return units.filter(u => u.team === 'enemy' && !u.dead); }
function popUsed() {
  return playerUnits().reduce((n, u) => n + STATS[u.kind].pop, 0) +
    G.queue.reduce((n, q) => n + STATS[q.kind].pop, 0);
}
function playerDerricks() { return buildings.filter(b => b.kind === 'derrick' && b.team === 'player' && !b.dead); }
function antenna() { return buildings.find(b => b.kind === 'antenna' && !b.dead); }

function initWorld() {
  units.length = 0; buildings.length = 0; scraps.length = 0; effects.length = 0;
  texts.length = 0; decals.length = 0; pings.length = 0; props.length = 0;
  G.oil = 160; G.scrap = 35; G.queue = []; G.upgraded = false; G.wave = 0;
  G.waveTimer = 55; G.sel = []; G.selBuilding = null; G.pendingEnd = null;
  G.inspectId = null; G.kills = 0; G.alertCool = 0; G.targetMode = null;
  G.baseRally = { x:12.4, y:17.4 }; G.time = 0;
  addBuilding('refinery', 'player', 8.8, 15.6);
  addBuilding('derrick', 'player', 11.3, 19.3);
  addBuilding('nest', 'enemy', 35.5, 27.5);
  addBuilding('derrick', 'enemy', 33.2, 24.9);
  addBuilding('antenna', 'neutral', 21.6, 21.6);
  spawnUnit('tirador', 'player', 11.6, 15.8);
  spawnUnit('tirador', 'player', 12.4, 16.6);
  spawnUnit('lanzachatarra', 'player', 12.6, 15.6);
  spawnUnit('mecanico', 'player', 13.4, 16.4);
  spawnUnit('mutil', 'enemy', 34.3, 28.5);
  spawnUnit('mutil', 'enemy', 33.7, 29.4);
  spawnUnit('piche', 'enemy', 35.7, 30.1);
  G.cam = { x:1340, y:560, z: innerWidth < 500 ? .92 : .95 };
  clampCam();
}

/* ---------- camera ---------- */
function clampCam() {
  const halfW = W / (2 * G.cam.z), halfH = H / (2 * G.cam.z), m = 40;
  if (MAP.pw < halfW * 2 + m * 2) G.cam.x = MAP.pw / 2;
  else G.cam.x = clamp(G.cam.x, halfW - m, MAP.pw - halfW + m);
  if (MAP.ph < halfH * 2 + m * 2) G.cam.y = MAP.ph / 2;
  else G.cam.y = clamp(G.cam.y, halfH - m, MAP.ph - halfH + m);
  G.cam.z = clamp(G.cam.z, .58, 1.55);
}
function worldToScreen(x, y) {
  return { x: VIEW.ax + (x - G.cam.x) * G.cam.z, y: VIEW.ay + (y - G.cam.y) * G.cam.z };
}
function screenToWorld(sx, sy) {
  return { x: (sx - VIEW.ax) / G.cam.z + G.cam.x, y: (sy - VIEW.ay) / G.cam.z + G.cam.y };
}
function screenToGrid(sx, sy) { const p = screenToWorld(sx, sy); return unIso(p.x, p.y); }
function centerOn(gx, gy, z) {
  G.cam.x = iso(gx, gy).x; G.cam.y = iso(gx, gy).y;
  if (z) G.cam.z = z;
  clampCam();
}
function panCam(dx, dy) { G.cam.x += dx; G.cam.y += dy; clampCam(); }
function resize() {
  W = innerWidth; H = innerHeight; DPR = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  VIEW.ax = W / 2; VIEW.ay = H * (H > 520 ? .455 : .42);
  clampCam();
  if (G.state === 'menu' && G.menuHome) { focusBase(); G.menuHome = { x:G.cam.x, y:G.cam.y }; }
  renderDock(true);
}
addEventListener('resize', resize);
addEventListener('orientationchange', () => setTimeout(resize, 220));
if (window.visualViewport) visualViewport.addEventListener('resize', () => setTimeout(resize, 80));

/* ---------- audio ---------- */
function initAudio() {
  if (G.audio) { if (G.audio.state === 'suspended') G.audio.resume(); return; }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    G.audio = new AC(); G.master = G.audio.createGain();
    G.master.gain.value = G.muted ? 0 : .55; G.master.connect(G.audio.destination);
    const len = G.audio.sampleRate * 3, buf = G.audio.createBuffer(1, len, G.audio.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const white = Math.random() * 2 - 1; last = last * .985 + white * .015; data[i] = last * 2.2; }
    const src = G.audio.createBufferSource(); src.buffer = buf; src.loop = true;
    const filt = G.audio.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 420; filt.Q.value = .6;
    const gain = G.audio.createGain(); gain.gain.value = .085;
    src.connect(filt).connect(gain).connect(G.master); src.start();
    const osc = G.audio.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 46;
    const og = G.audio.createGain(); og.gain.value = .012;
    osc.connect(og).connect(G.master); osc.start();
  } catch (e) { G.audio = null; }
}
function blip(freq = 340, dur = .05, type = 'square', vol = .035) {
  if (!G.audio || G.muted) return;
  try {
    const o = G.audio.createOscillator(), g = G.audio.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, G.audio.currentTime);
    g.gain.linearRampToValueAtTime(vol, G.audio.currentTime + .008);
    g.gain.exponentialRampToValueAtTime(.0001, G.audio.currentTime + dur);
    o.connect(g).connect(G.master); o.start(); o.stop(G.audio.currentTime + dur + .02);
  } catch (e) {}
}
function setMuted(m) {
  G.muted = m;
  if (G.master) G.master.gain.value = m ? 0 : .55;
  $('#btnSound').classList.toggle('off', m);
  try { localStorage.setItem('oxido-mute', m ? '1' : '0'); } catch (e) {}
}
function vibrate(pattern) { if (navigator.vibrate) { try { navigator.vibrate(pattern); } catch (e) {} } }

/* ============================================================
   UI / SELECCIÓN / ÓRDENES
   ============================================================ */
const ICON = {
  move:'<path d="M4 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  attack:'<circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="currentColor" stroke-width="1.8"/>',
  patrol:'<path d="M5 8a7 7 0 0 1 13-3M19 16a7 7 0 0 1-13 3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m18 2 0 3.5-3.5 0M6 22l0-3.5 3.5 0" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  stop:'<rect x="6" y="6" width="12" height="12" fill="currentColor"/>',
  army:'<circle cx="9" cy="8" r="2.6" fill="currentColor"/><circle cx="16" cy="9" r="2.2" fill="currentColor"/><path d="M3.5 18c0-2.8 2.5-4.7 5.5-4.7s5.5 1.9 5.5 4.7M14 14c2.8 0 5 1.4 5 4" fill="none" stroke="currentColor" stroke-width="1.7"/>',
  base:'<path d="M3 11 12 4l9 7v9H3z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8 20v-5h8v5M6 9h12" fill="none" stroke="currentColor" stroke-width="1.5"/>',
  flag:'<path d="M6 21V3M6 4h12l-3 4 3 4H6" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  upgrade:'<path d="M12 3 5 6v6c0 4 3 6.7 7 9 4-2.3 7-5 7-9V6l-7-3Z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="m9 12 2 2 4-4" fill="none" stroke="currentColor" stroke-width="1.7"/>',
  wrench:'<path d="M14.5 6.5a4 4 0 0 0-5-4L7 5l2.5 2.5L6 11l-2 2 4 4 2-2 3.5-3.5L16 14l2.5-2.5a4 4 0 0 0-4-5Z" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  close:'<path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2"/>',
  rifle:'<path d="M3 14h12l3-3 3 1-2 2 2 2-3 1-3-2H8l-2 4H3l2-5Z" fill="currentColor"/>',
  rocket:'<path d="M4 18 18 4l2 2-2 5-2-2-5 5 2 2-5 2-2-2Z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M4 20l4-4" stroke="currentColor" stroke-width="1.8"/>',
  oil:'<path d="M12 3s6 6.6 6 11a6 6 0 0 1-12 0c0-4.4 6-11 6-11Z" fill="currentColor"/>'
};
function svgIcon(n, cls = 'ico') {
  return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICON[n] || ''}</svg>`;
}
function focusBase() {
  const b = base(); if (!b) return;
  G.cam.z = W > H ? .8 : .92;
  const p = iso(b.x, b.y);
  G.cam.x = p.x - (W * .34 - VIEW.ax) / G.cam.z;
  G.cam.y = p.y - (H * (W > H ? .36 : .40) - VIEW.ay) / G.cam.z;
  clampCam();
}
function selectedUnits() { return G.sel.map(getEntity).filter(u => u && u.team === 'player'); }
function syncSelection() {
  units.forEach(u => u.selected = G.sel.includes(u.id));
  buildings.forEach(b => b.selected = b === G.selBuilding);
}
function selectUnits(list) {
  G.sel = [...new Set(list.map(x => x && typeof x === 'object' ? x.id : x).filter(Boolean))];
  G.selBuilding = null; G.inspectId = null; syncSelection(); renderDock(true); blip(520, .035, 'triangle', .02);
}
function selectBuilding(b) {
  G.sel = []; G.selBuilding = b; G.inspectId = null; syncSelection(); renderDock(true); blip(300, .05, 'sine', .025);
}
function clearSelection() {
  G.sel = []; G.selBuilding = null; G.inspectId = null; syncSelection(); renderDock(true); clearTargetMode();
}
function inspectEntity(e) {
  G.sel = []; G.selBuilding = null; G.inspectId = e ? e.id : null; syncSelection(); renderDock(true);
}
function getInspect() { return G.inspectId ? getEntity(G.inspectId) : null; }

function toast(msg, ms = 2500) {
  toastEl.innerHTML = msg; toastEl.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => toastEl.classList.remove('show'), ms);
}
function alertMsg(msg, pos) {
  const d = document.createElement('div'); d.className = 'alert'; d.textContent = msg;
  alertsEl.appendChild(d);
  while (alertsEl.children.length > 3) alertsEl.firstChild.remove();
  setTimeout(() => { d.style.opacity = '0'; d.style.transition = 'opacity .3s'; setTimeout(() => d.remove(), 320); }, 2200);
  if (pos) G.lastAlertPos = { x: pos.x, y: pos.y };
  if (G.alertCool <= 0) {
    $('#danger').classList.add('on'); setTimeout(() => $('#danger').classList.remove('on'), 650);
    G.alertCool = 2.5; vibrate([30, 40, 30]);
  }
  blip(180, .18, 'sawtooth', .05);
}
function speech(u, atk = false) {
  if (!u || u.dead) return;
  u.speech = pick(atk ? ACK_ATK : ACKS); u.speechT = 1.9;
}

function orderMove(list, gx, gy, type = 'move') {
  if (!list.length) return;
  gx = clamp(gx, 1.2, MAP.w - 1.2); gy = clamp(gy, 1.2, MAP.h - 1.2);
  const n = list.length;
  list.forEach((u, i) => {
    const a = i * 2.39996, r = n > 1 ? .35 + Math.sqrt(i) * .34 : 0;
    const tx = clamp(gx + Math.cos(a) * r, 1, MAP.w - 1);
    const ty = clamp(gy + Math.sin(a) * r, 1, MAP.h - 1);
    if (type === 'patrol') u.order = { type:'patrol', a:{ x:u.x, y:u.y }, b:{ x:tx, y:ty }, goB:true };
    else u.order = { type:'move', x:tx, y:ty };
    u.anchor = { x:u.x, y:u.y };
    speech(u);
  });
  ping(gx, gy, TEAM.player.accent); blip(480, .05, 'triangle', .025); vibrate(8);
  renderDock(true);
}
function orderAttack(list, target) {
  if (!list.length || !target || target.dead) return;
  list.forEach(u => { u.order = { type:'attack', targetId:target.id }; u.anchor = { x:u.x, y:u.y }; speech(u, true); });
  ping(target.x, target.y, '#ff8a65'); blip(620, .07, 'square', .03); vibrate(10);
  renderDock(true);
}
function orderAttackMove(list, gx, gy) {
  if (!list.length) return;
  const n = list.length;
  list.forEach((u, i) => {
    const a = i * 2.39996, r = n > 1 ? .35 + Math.sqrt(i) * .34 : 0;
    u.order = { type:'attackmove', x:clamp(gx + Math.cos(a) * r, 1, MAP.w - 1), y:clamp(gy + Math.sin(a) * r, 1, MAP.h - 1) };
    u.anchor = { x:u.x, y:u.y }; speech(u, true);
  });
  ping(gx, gy, '#ff8a65'); blip(560, .06, 'square', .028); vibrate(10);
  renderDock(true);
}
function stopUnits(list) {
  list.forEach(u => {
    if (u.order && u.order.type === 'patrol') u.order = null; else u.order = null;
    u.anchor = { x:u.x, y:u.y }; u.tx = undefined;
    if (Math.random() < .5) speech(u);
  });
  blip(220, .06, 'sine', .025); renderDock(true);
}
function ping(gx, gy, color) {
  pings.push({ x:iso(gx, gy).x, y:iso(gx, gy).y, t:0, color });
}

function setTargetMode(mode) {
  if (!mode) return clearTargetMode();
  if (mode !== 'rally' && !selectedUnits().length) { toast('Primero elegí unidades.'); return; }
  G.targetMode = mode;
  targetText.textContent = mode === 'attack' ? 'Tocá un enemigo u objetivo'
    : mode === 'patrol' ? 'Tocá el otro extremo de la patrulla'
    : mode === 'rally' ? 'Tocá el punto de reunión'
    : 'Tocá el destino';
  targetBar.classList.add('show');
  renderDock(true); vibrate(6);
}
function clearTargetMode() {
  G.targetMode = null; targetBar.classList.remove('show'); renderDock(true);
}

/* ---------- production ---------- */
function canMake(kind) {
  if (kind === 'upgrade') return !G.upgraded && G.scrap >= 60;
  const st = STATS[kind];
  return G.oil >= st.cost && popUsed() + st.pop <= G.cap;
}
function make(kind) {
  const baseB = G.selBuilding && G.selBuilding.kind === 'refinery' ? G.selBuilding : null;
  if (!baseB) { toast('Seleccioná la <b>Refinería</b> para producir.'); return; }
  if (kind === 'upgrade') return buyUpgrade();
  if (G.queue.length >= 5) { toast('La cola está llena (5).'); blip(140, .1, 'square', .04); return; }
  const st = STATS[kind];
  if (popUsed() + st.pop > G.cap) { toast('No hay población. Necesitás más refugios (próxima etapa).'); blip(140, .1, 'square', .04); return; }
  if (G.oil < st.cost) { toast(`Falta petróleo: necesitás <b>${st.cost}</b>.`); blip(140, .1, 'square', .04); return; }
  G.oil -= st.cost; G.queue.push({ kind, t:0, dur:st.build });
  blip(430, .05, 'triangle', .03); toast(`${st.label} en producción.`); renderDock(true);
}
function cancelQueue(i) {
  const q = G.queue[i]; if (!q) return;
  G.oil += Math.round(STATS[q.kind].cost * .7); G.queue.splice(i, 1);
  toast('Producción cancelada. Devolvemos el 70%.'); blip(240, .05, 'sine', .025); renderDock(true);
}
function buyUpgrade() {
  if (G.upgraded || G.scrap < 60) return;
  G.scrap -= 60; G.upgraded = true;
  playerUnits().forEach(u => { u.maxHp *= 1.2; u.hp *= 1.2; });
  toast('<b>CHAPA RECICLADA</b> · +20% de vida para todo el ejército.');
  blip(300, .1, 'sine', .05); vibrate([15, 30, 15]); renderDock(true);
}
function setRally(gx, gy) {
  G.baseRally = { x:clamp(gx, 1, MAP.w - 1), y:clamp(gy, 1, MAP.h - 1) };
  ping(gx, gy, TEAM.player.accent); toast('Punto de reunión actualizado.'); blip(620, .05, 'triangle', .03);
}

function updateProduction(dt) {
  if (!G.queue.length) return;
  const b = base();
  if (!b) return;
  const q = G.queue[0]; q.t += dt;
  if (q.t >= q.dur) {
    G.queue.shift();
    let sx = b.x + rnd(1.3, .6), sy = b.y + rnd(1.5, .7);
    spawnUnit(q.kind, 'player', sx, sy);
    const u = units[units.length - 1];
    if (G.baseRally && dist(u, G.baseRally) > .8) u.order = { type:'move', x:G.baseRally.x + rnd(.6, -.6), y:G.baseRally.y + rnd(.6, -.6) };
    toast(`<b>${STATS[q.kind].label}</b> listo.`);
    blip(680, .07, 'triangle', .03); renderDock(true);
  }
}

/* ---------- start / pause / end ---------- */
function startGame() {
  if (G.state === 'playing') return;
  G.started = true; G.state = 'playing'; initAudio();
  document.body.classList.remove('menu');
  const s = $('#startScreen'); s.style.transition = 'opacity .28s'; s.style.opacity = '0';
  setTimeout(() => { s.style.display = 'none'; }, 290);
  selectUnits(playerUnits().map(u => u.id));
  focusBase();
  toast('Tocá el suelo para mover. Arrastrá para elegir varios.', 3600);
  setTimeout(() => { if (G.state === 'playing') toast('Tocá tu <b>Refinería</b> para producir tropas.', 3300); }, 4200);
  setTimeout(() => { if (G.state === 'playing') toast('Capturá la <b>Antena</b> del centro con infantería.', 3300); }, 8500);
  setTimeout(() => { if (G.state === 'playing') toast('El <b>Nido bestial</b> está al sureste. Usá el minimapa o alejá el zoom.', 3600); }, 13000);
  blip(520, .09, 'triangle', .04); renderDock(true);
}
function setPaused(v) {
  if (G.state === 'over') return;
  G.state = v ? 'paused' : 'playing';
  $('#pauseScreen').classList.toggle('show', v);
  if (v) clearTargetMode();
  blip(v ? 220 : 480, .06, 'sine', .03);
}
function showEnd(win) {
  if (G.state === 'over') return;
  G.state = 'over'; G.targetMode = null; targetBar.classList.remove('show');
  $('#pauseScreen').classList.remove('show');
  const es = $('#endScreen');
  $('#endEyebrow').textContent = win ? 'SECTOR ASEGURADO' : 'REFINERÍA PERDIDA';
  $('#endTitle').textContent = win ? 'MESETA CONQUISTADA' : 'SE SECÓ EL POZO';
  $('#endText').innerHTML = win
    ? 'El Nido ardió y el viento se llevó el humo. El petróleo es tuyo... por ahora.'
    : 'La horda entró por el cañadón. Sin refinería no hay patria.';
  const t = Math.floor(G.time);
  $('#endStats').innerHTML = `
    <div><i>TIEMPO</i><b>${String(Math.floor(t / 60)).padStart(2,'0')}:${String(t % 60).padStart(2,'0')}</b></div>
    <div><i>BAJAS</i><b>${G.kills || 0}</b></div>
    <div><i>OLEADAS</i><b>${G.wave}</b></div>
    <div><i>CHATARRA</i><b>${fmt(G.scrap)}</b></div>`;
  es.classList.add('show'); $('#endScreen .sheet').classList.toggle('win', !!win);
  blip(win ? 620 : 150, .35, win ? 'triangle' : 'sawtooth', .05);
  vibrate(win ? [25, 40, 25, 40, 60] : [80, 60, 80]);
}
function restartGame() {
  const u = new URL(location.href); u.searchParams.set('play', '1'); location.href = u.toString();
}
async function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      toast('Pantalla completa. Girá el teléfono si querés más campo.');
    } else await document.exitFullscreen();
  } catch (e) { toast('Tu navegador no permitió pantalla completa.'); }
}

/* ---------- dock ---------- */
function portraitHTML(kind, team) {
  return `<div class="portrait"><canvas width="68" height="68" data-portrait="${kind}" data-team="${team}"></canvas></div>`;
}
function paintPortraits() {
  document.querySelectorAll('canvas[data-portrait]').forEach(cv => {
    const kind = cv.dataset.portrait, team = cv.dataset.team;
    const c = cv.getContext('2d'); c.clearRect(0, 0, 68, 68);
    const grad = c.createRadialGradient(34, 30, 2, 34, 34, 38);
    grad.addColorStop(0, team === 'player' ? 'rgba(199,137,65,.28)' : 'rgba(155,76,58,.28)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = grad; c.fillRect(0, 0, 68, 68);
    c.save(); c.translate(34, 59); c.scale(1.32, 1.32);
    drawUnitSprite(c, { kind, team, face:1, walk:0, moving:false, bob:0, recoil:0, flash:0, rank:0, speechT:0, selected:false }, 0);
    c.restore();
  });
}
function hpHTML(cur, max, enemy) {
  return `<div class="hpTrack${enemy ? ' enemy' : ''}"><i id="selHpBar" style="width:${clamp(cur / max * 100, 0, 100)}%"></i></div>`;
}
function prodCard(kind, opts = {}) {
  const st = STATS[kind];
  const dis = !canMake(kind);
  return `<button class="prod" data-prod="${kind}" ${dis ? 'disabled' : ''}>
    <span class="pIco">${svgIcon(st.icon)}</span>
    <span class="pBody"><b>${st.label.toUpperCase()}</b><small class="cost">PET ${st.cost} · ${st.pop} POB</small><small>${st.build.toFixed(1)} s</small></span>
    ${opts.prog ? `<i class="prog" style="width:${opts.prog}%"></i>` : ''}
  </button>`;
}
function renderDock(force = false) {
  if (!dockInfo || !dockActions) return;
  const sig = [G.state, G.sel.join(','), G.selBuilding ? G.selBuilding.id : '', G.inspectId || '', G.queue.length, G.upgraded, G.targetMode].join('|');
  if (!force && sig === G.dockSig) return;
  G.dockSig = sig;
  const sel = selectedUnits();
  let info = '', actions = '';

  if (sel.length) {
    const u = sel[0], st = STATS[u.kind], team = TEAM[u.team];
    const kinds = [...new Set(sel.map(x => x.kind))];
    const title = sel.length > 1
      ? (kinds.length === 1 ? `${sel.length} ${st.label.toUpperCase()}${sel.length > 1 ? 'S' : ''}` : `${sel.length} UNIDADES`)
      : st.label.toUpperCase();
    const total = sel.reduce((n, x) => n + x.hp, 0), max = sel.reduce((n, x) => n + x.maxHp, 0);
    info = `${portraitHTML(u.kind, u.team)}
      <div class="selText"><h3>${title}</h3>
      <p>${sel.length > 1 ? kinds.map(k => STATS[k].label).join(' · ') : st.desc}</p>${hpHTML(total, max)}</div>
      <div class="util">
        <button data-util="army" aria-label="Seleccionar ejército">${svgIcon('army')}EJÉRCITO</button>
        ${findIdleMechanic() ? `<button data-util="mechanic" aria-label="Buscar mecánico">${svgIcon('wrench')}MEC.</button>` : ''}
        <button class="closeSel" data-util="close" aria-label="Deseleccionar">✕</button>
      </div>`;
    actions = `
      <button class="cmd ${G.targetMode === 'attack' ? 'on' : ''}" data-cmd="attack">${svgIcon('attack')}<span>ATACAR</span></button>
      <button class="cmd ${G.targetMode === 'move' ? 'on' : ''}" data-cmd="move">${svgIcon('move')}<span>MOVER</span></button>
      <button class="cmd ${G.targetMode === 'patrol' ? 'on' : ''}" data-cmd="patrol">${svgIcon('patrol')}<span>PATRULLAR</span></button>
      <button class="cmd" data-cmd="stop">${svgIcon('stop')}<span>DETENER</span></button>`;
  } else if (G.selBuilding) {
    const b = G.selBuilding, st = BSTATS[b.kind], own = b.team === 'player';
    info = `${portraitHTML(b.kind === 'refinery' ? 'tirador' : b.kind, b.team).replace('data-portrait="tirador"', 'data-portrait="refinery"')}
      <div class="selText"><h3>${st.label.toUpperCase()}</h3><p>${own ? st.desc : (b.team === 'enemy' ? 'Objetivo enemigo' : 'Punto de control neutral')}</p>${hpHTML(b.hp, b.maxHp, b.team === 'enemy')}</div>
      <div class="util">${own && b.kind === 'refinery' ? `<button data-util="rally">${svgIcon('flag')}REUNIÓN</button><button data-util="army">${svgIcon('army')}TROPAS</button>` : ''}<button class="closeSel" data-util="close">✕</button></div>`;
    if (own && b.kind === 'refinery') {
      actions = `<div style="grid-column:1/-1"><div class="prodGrid">
        ${prodCard('tirador')}${prodCard('lanzachatarra')}${prodCard('mecanico')}
        <button class="prod ${G.upgraded ? 'done' : ''}" data-prod="upgrade" ${G.upgraded || G.scrap < 60 ? 'disabled' : ''}>
          <span class="pIco">${svgIcon('upgrade')}</span>
          <span class="pBody"><b>${G.upgraded ? 'CHAPA OK' : 'CHAPA +20%'}</b><small class="cost">CHATARRA 60</small><small>${G.upgraded ? 'Ya instalada' : 'Mejora permanente'}</small></span>
        </button></div>
        <div class="queue"><span class="qLabel">COLA ${G.queue.length}/5</span>${G.queue.length ? G.queue.map((q, i) => `<span class="qItem" data-cancel="${i}" title="Cancelar">${STATS[q.kind].short}<i style="width:${clamp(q.t / q.dur * 100, 0, 100)}%"></i></span>`).join('') : '<span class="qEmpty">vacía · tocá una carta</span>'}</div></div>`;
    } else {
      const enemy = b.team === 'enemy';
      actions = `<div class="emptyHint" style="grid-column:1/-1;padding:5px 2px">${svgIcon(enemy ? 'attack' : 'flag')}
        <div><b>${enemy ? 'Objetivo hostil' : 'Capturable con infantería'}</b>${enemy ? 'Tocá la base enemiga con tu ejército seleccionado para atacarla.' : 'Acercá tiradores o mecánicos para tomar la antena.'}</div></div>`;
    }
  } else {
    const ins = getInspect();
    if (ins) {
      const isUnit = !!STATS[ins.kind], st = isUnit ? STATS[ins.kind] : BSTATS[ins.kind];
      const team = TEAM[ins.team] || TEAM.neutral;
      info = `${portraitHTML(ins.kind, ins.team)}
        <div class="selText"><h3>${st.label.toUpperCase()}</h3><p>${st.desc || (isUnit ? 'Unidad' : 'Estructura')}</p>${hpHTML(ins.hp, ins.maxHp, ins.team !== 'player')}</div>
        <div class="util"><button class="closeSel" data-util="close">✕</button></div>`;
      actions = `<div class="emptyHint" style="grid-column:1/-1;padding:5px 2px">${svgIcon(ins.team === 'enemy' ? 'attack' : 'flag')}
        <div><b>${ins.team === 'enemy' ? 'Enemigo detectado' : ins.team === 'neutral' ? 'Punto de control' : 'Tuyo'}</b>${ins.team === 'enemy' ? 'Elegí tus unidades y tocá este objetivo.' : 'La infantería puede capturarlo.'}</div></div>`;
    } else {
      info = `<div class="emptyHint">${svgIcon('army')}<div><b>SIN SELECCIÓN</b>Tocá una unidad, arrastrá un recuadro o mantené presionado para las órdenes.</div></div>
        <div class="util"><button data-util="base">${svgIcon('base')}BASE</button><button data-util="army">${svgIcon('army')}EJÉRCITO</button></div>`;
      actions = `<div class="quickRow" style="grid-column:1/-1">
        <button class="cmd" data-util="base">${svgIcon('base')}<span>IR A LA REFINERÍA</span></button>
        <button class="cmd" data-util="army">${svgIcon('army')}<span>ELEGIR TODO</span></button></div>`;
    }
  }
  dockInfo.innerHTML = info;
  dockActions.innerHTML = actions;
  paintPortraits(); updateAffordability();
  requestAnimationFrame(paintPortraits);
  requestAnimationFrame(() => {
    const h = $('#dock').getBoundingClientRect().height;
    toastEl.style.bottom = `${Math.round(h + 8)}px`;
    targetBar.style.bottom = `${Math.round(h + 8)}px`;
  });
}
function findIdleMechanic() {
  return playerUnits().find(u => u.kind === 'mecanico' && !u.order);
}
function updateAffordability() {
  document.querySelectorAll('[data-prod]').forEach(btn => {
    const kind = btn.dataset.prod;
    if (G.upgraded && kind === 'upgrade') { btn.disabled = true; return; }
    btn.disabled = !canMake(kind);
  });
}
function updateHUD() {
  rOil.textContent = fmt(G.oil);
  rScrap.textContent = fmt(G.scrap);
  rPop.textContent = `${popUsed()}/${G.cap}`;
  const wb = waveChip.querySelector('b');
  const t = Math.max(0, Math.ceil(G.waveTimer));
  if (wb) wb.textContent = `en ${Math.floor(t / 60)}:${String(t % 60).padStart(2,'0')}`;
  waveChip.classList.toggle('hot', G.waveTimer <= 10);
  const n = nest();
  nestBar.style.width = n ? `${clamp(n.hp / n.maxHp * 100, 0, 100)}%` : '0%';
  const owner = antenna();
  $('#miniOwner').textContent = owner ? (owner.team === 'player' ? 'ANTENA PROPIA' : owner.team === 'enemy' ? 'ANTENA HOSTIL' : 'SECTOR 7') : 'SECTOR 7';
  const bar = document.getElementById('selHpBar');
  if (bar) {
    const sel = selectedUnits();
    if (sel.length) {
      const c = sel.reduce((a, u) => a + u.hp, 0), m = sel.reduce((a, u) => a + u.maxHp, 0);
      bar.style.width = `${clamp(c / m * 100, 0, 100)}%`;
    } else if (G.selBuilding) bar.style.width = `${clamp(G.selBuilding.hp / G.selBuilding.maxHp * 100, 0, 100)}%`;
  }
  document.querySelectorAll('.qItem').forEach((el, i) => {
    const q = G.queue[i]; if (!q) return; const p = el.querySelector('i');
    if (p) p.style.width = `${clamp(q.t / q.dur * 100, 0, 100)}%`;
  });
  document.querySelectorAll('[data-prod]').forEach(btn => {
    if (btn.dataset.prod === 'upgrade' && G.upgraded) return;
    btn.disabled = !canMake(btn.dataset.prod);
  });
}

document.addEventListener('click', e => {
  const prod = e.target.closest('[data-prod]');
  if (prod) { e.preventDefault(); make(prod.dataset.prod); return; }
  const cancel = e.target.closest('[data-cancel]');
  if (cancel) { e.preventDefault(); cancelQueue(+cancel.dataset.cancel); return; }
  const cmd = e.target.closest('[data-cmd]');
  if (cmd) { e.preventDefault(); const c = cmd.dataset.cmd; if (c === 'stop') stopUnits(selectedUnits()); else setTargetMode(c); return; }
  const util = e.target.closest('[data-util]');
  if (util) {
    e.preventDefault(); const u = util.dataset.util;
    if (u === 'close') clearSelection();
    if (u === 'army') {
      const list = playerUnits(); if (list.length) { selectUnits(list.map(x => x.id)); toast(`Ejército completo: <b>${list.length}</b> unidades.`); }
      else toast('No te queda ni un soldado.');
    }
    if (u === 'base') { const b = base(); if (b) { centerOn(b.x, b.y, Math.max(G.cam.z, .95)); selectBuilding(b); } }
    if (u === 'rally') setTargetMode('rally');
    if (u === 'mechanic') {
      const m = findIdleMechanic(); if (m) { selectUnits([m.id]); centerOn(m.x, m.y, Math.max(G.cam.z, .98)); toast('Mecánico ocioso. Mandalo a reparar o capturar.'); }
      else toast('No hay mecánicos ociosos.');
    }
    return;
  }
  const menu = e.target.closest('[data-menu]');
  if (menu) { e.preventDefault(); const m = menu.dataset.menu; closeRadial(); if (m === 'stop') stopUnits(selectedUnits()); else setTargetMode(m); }
});

/* ============================================================
   ENTRADA TÁCTIL
   ============================================================ */
function entityAtScreen(sx, sy) {
  let best = null, bd = 1e9;
  for (const u of units) {
    if (u.dead) continue;
    const p = worldToScreen(iso(u.x, u.y).x, iso(u.x, u.y).y);
    const tol = 27 * clamp(G.cam.z, .8, 1.18) + 7;
    const d = Math.hypot(sx - p.x, sy - (p.y - 9));
    if (d < tol + (u === best ? 0 : 0) && d < bd) { bd = d; best = u; }
  }
  for (const b of buildings) {
    if (b.dead) continue;
    const p = worldToScreen(iso(b.x, b.y).x, iso(b.x, b.y).y);
    const st = BSTATS[b.kind];
    const h = st.visual || 60;
    const cy = p.y - h * .42 * G.cam.z;
    const rx = (st.hit * .72 + 10) * G.cam.z;
    const ry = (h * .55 + 11) * G.cam.z;
    const dx = (sx - p.x) / rx, dy = (sy - cy) / ry;
    if (dx * dx + dy * dy <= 1 && Math.hypot(sx - p.x, sy - cy) < bd) { bd = Math.hypot(sx - p.x, sy - cy); best = b; }
  }
  return best;
}
function selectionBoxSelect(x1, y1, x2, y2) {
  const l = Math.min(x1, x2), r = Math.max(x1, x2), t = Math.min(y1, y2), b = Math.max(y1, y2);
  const list = playerUnits().filter(u => {
    const p = worldToScreen(iso(u.x, u.y).x, iso(u.x, u.y).y);
    return p.x >= l - 16 && p.x <= r + 16 && p.y >= t - 20 && p.y <= b + 20;
  });
  if (list.length) selectUnits(list.map(u => u.id)); else clearSelection();
}
function selectSameKind(kind) {
  const list = playerUnits().filter(u => {
    const p = worldToScreen(iso(u.x, u.y).x, iso(u.x, u.y).y);
    return u.kind === kind && p.x > -30 && p.x < W + 30 && p.y > -30 && p.y < H + 30;
  });
  if (list.length) { selectUnits(list.map(u => u.id)); toast(`${list.length} × ${STATS[kind].label} en pantalla.`); }
}
function resolveTarget(sx, sy) {
  const ent = entityAtScreen(sx, sy);
  const g = screenToGrid(sx, sy);
  const sel = selectedUnits();
  if (G.targetMode === 'rally') { setRally(g.x, g.y); clearTargetMode(); return; }
  if (!sel.length) { clearTargetMode(); return; }
  if (ent && ent.team === 'enemy') {
    if (G.targetMode === 'attack') orderAttack(sel, ent);
    else if (G.targetMode === 'patrol') orderMove(sel, ent.x, ent.y, 'patrol');
    else orderMove(sel, ent.x, ent.y, 'move');
  } else if (G.targetMode === 'attack') orderAttackMove(sel, g.x, g.y);
  else if (G.targetMode === 'patrol') orderMove(sel, g.x, g.y, 'patrol');
  else orderMove(sel, g.x, g.y, 'move');
  clearTargetMode();
}
function handleTap(sx, sy) {
  if (G.state !== 'playing') return;
  const ent = entityAtScreen(sx, sy);
  const now = performance.now();
  if (lastTap && now - lastTap.t < 340 && Math.hypot(sx - lastTap.x, sy - lastTap.y) < 34) {
    if (ent && STATS[ent.kind] && ent.team === 'player') { selectSameKind(ent.kind); lastTap = null; return; }
  }
  lastTap = { t:now, x:sx, y:sy };
  if (G.targetMode) { resolveTarget(sx, sy); return; }
  if (ent) {
    if (STATS[ent.kind]) {
      if (ent.team === 'player') selectUnits([ent.id]);
      else if (selectedUnits().length) orderAttack(selectedUnits(), ent);
      else inspectEntity(ent);
    } else {
      if (ent.team === 'player') selectBuilding(ent);
      else if (selectedUnits().length) {
        if (ent.team === 'enemy') orderAttack(selectedUnits(), ent);
        else orderMove(selectedUnits(), ent.x, ent.y);
      } else inspectEntity(ent);
    }
    return;
  }
  const g = screenToGrid(sx, sy);
  if (selectedUnits().length) orderMove(selectedUnits(), g.x, g.y);
  else clearSelection();
}
function openRadial(x, y) {
  const ent = entityAtScreen(x, y);
  if (ent && ent.team === 'player') { if (STATS[ent.kind]) selectUnits([ent.id]); else selectBuilding(ent); }
  const rad = $('#radial'), menu = $('#radialMenu');
  rad.classList.add('show');
  menu.style.left = '0px'; menu.style.top = '0px';
  requestAnimationFrame(() => {
    const r = menu.getBoundingClientRect();
    menu.style.left = `${clamp(x - 98, 8, W - r.width - 8)}px`;
    menu.style.top = `${clamp(y - r.height / 2, 8, H - r.height - 8)}px`;
  });
  vibrate(16);
}
function closeRadial() { $('#radial').classList.remove('show'); }

canvas.addEventListener('pointerdown', e => {
  if (G.state !== 'playing') return;
  e.preventDefault();
  try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  pointers.set(e.pointerId, { id:e.pointerId, x:e.clientX, y:e.clientY, sx:e.clientX, sy:e.clientY });
  if (pointers.size === 1) {
    pointer = { x:e.clientX, y:e.clientY, sx:e.clientX, sy:e.clientY };
    gesture = 'pending'; suppressTap = false; dragBox = null;
    clearTimeout(longPressTimer);
    longPressTimer = setTimeout(() => {
      if (gesture === 'pending' && pointers.size === 1) {
        gesture = 'longpress'; suppressTap = true; openRadial(pointer.x, pointer.y);
      }
    }, 470);
  } else if (pointers.size === 2) {
    clearTimeout(longPressTimer);
    gesture = 'pinch'; dragBox = null; suppressTap = true;
    const ps = [...pointers.values()];
    const mid = { x:(ps[0].x + ps[1].x) / 2, y:(ps[0].y + ps[1].y) / 2 };
    pinch = { d:Math.max(12, Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y)), z:G.cam.z, world:screenToWorld(mid.x, mid.y) };
  }
});
canvas.addEventListener('pointermove', e => {
  const p = pointers.get(e.pointerId); if (!p) return;
  p.x = e.clientX; p.y = e.clientY;
  if (pointers.size >= 2 && pinch) {
    const ps = [...pointers.values()];
    const mid = { x:(ps[0].x + ps[1].x) / 2, y:(ps[0].y + ps[1].y) / 2 };
    const d = Math.max(12, Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y));
    const nz = clamp(pinch.z * d / pinch.d, .58, 1.55);
    G.cam.z = nz;
    G.cam.x = pinch.world.x - (mid.x - VIEW.ax) / nz;
    G.cam.y = pinch.world.y - (mid.y - VIEW.ay) / nz;
    clampCam(); return;
  }
  if (pointer && gesture === 'pending') {
    if (Math.hypot(e.clientX - pointer.sx, e.clientY - pointer.sy) > 12) {
      gesture = 'box'; clearTimeout(longPressTimer); suppressTap = true;
      dragBox = { x0:pointer.sx, y0:pointer.sy, x:e.clientX, y:e.clientY };
    }
  }
  if (gesture === 'box' && dragBox) { dragBox.x = e.clientX; dragBox.y = e.clientY; }
});
function endPointer(e) {
  const p = pointers.get(e.pointerId);
  pointers.delete(e.pointerId);
  try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
  if (gesture === 'pinch') {
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 0) { gesture = 'none'; pointer = null; }
    return;
  }
  if (gesture === 'box' && dragBox) {
    selectionBoxSelect(dragBox.x0, dragBox.y0, dragBox.x, dragBox.y);
    dragBox = null; gesture = 'none'; pointer = null; suppressTap = false; return;
  }
  if (gesture === 'pending' && pointer && !suppressTap) {
    handleTap(pointer.sx, pointer.sy);
  }
  if (pointers.size === 0) { gesture = 'none'; pointer = null; suppressTap = false; pinch = null; }
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('contextmenu', e => {
  e.preventDefault();
  if (G.state !== 'playing') return;
  const ent = entityAtScreen(e.clientX, e.clientY);
  const g = screenToGrid(e.clientX, e.clientY);
  const sel = selectedUnits();
  if (!sel.length) return;
  if (ent && ent.team === 'enemy') orderAttack(sel, ent);
  else orderMove(sel, g.x, g.y);
});
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const before = screenToWorld(e.clientX, e.clientY);
  const nz = clamp(G.cam.z * (e.deltaY > 0 ? .9 : 1.1), .58, 1.55);
  G.cam.z = nz;
  G.cam.x = before.x - (e.clientX - VIEW.ax) / nz;
  G.cam.y = before.y - (e.clientY - VIEW.ay) / nz;
  clampCam();
}, { passive:false });

/* minimap */
let miniDown = false;
function miniJump(e) {
  const r = mini.getBoundingClientRect();
  const nx = clamp((e.clientX - r.left) / r.width, 0, 1), ny = clamp((e.clientY - r.top) / r.height, 0, 1);
  G.cam.x = nx * MAP.pw; G.cam.y = ny * MAP.ph; clampCam();
}
mini.addEventListener('pointerdown', e => {
  e.preventDefault(); miniDown = true;
  try { mini.setPointerCapture(e.pointerId); } catch (err) {}
  miniJump(e); vibrate(5);
});
mini.addEventListener('pointermove', e => { if (miniDown) { e.preventDefault(); miniJump(e); } });
mini.addEventListener('pointerup', () => miniDown = false);
mini.addEventListener('pointercancel', () => miniDown = false);

/* keyboard / desktop fallback */
const keys = new Set();
addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k)) e.preventDefault();
  keys.add(k);
  if (k === 'escape') { closeRadial(); clearTargetMode(); if (G.state === 'playing') setPaused(true); }
  if (k === 'p' && (G.state === 'playing' || G.state === 'paused')) setPaused(G.state === 'playing');
  if (k === 'm') setMuted(!G.muted);
  if (k === ' ' && G.state === 'playing') {
    if (G.lastAlertPos) { centerOn(G.lastAlertPos.x, G.lastAlertPos.y); toast('Última alerta.'); }
    else { const b = base(); if (b) centerOn(b.x, b.y); }
  }
  if (k === 'a' && G.state === 'playing' && !e.ctrlKey) { e.preventDefault(); setTargetMode('attack'); }
  if (k === 'x' && G.state === 'playing') stopUnits(selectedUnits());
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));

/* top / overlay buttons */
$('#startBtn').addEventListener('click', startGame);
$('#btnSound').addEventListener('click', () => { initAudio(); setMuted(!G.muted); blip(480, .05, 'triangle', .03); });
$('#btnPause').addEventListener('click', () => {
  initAudio();
  if (G.state === 'playing') setPaused(true);
  else if (G.state === 'paused') setPaused(false);
  else if (G.state === 'menu') toast('Tocá JUGAR para empezar.');
});
$('#resumeBtn').addEventListener('click', () => setPaused(false));
$('#fsBtn').addEventListener('click', toggleFullscreen);
$('#restartBtn').addEventListener('click', restartGame);
$('#againBtn').addEventListener('click', restartGame);
$('#cancelTarget').addEventListener('click', clearTargetMode);
$('#radialClose').addEventListener('click', closeRadial);
$('#radialBack').addEventListener('click', closeRadial);
document.querySelectorAll('[data-speed]').forEach(btn => btn.addEventListener('click', () => {
  G.speed = +btn.dataset.speed;
  document.querySelectorAll('[data-speed]').forEach(b => b.classList.toggle('on', b === btn));
  blip(420 + G.speed * 90, .04, 'triangle', .025);
}));
document.addEventListener('visibilitychange', () => { if (document.hidden && G.state === 'playing') setPaused(true); });
document.addEventListener('gesturestart', e => e.preventDefault());
addEventListener('contextmenu', e => { if (e.target.closest('#game')) e.preventDefault(); });

/* ============================================================
   SIMULACIÓN
   ============================================================ */
function findEnemyNear(u, range) {
  let best = null, bd = range;
  for (const v of units) {
    if (v.dead || v.team === u.team) continue;
    const d = dist(u, v) - v.radius * .4;
    if (d < bd) { bd = d; best = v; }
  }
  for (const b of buildings) {
    if (b.dead || b.team === u.team || b.team === 'neutral' || b.kind === 'antenna') continue;
    const d = dist(u, b) - b.radius;
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}
function moveUnit(u, tx, ty, dt, stop = .12) {
  const dx = tx - u.x, dy = ty - u.y, d = Math.hypot(dx, dy);
  if (d <= stop) { u.moving = false; return d; }
  const st = STATS[u.kind], step = Math.min(st.speed * dt, d - stop * .45);
  u.x = clamp(u.x + dx / d * step, 1, MAP.w - 1);
  u.y = clamp(u.y + dy / d * step, 1, MAP.h - 1);
  u.moving = true; u.walk += dt * (u.team === 'enemy' ? 11 : 9);
  const sdx = dx - dy;
  if (Math.abs(sdx) > .02) u.face = sdx > 0 ? 1 : -1;
  return d - step;
}
function faceTarget(u, t) {
  const a = iso(u.x, u.y), b = iso(t.x, t.y);
  if (Math.abs(b.x - a.x) > .5) u.face = b.x > a.x ? 1 : -1;
}
function followOrder(u, dt) {
  const o = u.order;
  if (!o) { u.moving = false; return; }
  if (o.type === 'move' || o.type === 'attackmove') {
    const d = moveUnit(u, o.x, o.y, dt, .18);
    if (d < .28) { u.order = null; u.anchor = { x:u.x, y:u.y }; u.moving = false; }
  } else if (o.type === 'patrol') {
    const p = o.goB ? o.b : o.a;
    const d = moveUnit(u, p.x, p.y, dt, .25);
    if (d < .35) o.goB = !o.goB;
  } else if (o.type === 'attack') {
    u.order = null; u.moving = false;
  }
}
function doAttack(u, t) {
  const st = STATS[u.kind];
  u.cd = st.cd * rnd(1.1, .9);
  const armor = t.armor || (STATS[t.kind] ? STATS[t.kind].armor : 'building');
  const mult = (DMG[st.role] && DMG[st.role][armor]) || 1;
  let dmg = st.dmg * mult * (1 + u.rank * .1);
  t.hp -= dmg; t.flash = .18; u.recoil = .14;
  const p1 = iso(u.x, u.y), p2 = iso(t.x, t.y);
  const muzzleY = p1.y - 16 - (t.kind === 'piche' ? 0 : 0);
  if (st.role === 'heavy' || st.role === 'inf' && u.kind === 'mutil') {
    effects.push({ type:'slash', x1:p1.x + u.face * 13, y1:p1.y - 10, x2:p2.x, y2:p2.y - 8, life:.14, max:.14, color:u.team === 'player' ? '#ffd08a' : '#ff8f6a' });
  } else {
    effects.push({ type:'tracer', x1:p1.x + u.face * 11, y1:muzzleY, x2:p2.x + rnd(4, -4), y2:p2.y - (t.radius ? 13 : 20), life:.11, max:.11, color:u.team === 'player' ? '#ffe4a4' : '#ff9b73' });
  }
  if (u.kind === 'lanzachatarra') {
    for (let i = 0; i < 4; i++) effects.push({ type:'p', x:p1.x + u.face * 12, y:muzzleY, vx:rnd(40, -20), vy:rnd(10, -40), life:.3, max:.3, size:rnd(2.2, .8), color:'#d6c39a', grav:30 });
  }
  if (t.hp <= 0) killEntity(t, u);
  blip(u.team === 'player' ? 210 + rnd(60, -20) : 150, .025, 'square', .012);
}
function checkRank(u) {
  const nr = u.kills >= 9 ? 3 : u.kills >= 5 ? 2 : u.kills >= 2 ? 1 : 0;
  if (nr > u.rank) {
    u.rank = nr; u.maxHp *= 1.1; u.hp = Math.min(u.maxHp, u.hp + u.maxHp * .15);
    texts.push({ x:iso(u.x, u.y).x, y:iso(u.x, u.y).y - 40, text:`RANGO ${nr}`, color:'#ffe0a0', life:1.4, max:1.4 });
    for (let i = 0; i < 6; i++) effects.push({ type:'p', x:iso(u.x, u.y).x, y:iso(u.x, u.y).y - 16, vx:rnd(24, -24), vy:rnd(-8, -34), life:.5, max:.5, size:rnd(2.2, .8), color:'#ffd47a', grav:20 });
  }
}
function spawnScrap(x, y, amount) {
  scraps.push({ id:uid++, x:clamp(x + rnd(.4, -.4), 1, MAP.w - 1), y:clamp(y + rnd(.4, -.4), 1, MAP.h - 1), amount, life:42, bob:rnd(TAU), dead:false });
}
function killEntity(e, attacker) {
  if (e.dead) return;
  e.dead = true;
  const p = iso(e.x, e.y);
  const isUnit = !!STATS[e.kind];
  if (attacker && attacker.team === 'player' && e.team === 'enemy') {
    G.kills = (G.kills || 0) + 1;
    if (isUnit && attacker && attacker.kills !== undefined) { attacker.kills++; checkRank(attacker); }
  }
  const n = isUnit ? 10 : 22;
  for (let i = 0; i < n; i++) {
    effects.push({ type:'p', x:p.x + rnd(16, -16), y:p.y - rnd(22, 0), vx:rnd(55, -55), vy:rnd(-5, -65), life:rnd(.9, .35), max:.9, size:rnd(3.4, 1), color:pick(['#f0a35c','#d26b3d','#5e4a37','#d8c08a']), grav:70 });
  }
  decals.push({ x:p.x, y:p.y, r:isUnit ? 13 : 34, life:1, color:'rgba(48,38,30,.55)' });
  if (decals.length > 50) decals.shift();
  if (e.team === 'enemy' && isUnit) spawnScrap(e.x, e.y, 8 + (e.kind === 'piche' ? 12 : 0));
  if (!isUnit && e.kind === 'derrick') spawnScrap(e.x, e.y, 25);
  if (!isUnit && e.kind === 'nest') G.pendingEnd = { win:true, t:1.6 };
  if (!isUnit && e.kind === 'refinery') G.pendingEnd = { win:false, t:1.3 };
  if (e.team === 'player' && isUnit) alertMsg(`PERDIMOS UN ${STATS[e.kind].label.toUpperCase()}`, e);
  if (G.sel.includes(e.id)) { G.sel = G.sel.filter(id => id !== e.id); syncSelection(); renderDock(true); }
  if (G.selBuilding === e) { G.selBuilding = null; syncSelection(); renderDock(true); }
  if (G.inspectId === e.id) G.inspectId = null;
  if (isUnit) {
    const i = units.indexOf(e); if (i >= 0) units.splice(i, 1);
  }
}
function separateUnits() {
  for (let i = 0; i < units.length; i++) {
    const a = units[i]; if (a.dead) continue;
    for (let j = i + 1; j < units.length; j++) {
      const b = units[j]; if (b.dead) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), min = a.radius + b.radius || .55;
      if (d < min && d > .001) {
        const push = (min - d) * .5, nx = dx / d, ny = dy / d;
        a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
      }
    }
    for (const b of buildings) {
      if (b.dead) continue;
      const dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy), min = (a.radius || .3) + b.radius * .72;
      if (d < min && d > .001) { a.x += dx / d * (min - d); a.y += dy / d * (min - d); }
    }
    a.x = clamp(a.x, 1, MAP.w - 1); a.y = clamp(a.y, 1, MAP.h - 1);
  }
}
function updateUnits(dt) {
  for (const u of units) {
    if (u.dead) continue;
    const st = STATS[u.kind];
    u.cd -= dt; u.flash = Math.max(0, u.flash - dt); u.recoil = Math.max(0, u.recoil - dt);
    u.speechT = Math.max(0, u.speechT - dt);
    if (u.rank >= 3 && u.hp < u.maxHp) u.hp = Math.min(u.maxHp, u.hp + 2.2 * dt);
    if (u.team === 'player' && u.kind === 'mecanico' && !u.order) repairNearby(u, dt);

    let target = null;
    if (u.order && u.order.type === 'attack') {
      const t = getEntity(u.order.targetId);
      if (t && !t.dead) target = t; else u.order = null;
    }
    if (!target) {
      const range = u.order && u.order.type === 'attackmove' ? 6.2 : (u.team === 'player' ? 5.2 : 6);
      target = findEnemyNear(u, range);
    }
    if (!target && u.order && u.order.type === 'attack') { u.order = null; }
    if (target && !u.order && dist(u, target) > 11) target = null;

    if (target) {
      const d = dist(u, target) - target.radius * .55;
      faceTarget(u, target);
      if (d <= st.range) {
        u.moving = false;
        if (u.cd <= 0) doAttack(u, target);
      } else {
        const chase = !u.order || u.order.type !== 'move';
        if (chase) {
          const dd = moveUnit(u, target.x, target.y, dt, Math.max(.25, st.range * .7));
          if (dd < .1) u.moving = false;
        } else followOrder(u, dt);
      }
    } else followOrder(u, dt);
  }
  separateUnits();
}
function repairNearby(u, dt) {
  for (const b of buildings) {
    if (b.dead || b.team !== 'player' || b.hp >= b.maxHp) continue;
    if (dist(u, b) <= 2.3 + b.radius) {
      b.hp = Math.min(b.maxHp, b.hp + 5 * dt);
      if (Math.random() < dt * 6) spawnSpark(b.x, b.y);
      return;
    }
  }
  for (const v of units) {
    if (v.dead || v === u || v.team !== 'player' || v.hp >= v.maxHp) continue;
    if (dist(u, v) <= 2.2) {
      v.hp = Math.min(v.maxHp, v.hp + 4 * dt);
      if (Math.random() < dt * 5) spawnSpark(v.x, v.y);
      return;
    }
  }
}
function spawnSpark(gx, gy) {
  const p = iso(gx, gy);
  effects.push({ type:'p', x:p.x + rnd(9, -9), y:p.y - rnd(18, 2), vx:rnd(24, -24), vy:rnd(-20, -45), life:.35, max:.35, size:1.6, color:'#ffd27d', grav:20 });
}
function updateBuildings(dt) {
  for (const b of buildings) {
    b.flash = Math.max(0, b.flash - dt);
    b.pulse = (b.pulse || 0) + dt;
    if (b.dead) continue;
    if (b.kind === 'refinery' && b.team === 'player') {
      b.smokeT -= dt;
      if (b.smokeT <= 0) {
        b.smokeT = .24;
        const p = iso(b.x, b.y);
        effects.push({ type:'p', x:p.x + 26 + rnd(4, -3), y:p.y - 72, vx:rnd(9, -2), vy:rnd(-14, -28), life:1.6, max:1.6, size:rnd(6, 3), color:'rgba(125,115,95,.28)', grav:-4, smoke:true });
      }
      b.cd -= dt;
      const t = findEnemyNear(b, 4.8);
      if (t && b.cd <= 0) {
        b.cd = 1.35;
        t.hp -= 10; t.flash = .15;
        const p1 = iso(b.x, b.y), p2 = iso(t.x, t.y);
        effects.push({ type:'tracer', x1:p1.x - 20, y1:p1.y - 52, x2:p2.x, y2:p2.y - 10, life:.12, max:.12, color:'#ffd58f' });
        if (t.hp <= 0) killEntity(t, b);
      }
    }
    if (b.kind === 'nest' && b.team === 'enemy') {
      b.cd -= dt;
      const t = findEnemyNear(b, 3.4);
      if (t && b.cd <= 0) {
        b.cd = 1.5;
        t.hp -= 9; t.flash = .18;
        effects.push({ type:'slash', x1:iso(b.x, b.y).x, y1:iso(b.x, b.y).y - 20, x2:iso(t.x, t.y).x, y2:iso(t.x, t.y).y - 8, life:.15, max:.15, color:'#c9a15a' });
        if (t.hp <= 0) killEntity(t, b);
      }
    }
    if (b.kind === 'antenna') updateCapture(b, dt);
  }
}
function updateCapture(b, dt) {
  let p = 0, e = 0;
  for (const u of units) {
    if (u.dead || dist(u, b) > 2.7) continue;
    if (u.team === 'player' && (u.kind === 'tirador' || u.kind === 'lanzachatarra' || u.kind === 'mecanico')) p++;
    if (u.team === 'enemy') e++;
  }
  const before = b.team;
  if (p > 0 && e === 0) b.capture = Math.min(1, b.capture + dt * (.17 + .06 * Math.min(p, 3)));
  else if (e > 0 && p === 0) b.capture = Math.max(-1, b.capture - dt * (.17 + .05 * Math.min(e, 3)));
  else if (p === 0 && e === 0) b.capture += (b.capture > 0 ? -1 : 1) * Math.min(Math.abs(b.capture), dt * .035);
  if (b.capture >= 1) b.team = 'player';
  else if (b.capture <= -1) b.team = 'enemy';
  else if (b.capture > -.02 && b.capture < .02 && b.team !== 'neutral' && p === 0 && e === 0) b.team = 'neutral';
  if (b.team !== before) {
    toast(`<b>ANTENA</b> · ${b.team === 'player' ? 'bajo control petrolero' : 'tomada por los bestiales'}`);
    alertMsg(b.team === 'player' ? 'ANTENA CAPTURADA' : 'PERDIMOS LA ANTENA', b);
    for (let i = 0; i < 18; i++) effects.push({ type:'p', x:iso(b.x, b.y).x, y:iso(b.x, b.y).y - 30, vx:rnd(40, -40), vy:rnd(-10, -55), life:.8, max:.8, size:rnd(2.5, .8), color:b.team === 'player' ? '#7bdbc9' : '#d27062', grav:35 });
  }
}
function updateScraps(dt) {
  for (let i = scraps.length - 1; i >= 0; i--) {
    const s = scraps[i];
    s.life -= dt; s.bob += dt;
    if (s.life <= 0) { scraps.splice(i, 1); continue; }
    const collector = playerUnits().find(u => dist(u, s) < 1.35);
    if (collector) {
      G.scrap += s.amount;
      texts.push({ x:iso(s.x, s.y).x, y:iso(s.x, s.y).y - 14, text:`+${s.amount} CHATARRA`, color:'#cfd9dd', life:1.2, max:1.2 });
      blip(740, .04, 'triangle', .02);
      scraps.splice(i, 1);
    }
  }
}
function spawnWave() {
  G.wave++;
  const n = Math.min(6, 1 + Math.ceil(G.wave * .7));
  const b = nest(); if (!b) return;
  const spots = [];
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU;
    const x = clamp(b.x + Math.cos(a) * 1.7, 2, MAP.w - 2), y = clamp(b.y + Math.sin(a) * 1.7, 2, MAP.h - 2);
    spawnUnit('mutil', 'enemy', x, y);
    spots.push(units[units.length - 1]);
  }
  if (G.wave >= 2) {
    spawnUnit('piche', 'enemy', b.x + rnd(1, -1), b.y + 1.6);
    spots.push(units[units.length - 1]);
  }
  const tgt = base() || { x:10, y:17 };
  spots.forEach((u, i) => {
    u.order = { type:'attackmove', x:tgt.x + rnd(1.4, -.8), y:tgt.y + rnd(1.4, -.8) };
    u.anchor = { x:u.x, y:u.y };
  });
  G.waveTimer = Math.max(34, 50 - G.wave * 1.2);
  alertMsg(`OLEADA ${G.wave}`, b);
  toast(`<b>OLEADA ${G.wave}</b> · los bestiales salieron del Nido.`, 3200);
  vibrate([40, 50, 40]);
}
function updateEffects(dt) {
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i];
    e.life -= dt;
    if (e.type === 'p') {
      e.x += e.vx * dt; e.y += e.vy * dt; e.vy += (e.grav || 0) * dt;
      if (e.smoke) e.size += dt * 5;
    }
    if (e.life <= 0) effects.splice(i, 1);
  }
  if (effects.length > 260) effects.splice(0, effects.length - 260);
  for (let i = texts.length - 1; i >= 0; i--) {
    const t = texts[i]; t.life -= dt; t.y -= dt * 18;
    if (t.life <= 0) texts.splice(i, 1);
  }
  for (let i = pings.length - 1; i >= 0; i--) {
    pings[i].t += dt; if (pings[i].t > .75) pings.splice(i, 1);
  }
}
function update(dt) {
  if (G.state !== 'playing') return;
  dt *= G.speed;
  G.time += dt;
  G.alertCool = Math.max(0, G.alertCool - dt);
  G.waveTimer -= dt;
  if (G.waveTimer <= 0) spawnWave();
  updateUnits(dt);
  updateBuildings(dt);
  updateProduction(dt);
  updateScraps(dt);
  updateEffects(dt);
  const rate = playerDerricks().length * 1.0 + (base() ? .32 : 0) + (antenna() && antenna().team === 'player' ? .42 : 0);
  G.oil = Math.min(9999, G.oil + rate * dt);
  if (G.pendingEnd) {
    G.pendingEnd.t -= dt;
    if (G.pendingEnd.t <= 0) showEnd(G.pendingEnd.win);
  }
}

/* ============================================================
   RENDER
   ============================================================ */
function drawBar(c, x, y, w, h, ratio, color, bg = 'rgba(12,10,8,.85)') {
  c.fillStyle = bg; c.fillRect(x, y, w, h);
  c.fillStyle = color; c.fillRect(x + .5, y + .5, Math.max(0, (w - 1) * clamp(ratio, 0, 1)), h - 1);
  c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = .5; c.strokeRect(x, y, w, h);
}
function drawMuzzle(c, x, y, size = 4) {
  c.save(); c.fillStyle = '#ffe6a5'; c.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU, r = i % 2 ? size * .45 : size;
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    i ? c.lineTo(px, py) : c.moveTo(px, py);
  }
  c.closePath(); c.fill(); c.restore();
}
function drawUnitSprite(c, u, t) {
  if (!STATS[u.kind]) { drawPortraitBuilding(c, u.kind, u.team); return; }
  const team = TEAM[u.team], st = STATS[u.kind];  const walk = u.moving ? Math.sin(u.walk + u.bob) : 0;
  const bob = u.moving ? Math.abs(Math.sin(u.walk + u.bob)) * -1.2 : Math.sin(t * 2 + u.bob) * .45;
  c.save();
  c.fillStyle = 'rgba(26,21,16,.34)';
  c.beginPath(); c.ellipse(u.kind === 'piche' ? 2 : 0, 1.5, u.kind === 'piche' ? 20 : 9.5, u.kind === 'piche' ? 7.5 : 4.2, 0, 0, TAU); c.fill();
  c.translate(0, bob); c.scale(u.face, 1);

  if (u.kind === 'tirador') {
    c.strokeStyle = '#241d16'; c.lineWidth = 3.2; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-3, 0); c.lineTo(-4 - walk * 2.2, -9); c.stroke();
    c.beginPath(); c.moveTo(3, 0); c.lineTo(4 + walk * 2.2, -9); c.stroke();
    c.fillStyle = '#3a3127'; c.fillRect(-8.5, -19, 4.5, 7);
    c.fillStyle = u.team === 'player' ? '#8a5f38' : '#74433a';
    c.beginPath(); c.moveTo(-6, -9); c.lineTo(-5.5, -20); c.lineTo(1, -22); c.lineTo(6, -19); c.lineTo(6, -9); c.closePath(); c.fill();
    c.strokeStyle = '#241d16'; c.lineWidth = 1.2; c.stroke();
    c.fillStyle = team.main; c.fillRect(-5, -19, 10, 2.4);
    c.fillStyle = team.accent; c.fillRect(-5, -16, 3, 1.6);
    c.fillStyle = '#c99a70'; c.beginPath(); c.arc(1, -24, 4.1, 0, TAU); c.fill();
    c.fillStyle = team.main; c.beginPath(); c.arc(1, -25.4, 4.4, Math.PI, TAU); c.fill();
    c.fillStyle = '#3a3127'; c.fillRect(-2.5, -25, 7, 1.4);
    c.strokeStyle = '#2b2620'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(1, -17); c.lineTo(12, -16.2); c.stroke();
    c.strokeStyle = '#6e5a41'; c.lineWidth = 1; c.beginPath(); c.moveTo(11, -16); c.lineTo(16, -15.6); c.stroke();
    c.fillStyle = '#241d16'; c.fillRect(3, -17.5, 4, 2);
    if (u.recoil > 0) drawMuzzle(c, 17, -15.6, 4.5);
  } else if (u.kind === 'lanzachatarra') {
    c.strokeStyle = '#241d16'; c.lineWidth = 3.6; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-4, 0); c.lineTo(-5 - walk * 2, -8); c.stroke();
    c.beginPath(); c.moveTo(4, 0); c.lineTo(5 + walk * 2, -8); c.stroke();
    c.fillStyle = u.team === 'player' ? '#7c5734' : '#673c33';
    c.beginPath(); c.moveTo(-8, -8); c.lineTo(-7, -20); c.lineTo(0, -23); c.lineTo(7, -20); c.lineTo(8, -8); c.closePath(); c.fill();
    c.strokeStyle = '#211b15'; c.lineWidth = 1.2; c.stroke();
    c.fillStyle = '#4a4134'; c.fillRect(-9, -18, 4, 8);
    c.fillStyle = team.main; c.fillRect(-8, -21, 16, 2.6);
    c.fillStyle = '#c99a70'; c.beginPath(); c.arc(1.5, -25, 4.2, 0, TAU); c.fill();
    c.fillStyle = '#4a4033'; c.beginPath(); c.arc(1.5, -26.4, 4.4, Math.PI, TAU); c.fill();
    c.save(); c.translate(0, -19); c.rotate(-.15);
    c.fillStyle = '#4a463b'; c.fillRect(-7, -4, 21, 4.5);
    c.fillStyle = '#6e6a58'; c.fillRect(10, -4.2, 5, 5);
    c.fillStyle = '#c2553a'; c.fillRect(14, -4.4, 3, 5.4);
    c.restore();
    c.fillStyle = '#d0a15f'; c.fillRect(4, -12, 2, 3);
    if (u.recoil > 0) drawMuzzle(c, 18, -22, 5);
  } else if (u.kind === 'mecanico') {
    c.strokeStyle = '#241d16'; c.lineWidth = 3; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-3, 0); c.lineTo(-4 - walk * 2, -8); c.stroke();
    c.beginPath(); c.moveTo(3, 0); c.lineTo(4 + walk * 2, -8); c.stroke();
    c.fillStyle = '#375f5c'; c.fillRect(-6, -19, 12, 11);
    c.fillStyle = '#d6a648'; c.fillRect(-5.5, -21, 11, 2.4);
    c.fillStyle = '#c99a70'; c.beginPath(); c.arc(1, -24, 4, 0, TAU); c.fill();
    c.fillStyle = '#d7b04e'; c.beginPath(); c.arc(1, -25.8, 4.4, Math.PI, TAU); c.fill();
    c.fillStyle = '#d7b04e'; c.fillRect(-3.5, -26, 9, 1.4);
    c.strokeStyle = '#b9b2a0'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(7, -16); c.lineTo(12, -12); c.stroke();
    c.beginPath(); c.arc(13, -11, 2.4, .4, 4.2); c.stroke();
    c.fillStyle = '#7a6a50'; c.fillRect(-8, -16, 3, 6);
  } else if (u.kind === 'mutil') {
    c.strokeStyle = '#2b2c1c'; c.lineWidth = 3.4; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-4, 0); c.lineTo(-7 - walk * 2, -8); c.stroke();
    c.beginPath(); c.moveTo(4, 0); c.lineTo(6 + walk * 2, -8); c.stroke();
    c.fillStyle = '#6d6a42'; c.beginPath(); c.moveTo(-7, -9); c.lineTo(-6, -19); c.lineTo(3, -22); c.lineTo(8, -17); c.lineTo(6, -8); c.closePath(); c.fill();
    c.strokeStyle = '#302f20'; c.lineWidth = 1.2; c.stroke();
    c.fillStyle = '#827d4c'; c.beginPath(); c.arc(3, -24, 4.5, 0, TAU); c.fill();
    c.fillStyle = '#d8c9a0'; c.beginPath(); c.moveTo(-1, -27); c.lineTo(1, -32); c.lineTo(3, -27); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(4, -27); c.lineTo(7, -31); c.lineTo(7, -26); c.closePath(); c.fill();
    c.fillStyle = '#e06754'; c.beginPath(); c.arc(5, -24.5, 1.1, 0, TAU); c.fill();
    c.strokeStyle = '#5e5c39'; c.lineWidth = 3.2;
    c.beginPath(); c.moveTo(3, -17); c.lineTo(11, -11); c.stroke();
    c.strokeStyle = '#d8c9a0'; c.lineWidth = 1.2;
    for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(11 + i, -11); c.lineTo(14 + i, -13 + i); c.stroke(); }
    c.fillStyle = '#5d5b38'; c.fillRect(-9, -18, 3.5, 7);
    if (u.recoil > 0) { c.strokeStyle = '#ffd9a0'; c.lineWidth = 1.5; c.beginPath(); c.arc(12, -12, 5, -.8, .8); c.stroke(); }
  } else if (u.kind === 'piche') {
    c.strokeStyle = '#2b241b'; c.lineWidth = 3.2; c.lineCap = 'round';
    const lw = walk * 2;
    c.beginPath(); c.moveTo(-12, -2); c.lineTo(-14 - lw, 1); c.stroke();
    c.beginPath(); c.moveTo(-6, -2); c.lineTo(-6 + lw, 1); c.stroke();
    c.beginPath(); c.moveTo(8, -2); c.lineTo(9 - lw, 1); c.stroke();
    c.beginPath(); c.moveTo(13, -2); c.lineTo(15 + lw, 1); c.stroke();
    c.fillStyle = '#6d4b32'; c.beginPath(); c.ellipse(-2, -10, 18, 11, 0, 0, TAU); c.fill();
    c.strokeStyle = '#2d2118'; c.lineWidth = 1.4; c.stroke();
    c.fillStyle = '#956f4a';
    for (let i = -2; i <= 2; i++) { c.beginPath(); c.ellipse(-2 + i * 6, -10, 3.5, 9, 0, 0, TAU); c.fill(); }
    c.fillStyle = '#d8c9a0';
    for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-15 + i * 7, -19); c.lineTo(-13 + i * 7, -24); c.lineTo(-10 + i * 7, -19); c.closePath(); c.fill(); }
    c.fillStyle = '#7b5639'; c.beginPath(); c.ellipse(16, -8, 7, 5.4, .15, 0, TAU); c.fill();
    c.fillStyle = '#e8dfba'; c.beginPath(); c.moveTo(21, -9); c.lineTo(24, -12); c.lineTo(22, -7); c.closePath(); c.fill();
    c.fillStyle = '#e06754'; c.beginPath(); c.arc(18, -9, 1.2, 0, TAU); c.fill();
    c.strokeStyle = '#5b412d'; c.lineWidth = 3; c.beginPath(); c.moveTo(-20, -8); c.lineTo(-26, -11); c.stroke();
    c.fillStyle = '#c9b784'; c.beginPath(); c.moveTo(-26, -11); c.lineTo(-29, -15); c.lineTo(-25, -14); c.closePath(); c.fill();
  }
  c.restore();

  if (u.maxHp && (u.selected || u.hp < u.maxHp)) {
    drawBar(c, -13, -37, 26, 3.2, u.hp / u.maxHp, u.team === 'player' ? '#8fbd68' : '#d1624f');
  }
  if (u.rank > 0 && u.maxHp) {
    c.fillStyle = '#e8c882';
    for (let i = 0; i < u.rank; i++) {
      const yy = -34 - i * 3.3;
      c.beginPath(); c.moveTo(-6, yy + 2.4); c.lineTo(-3, yy); c.lineTo(0, yy + 2.4);
      c.lineTo(-3, yy + 1.5); c.closePath(); c.fill();
    }
  }
  if (u.speechT > 0 && u.speech && u.maxHp) {
    c.save(); c.font = '700 8px "Trebuchet MS",sans-serif'; c.textAlign = 'center';
    const tw = c.measureText(u.speech).width, bw = Math.min(tw + 9, 88);
    const by = -48;
    c.fillStyle = 'rgba(25,20,15,.92)'; c.strokeStyle = '#7f6547'; c.lineWidth = .8;
    c.beginPath(); c.roundRect(-bw / 2, by - 9, bw, 13, 3); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(-3, by + 4); c.lineTo(0, by + 8); c.lineTo(3, by + 4); c.fill();
    c.fillStyle = '#f1dfbd'; c.fillText(u.speech, 0, by);
    c.restore();
  }
}
function drawPortraitBuilding(c, kind, team) {
  const t = TEAM[team] || TEAM.neutral;
  c.save(); c.translate(0, -2); c.scale(.72, .72);
  if (kind === 'refinery') {
    c.fillStyle = '#6c4a36'; c.fillRect(-30, -12, 60, 12);
    c.fillStyle = '#81553a'; c.beginPath(); c.ellipse(-12, -14, 14, 9, 0, Math.PI, TAU); c.fill(); c.fillRect(-26, -14, 28, 14);
    c.fillStyle = '#a06b43'; c.beginPath(); c.ellipse(-12, -28, 14, 5, 0, 0, TAU); c.fill();
    c.fillStyle = '#4f3a2c'; c.fillRect(15, -42, 8, 32);
    c.fillStyle = t.main; c.fillRect(-30, -38, 3, 18); c.beginPath(); c.moveTo(-27, -38); c.lineTo(-12, -34); c.lineTo(-27, -29); c.fill();
  } else if (kind === 'nest') {
    c.fillStyle = '#5c4230'; c.beginPath(); c.ellipse(0, -12, 30, 14, 0, 0, TAU); c.fill();
    c.fillStyle = '#8a5c36'; c.beginPath(); c.ellipse(0, -18, 18, 12, 0, 0, TAU); c.fill();
    c.fillStyle = '#d98a42'; c.beginPath(); c.ellipse(0, -20, 7, 8, 0, 0, TAU); c.fill();
    c.fillStyle = '#d8c9a0';
    for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(-24 + i * 11, -16); c.lineTo(-20 + i * 11, -34 - (i % 2) * 7); c.lineTo(-16 + i * 11, -16); c.closePath(); c.fill(); }
  } else if (kind === 'antenna') {
    c.strokeStyle = '#8b8574'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(-9, 0); c.lineTo(0, -40); c.lineTo(9, 0); c.stroke();
    c.beginPath(); c.moveTo(-6, -13); c.lineTo(6, -22); c.moveTo(6, -13); c.lineTo(-6, -22); c.stroke();
    c.fillStyle = '#b7ad95'; c.beginPath(); c.ellipse(0, -44, 10, 4, -.2, 0, TAU); c.fill();
    c.fillStyle = '#e06754'; c.beginPath(); c.arc(0, -50, 2.2, 0, TAU); c.fill();
  } else {
    c.strokeStyle = '#8b7752'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(-12, 0); c.lineTo(-4, -36); c.lineTo(4, -36); c.lineTo(12, 0); c.stroke();
    c.beginPath(); c.moveTo(-9, -12); c.lineTo(9, -24); c.moveTo(9, -12); c.lineTo(-9, -24); c.stroke();
    c.strokeStyle = '#6d5a3e'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -36); c.lineTo(17, -44); c.stroke();
    c.fillStyle = '#3c3328'; c.fillRect(13, -48, 8, 5);
  }
  c.restore();
}

function drawBuildingSprite(c, b, t) {
  const p = iso(b.x, b.y);
  const team = TEAM[b.team] || TEAM.neutral;
  c.save(); c.translate(p.x, p.y);
  if (b.dead) {
    c.fillStyle = 'rgba(42,35,27,.5)'; c.beginPath(); c.ellipse(0, 4, 42, 15, 0, 0, TAU); c.fill();
    c.fillStyle = '#4e4233'; c.fillRect(-28, -10, 22, 10); c.fillRect(2, -15, 26, 13);
    c.fillStyle = '#332b22'; c.fillRect(-8, -6, 15, 8);
    c.strokeStyle = '#6e5a41'; c.lineWidth = 2; c.beginPath(); c.moveTo(-20, -12); c.lineTo(-4, -30); c.stroke();
    c.restore(); return;
  }
  if (b.kind === 'refinery') {
    c.fillStyle = 'rgba(30,24,18,.38)'; c.beginPath(); c.ellipse(4, 6, 58, 19, 0, 0, TAU); c.fill();
    c.fillStyle = '#5d4937'; c.fillRect(-52, -13, 104, 17);
    c.fillStyle = '#71583f'; c.fillRect(-50, -16, 100, 5);
    // left tank
    c.fillStyle = '#85563a'; c.beginPath(); c.roundRect(-48, -47, 35, 38, 5); c.fill();
    c.fillStyle = '#a46e46'; c.beginPath(); c.ellipse(-30.5, -46, 17.5, 6, 0, 0, TAU); c.fill();
    c.strokeStyle = '#5f3d29'; c.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-46, -38 + i * 9); c.lineTo(-15, -38 + i * 9); c.stroke(); }
    c.fillStyle = '#3a2c21'; c.fillRect(-42, -42, 2, 30);
    // right tank
    c.fillStyle = '#775038'; c.beginPath(); c.roundRect(-7, -38, 26, 29, 4); c.fill();
    c.fillStyle = '#956643'; c.beginPath(); c.ellipse(6, -38, 13, 4.5, 0, 0, TAU); c.fill();
    c.strokeStyle = '#4e3526'; c.lineWidth = 1.3;
    for (let i = 0; i < 2; i++) { c.beginPath(); c.moveTo(-5, -30 + i * 9); c.lineTo(17, -30 + i * 9); c.stroke(); }
    // pipes
    c.strokeStyle = '#6f5b45'; c.lineWidth = 4;
    c.beginPath(); c.moveTo(-15, -20); c.lineTo(-8, -20); c.lineTo(-8, -30); c.stroke();
    c.beginPath(); c.moveTo(19, -22); c.lineTo(37, -22); c.lineTo(37, -10); c.stroke();
    // chimney
    c.fillStyle = '#594638'; c.fillRect(29, -78, 10, 66);
    c.fillStyle = '#77604b'; c.fillRect(27, -81, 14, 4);
    c.fillStyle = '#8d4d32'; c.fillRect(29, -66, 10, 4); c.fillRect(29, -48, 10, 3);
    // cabin
    c.fillStyle = '#604b38'; c.fillRect(-24, -32, 16, 20);
    c.fillStyle = '#28302d'; c.fillRect(-21, -29, 9, 6);
    c.fillStyle = '#b2763f'; c.fillRect(-24, -34, 16, 3);
    // flag
    c.strokeStyle = '#3a3026'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(44, -78); c.lineTo(44, -20); c.stroke();
    c.fillStyle = team.main; c.beginPath(); c.moveTo(45, -78); c.lineTo(58, -73); c.lineTo(45, -68); c.closePath(); c.fill();
    // stencil
    c.fillStyle = 'rgba(35,27,20,.72)'; c.font = '900 7px monospace'; c.fillText('O.A. 2099', -45, -30);
    c.fillStyle = 'rgba(227,170,94,.55)'; c.fillRect(-48, -18, 96, 1.5);
  } else if (b.kind === 'nest') {
    c.fillStyle = 'rgba(30,22,17,.4)'; c.beginPath(); c.ellipse(3, 6, 56, 18, 0, 0, TAU); c.fill();
    c.fillStyle = '#5b402d'; c.beginPath(); c.ellipse(0, -8, 48, 22, 0, 0, TAU); c.fill();
    c.fillStyle = '#6d4c33'; c.beginPath(); c.ellipse(-8, -17, 34, 20, -.1, 0, TAU); c.fill();
    c.fillStyle = '#815a3a'; c.beginPath(); c.ellipse(6, -26, 25, 16, .15, 0, TAU); c.fill();
    // ribs
    c.strokeStyle = '#3e2b20'; c.lineWidth = 3;
    for (let i = -2; i <= 2; i++) {
      c.beginPath(); c.moveTo(i * 13 - 6, -8); c.quadraticCurveTo(i * 12, -30, i * 10 + 3, -38); c.stroke();
    }
    // glowing sac
    const pulse = .5 + Math.sin(t * 2.4 + b.pulse) * .5;
    c.fillStyle = `rgba(226,126,55,${.55 + pulse * .4})`;
    c.beginPath(); c.ellipse(5, -26, 9 + pulse * 2, 11 + pulse * 2, .1, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,214,138,.6)'; c.beginPath(); c.ellipse(4, -28, 4, 5, 0, 0, TAU); c.fill();
    // spikes
    c.fillStyle = '#d3c49a';
    for (let i = 0; i < 9; i++) {
      const a = .2 + i / 9 * 2.3, x = Math.cos(a) * 44, y = -10 - Math.sin(a) * 20;
      c.beginPath(); c.moveTo(x - 5, y + 3); c.lineTo(x, y - 12 - (i % 3) * 4); c.lineTo(x + 5, y + 3); c.closePath(); c.fill();
    }
    // bones
    c.strokeStyle = '#cabf9d'; c.lineWidth = 2.2;
    c.beginPath(); c.moveTo(-38, -2); c.lineTo(-17, -8); c.stroke();
    c.beginPath(); c.arc(-38, -1, 3, 0, TAU); c.stroke();
    c.fillStyle = '#3e2b20'; c.beginPath(); c.arc(0, -12, 4, 0, TAU); c.fill();
  } else if (b.kind === 'derrick') {
    c.fillStyle = 'rgba(30,24,18,.34)'; c.beginPath(); c.ellipse(0, 3, 29, 10, 0, 0, TAU); c.fill();
    c.fillStyle = '#5c4b38'; c.fillRect(-24, -6, 48, 8);
    c.fillStyle = '#3c332a'; c.fillRect(-10, -7, 20, 7);
    c.strokeStyle = '#7d6948'; c.lineWidth = 2.4;
    c.beginPath(); c.moveTo(-15, 0); c.lineTo(-6, -47); c.lineTo(6, -47); c.lineTo(15, 0); c.stroke();
    c.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) {
      const y1 = -i * 11, y2 = -(i + 1) * 11, w1 = 15 - i * 2.4, w2 = 15 - (i + 1) * 2.4;
      c.beginPath(); c.moveTo(-w1, y1); c.lineTo(w2, y2); c.moveTo(w1, y1); c.lineTo(-w2, y2); c.stroke();
    }
    c.fillStyle = '#4f4234'; c.fillRect(-10, -52, 20, 6);
    const ang = Math.sin(t * 1.65 + b.pulse) * .28;
    c.save(); c.translate(1, -47); c.rotate(ang);
    c.strokeStyle = '#9a8458'; c.lineWidth = 3.2;
    c.beginPath(); c.moveTo(-5, 0); c.lineTo(38, -3); c.stroke();
    c.fillStyle = '#7b6545'; c.fillRect(32, -9, 7, 9);
    c.fillStyle = '#3c332a'; c.fillRect(-13, -4, 10, 6);
    c.restore();
    c.strokeStyle = '#4a3f31'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(0, -52); c.lineTo(0, -18); c.stroke();
    c.strokeStyle = '#3a3026'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(22, -14); c.lineTo(22, -3); c.stroke();
    c.fillStyle = team.main; c.beginPath(); c.moveTo(23, -14); c.lineTo(33, -11); c.lineTo(23, -8); c.closePath(); c.fill();
    c.fillStyle = '#5b4a34'; c.beginPath(); c.ellipse(-23, -5, 5.5, 7, 0, 0, TAU); c.fill();
    c.fillStyle = '#87643c'; c.beginPath(); c.ellipse(-23, -12, 5.5, 1.6, 0, 0, TAU); c.fill();
  } else if (b.kind === 'antenna') {
    c.fillStyle = 'rgba(30,24,18,.34)'; c.beginPath(); c.ellipse(0, 3, 27, 9, 0, 0, TAU); c.fill();
    c.fillStyle = '#59605b'; c.fillRect(-20, -6, 40, 9);
    c.fillStyle = '#3d423f'; c.fillRect(-13, -9, 26, 4);
    c.strokeStyle = '#8b8b7b'; c.lineWidth = 2.6;
    c.beginPath(); c.moveTo(-10, 0); c.lineTo(-2, -66); c.lineTo(2, -66); c.lineTo(10, 0); c.stroke();
    c.lineWidth = 1.2;
    for (let i = 0; i < 5; i++) {
      const y1 = -i * 13, y2 = -(i + 1) * 13, w1 = 10 - i * 1.7, w2 = 10 - (i + 1) * 1.7;
      c.beginPath(); c.moveTo(-w1, y1); c.lineTo(w2, y2); c.moveTo(w1, y1); c.lineTo(-w2, y2); c.stroke();
    }
    c.fillStyle = '#aaa798'; c.beginPath(); c.ellipse(0, -65, 12, 4.5, -.15, 0, TAU); c.fill();
    c.fillStyle = '#c7c2ac'; c.beginPath(); c.ellipse(3, -71, 7, 10, -.5, 0, TAU); c.fill();
    c.fillStyle = '#68695f'; c.beginPath(); c.arc(3, -71, 2.4, 0, TAU); c.fill();
    const blink = (t * 1.4) % 1 < .18;
    c.fillStyle = blink ? '#ff7a5c' : '#7a3f34'; c.beginPath(); c.arc(0, -77, 2.2, 0, TAU); c.fill();
    if (blink) { c.fillStyle = 'rgba(255,111,80,.22)'; c.beginPath(); c.arc(0, -77, 7, 0, TAU); c.fill(); }
    // capture arc
    c.strokeStyle = 'rgba(20,17,13,.55)'; c.lineWidth = 4;
    c.beginPath(); c.ellipse(0, 2, 22, 10, 0, 0, TAU); c.stroke();
    if (Math.abs(b.capture) > .01) {
      c.strokeStyle = b.team === 'player' ? TEAM.player.accent : b.team === 'enemy' ? TEAM.enemy.main : '#d8c9a0';
      c.lineWidth = 3.5; c.beginPath();
      c.ellipse(0, 2, 22, 10, 0, -Math.PI / 2, -Math.PI / 2 + TAU * Math.abs(b.capture), b.capture < 0);
      c.stroke();
    }
    // marker
    const my = -98 + Math.sin(t * 2 + b.pulse) * 2;
    c.fillStyle = b.team === 'player' ? TEAM.player.main : b.team === 'enemy' ? TEAM.enemy.main : '#d8c9a0';
    c.beginPath(); c.moveTo(0, my); c.lineTo(6, my + 6); c.lineTo(0, my + 12); c.lineTo(-6, my + 6); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(20,17,13,.7)'; c.lineWidth = 1; c.stroke();
  }
  if (b.selected || b.hp < b.maxHp) {
    const yy = b.kind === 'refinery' ? -92 : b.kind === 'nest' ? -58 : b.kind === 'derrick' ? -64 : -90;
    drawBar(c, -25, yy, 50, 4, b.hp / b.maxHp, b.team === 'player' ? '#8fbd68' : b.team === 'enemy' ? '#d1624f' : '#c9bf9e');
  }
  if (b.selected) {
    c.strokeStyle = '#9fe8da'; c.lineWidth = 1.3; c.setLineDash([5, 4]);
    c.beginPath(); c.ellipse(0, 2, 30, 13, 0, 0, TAU); c.stroke(); c.setLineDash([]);
  }
  c.restore();
}

function drawScrapSprite(c, s, t) {
  const p = iso(s.x, s.y), bob = Math.sin(t * 2 + s.bob) * 1.2;
  c.save(); c.translate(p.x, p.y + bob);
  c.fillStyle = 'rgba(28,23,17,.3)'; c.beginPath(); c.ellipse(0, 2, 9, 4, 0, 0, TAU); c.fill();
  c.fillStyle = '#6f5a3d'; c.fillRect(-7, -5, 10, 4);
  c.fillStyle = '#8d7148'; c.fillRect(1, -8, 6, 5);
  c.fillStyle = '#c7b37a'; c.fillRect(-2, -9, 4, 2);
  c.fillStyle = 'rgba(116,211,193,.55)'; c.fillRect(4, -4, 2, 2);
  c.restore();
}

function drawSelectionRing(c, x, y, rx, ry, color, t) {
  c.save();
  c.globalAlpha = .12; c.fillStyle = color;
  c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill(); c.globalAlpha = 1;
  c.strokeStyle = color; c.lineWidth = 1.5; c.setLineDash([5, 4]); c.lineDashOffset = -t * 16;
  c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.stroke();
  c.setLineDash([]); c.restore();
}
function drawRally(c, t) {
  if (!base()) return;
  const p = iso(G.baseRally.x, G.baseRally.y);
  const pulse = .5 + Math.sin(t * 3) * .5;
  c.strokeStyle = `rgba(116,211,193,${.15 + pulse * .22})`; c.lineWidth = 1.2;
  c.beginPath(); c.ellipse(p.x, p.y, 10 + pulse * 5, 5 + pulse * 2.5, 0, 0, TAU); c.stroke();
  c.strokeStyle = '#3a3026'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x, p.y - 19); c.stroke();
  c.fillStyle = TEAM.player.accent; c.beginPath(); c.moveTo(p.x + 1, p.y - 19); c.lineTo(p.x + 11, p.y - 15.5); c.lineTo(p.x + 1, p.y - 12); c.closePath(); c.fill();
  if (G.selBuilding && G.selBuilding.kind === 'refinery') {
    const b = iso(G.selBuilding.x, G.selBuilding.y);
    c.strokeStyle = 'rgba(116,211,193,.3)'; c.lineWidth = 1; c.setLineDash([3, 5]);
    c.beginPath(); c.moveTo(b.x, b.y); c.lineTo(p.x, p.y); c.stroke(); c.setLineDash([]);
  }
}
function drawDecals(c) {
  for (const d of decals) {
    c.fillStyle = d.color; c.beginPath(); c.ellipse(d.x, d.y, d.r, d.r * .45, 0, 0, TAU); c.fill();
    c.fillStyle = 'rgba(30,24,18,.22)'; c.beginPath(); c.ellipse(d.x + 4, d.y - 1, d.r * .55, d.r * .24, 0, 0, TAU); c.fill();
  }
}
function drawEffects(c) {
  for (const e of effects) {
    const a = clamp(e.life / e.max, 0, 1);
    if (e.type === 'tracer') {
      c.save(); c.globalAlpha = a; c.strokeStyle = e.color; c.lineWidth = 1.7; c.shadowColor = e.color; c.shadowBlur = 7;
      c.beginPath(); c.moveTo(e.x1, e.y1); c.lineTo(e.x2, e.y2); c.stroke();
      c.strokeStyle = '#fff3cf'; c.lineWidth = .7; c.beginPath(); c.moveTo(e.x1, e.y1); c.lineTo(e.x2, e.y2); c.stroke();
      c.restore();
    } else if (e.type === 'slash') {
      c.save(); c.globalAlpha = a; c.strokeStyle = e.color; c.lineWidth = 2.2; c.shadowColor = e.color; c.shadowBlur = 5;
      c.beginPath(); c.arc(e.x1, e.y1, 12, -.9, .9); c.stroke(); c.restore();
    } else {
      c.save(); c.globalAlpha = e.smoke ? .8 : a;
      c.fillStyle = e.color; c.beginPath(); c.arc(e.x, e.y, Math.max(.2, e.size * (e.smoke ? 1 : (.4 + a * .6))), 0, TAU); c.fill(); c.restore();
    }
  }
}
function drawTexts(c) {
  for (const t of texts) {
    const a = clamp(t.life / t.max, 0, 1);
    c.save(); c.globalAlpha = a; c.font = '900 8px monospace'; c.textAlign = 'center';
    c.lineWidth = 3; c.strokeStyle = 'rgba(22,17,12,.8)'; c.strokeText(t.text, t.x, t.y);
    c.fillStyle = t.color; c.fillText(t.text, t.x, t.y); c.restore();
  }
}
function drawBackdrop(t) {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#6c8c83'); sky.addColorStop(.34, '#9fa486'); sky.addColorStop(.66, '#b18c5f'); sky.addColorStop(1, '#6e5136');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  const sun = ctx.createRadialGradient(W * .24, H * .14, 4, W * .24, H * .14, Math.max(W, H) * .5);
  sun.addColorStop(0, 'rgba(255,225,170,.34)'); sun.addColorStop(.35, 'rgba(238,186,112,.1)'); sun.addColorStop(1, 'rgba(238,186,112,0)');
  ctx.fillStyle = sun; ctx.fillRect(0, 0, W, H);
  const shift = -(G.cam.x / MAP.pw - .5) * 70;
  // distant mesas
  const layers = [
    { y: H * .27, h: 66, col: 'rgba(91,84,65,.42)', m: .55 },
    { y: H * .31, h: 48, col: 'rgba(112,97,70,.46)', m: .8 },
    { y: H * .35, h: 32, col: 'rgba(133,111,76,.42)', m: 1.1 }
  ];
  for (const L of layers) {
    ctx.fillStyle = L.col; ctx.beginPath(); ctx.moveTo(-40, L.y + L.h);
    for (let x = -40; x <= W + 40; x += 42) {
      const k = (x + shift * L.m) * .013;
      const y = L.y - (Math.sin(k) * .5 + .5) * L.h * .8 - Math.sin(k * .37 + 2) * L.h * .35;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W + 40, H); ctx.lineTo(-40, H); ctx.closePath(); ctx.fill();
  }
  // distant wind turbines
  for (let i = 0; i < 3; i++) {
    const x = (i * .31 + .16) * W + shift * .35, y = H * .31 - i * 9;
    const s = .7 + i * .12;
    ctx.strokeStyle = 'rgba(64,61,52,.48)'; ctx.lineWidth = 1.4 * s;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 36 * s); ctx.stroke();
    ctx.save(); ctx.translate(x, y); ctx.rotate(t * .55 + i * 1.7);
    for (let k = 0; k < 3; k++) {
      ctx.rotate(TAU / 3); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -18 * s); ctx.stroke();
    }
    ctx.restore();
  }
}
function drawWind(t) {
  ctx.save();
  for (let i = 0; i < 18; i++) {
    const speed = 26 + (i % 4) * 13;
    const x = ((i * 149 + t * speed) % (W + 240)) - 120;
    const y = (i * 71 + (i % 3) * 23) % (H * .82) + 20;
    const len = 24 + (i % 5) * 13;
    ctx.strokeStyle = `rgba(244,229,189,${.035 + (i % 3) * .014})`;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + len * .5, y - 2, x + len, y); ctx.stroke();
    if (i % 7 === 0) {
      ctx.fillStyle = 'rgba(240,222,176,.07)'; ctx.beginPath(); ctx.arc(x + len * .6, y - 5, 1.4, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
}
function renderMini(t) {
  if (!miniBg) return;
  mctx.clearRect(0, 0, 240, 120);
  mctx.drawImage(miniBg, 0, 0);
  const sx = 240 / MAP.pw, sy = 120 / MAP.ph;
  for (const b of buildings) {
    if (b.dead) continue;
    const x = iso(b.x, b.y).x * sx, y = iso(b.x, b.y).y * sy;
    const col = b.team === 'player' ? '#e9b65a' : b.team === 'enemy' ? '#d26a5c' : '#d8cdaa';
    mctx.fillStyle = col;
    const s = b.kind === 'nest' || b.kind === 'refinery' ? 6 : 4;
    mctx.fillRect(x - s / 2, y - s / 2, s, s);
    if (b.kind === 'antenna') { mctx.strokeStyle = col; mctx.lineWidth = 1; mctx.beginPath(); mctx.arc(x, y, 5, 0, TAU); mctx.stroke(); }
  }
  for (const u of units) {
    if (u.dead) continue;
    mctx.fillStyle = u.team === 'player' ? '#f0d08a' : '#e28a76';
    mctx.fillRect(iso(u.x, u.y).x * sx - 1, iso(u.x, u.y).y * sy - 1, 2.5, 2.5);
  }
  const tl = screenToWorld(0, 0), br = screenToWorld(W, H);
  mctx.strokeStyle = 'rgba(174,241,226,.9)'; mctx.lineWidth = 1.4;
  mctx.strokeRect(clamp(tl.x * 240 / MAP.pw, 0, 238), clamp(tl.y * 120 / MAP.ph, 0, 118),
    clamp((br.x - tl.x) * 240 / MAP.pw, 4, 238), clamp((br.y - tl.y) * 120 / MAP.ph, 4, 118));
  const n = nest();
  if (n) {
    const nx = iso(n.x, n.y).x * sx, ny = iso(n.x, n.y).y * sy;
    const pulse = .35 + Math.sin(t * 3.4) * .28;
    mctx.strokeStyle = `rgba(230,110,86,${pulse})`; mctx.lineWidth = 1.6;
    mctx.beginPath(); mctx.arc(nx, ny, 7 + Math.sin(t * 3.4) * 1.6, 0, TAU); mctx.stroke();
  }
  const l = G.lastAlertPos;
  if (l && G.alertCool > 0) {
    mctx.strokeStyle = `rgba(255,110,80,${.4 + Math.sin(t * 8) * .4})`; mctx.lineWidth = 2;
    mctx.strokeRect(iso(l.x, l.y).x * sx - 4, iso(l.x, l.y).y * sy - 4, 8, 8);
  }
}

function render(t) {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  drawBackdrop(t);
  ctx.save();
  ctx.translate(VIEW.ax, VIEW.ay); ctx.scale(G.cam.z, G.cam.z); ctx.translate(-G.cam.x, -G.cam.y);
  ctx.drawImage(terrainC, 0, 0);
  drawDecals(ctx);
  for (const p of pings) {
    const k = clamp(p.t / .75, 0, 1);
    ctx.strokeStyle = p.color; ctx.globalAlpha = (1 - k) * .8; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(p.x, p.y, 7 + k * 34, 3.5 + k * 17, 0, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  drawRally(ctx, t);
  for (const u of units) {
    if (!u.dead && u.selected) drawSelectionRing(ctx, iso(u.x, u.y).x, iso(u.x, u.y).y, 16, 7.5, TEAM.player.accent, t);
  }
  for (const b of buildings) {
    if (!b.dead && b.selected) drawSelectionRing(ctx, iso(b.x, b.y).x, iso(b.x, b.y).y, BSTATS[b.kind].hit * .55, BSTATS[b.kind].hit * .27, TEAM.player.accent, t);
  }
  const list = [];
  for (const b of buildings) {
    const p = iso(b.x, b.y);
    list.push({ y: p.y + (b.kind === 'refinery' ? 12 : 6), f: () => drawBuildingSprite(ctx, b, t) });
  }
  for (const u of units) {
    if (u.dead) continue;
    list.push({ y: iso(u.x, u.y).y, f: () => {
      const p = iso(u.x, u.y);
      ctx.save(); ctx.translate(p.x, p.y); drawUnitSprite(ctx, u, t); ctx.restore();
    } });
  }
  for (const s of scraps) {
    list.push({ y: iso(s.x, s.y).y + 2, f: () => drawScrapSprite(ctx, s, t) });
  }
  list.sort((a, b) => a.y - b.y);
  for (const item of list) item.f();
  drawEffects(ctx);
  drawTexts(ctx);
  ctx.restore();

  drawWind(t);
  if (dragBox) {
    const x = Math.min(dragBox.x0, dragBox.x), y = Math.min(dragBox.y0, dragBox.y);
    const w = Math.abs(dragBox.x - dragBox.x0), h = Math.abs(dragBox.y - dragBox.y0);
    ctx.fillStyle = 'rgba(116,211,193,.09)'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#9fe8da'; ctx.lineWidth = 1.4; ctx.strokeRect(x, y, w, h);
    ctx.strokeStyle = '#e7fffa'; ctx.lineWidth = 2;
    const k = 7; ctx.beginPath();
    ctx.moveTo(x, y + k); ctx.lineTo(x, y); ctx.lineTo(x + k, y);
    ctx.moveTo(x + w - k, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + k);
    ctx.moveTo(x, y + h - k); ctx.lineTo(x, y + h); ctx.lineTo(x + k, y + h);
    ctx.moveTo(x + w - k, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - k);
    ctx.stroke();
  }
  renderMini(t);
}

/* ---------- loop ---------- */
function applyKeys(dt) {
  const sp = 430 * dt / G.cam.z;
  let dx = 0, dy = 0;
  if (keys.has('arrowleft')) dx -= sp;
  if (keys.has('arrowright')) dx += sp;
  if (keys.has('arrowup')) dy -= sp;
  if (keys.has('arrowdown')) dy += sp;
  if (dx || dy) { G.cam.x += dx; G.cam.y += dy; clampCam(); }
}
let lastFrame = performance.now();
function frame(now) {
  const raw = Math.min(.05, Math.max(0, (now - lastFrame) / 1000)); lastFrame = now;
  if (G.state === 'playing') {
    applyKeys(raw); update(raw);
  } else if (G.state === 'over') {
    updateEffects(raw * .6);
  } else if (G.state === 'menu') {
    G.time += raw * .35; updateEffects(raw * .4);
    G.cam.x = G.menuHome.x + Math.sin(G.time * .1) * 17;
    G.cam.y = G.menuHome.y + Math.cos(G.time * .08) * 11;
    clampCam();
  }
  render(G.time);
  G.hudT += raw;
  if (G.hudT > .12) {
    G.hudT = 0; updateHUD();
    if (G.state === 'playing' && G.queue.length) renderDock();
  }
  requestAnimationFrame(frame);
}

/* ---------- boot ---------- */
buildTerrain();
initWorld();
resize();
focusBase();
G.menuHome = { x:G.cam.x, y:G.cam.y };
document.body.classList.add('menu');
try {
  if (localStorage.getItem('oxido-mute') === '1') setMuted(true);
} catch (e) {}
renderDock(true);
updateHUD();
render(G.time);
requestAnimationFrame(frame);
if (new URL(location.href).searchParams.get('play') === '1') setTimeout(startGame, 260);

window.OXIDO = {
  G, units, buildings, scraps, terrain: terrainC,
  start: startGame,
  selectAll: () => selectUnits(playerUnits().map(u => u.id)),
  screenOf: e => { const p = iso(e.x, e.y); return worldToScreen(p.x, p.y); },
  unit: kind => units.find(u => u.kind === kind && u.team === 'player'),
  base, nest,
  make, spawnWave, setPaused,
  forceWin: () => { const n = nest(); if (n) killEntity(n, { team:'player', id:-9 }); },
  click: (x, y) => handleTap(x, y)
};
})();
