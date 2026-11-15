import * as THREE from 'three';
import './style.css';

const $ = (id) => document.getElementById(id);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#a7b5a8');
scene.fog = new THREE.FogExp2('#a7b5a8', 0.0095);
const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, .1, 180);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
document.querySelector('#game').appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight('#d8e6d3', '#454638', 2.15));
const sun = new THREE.DirectionalLight('#ffe3b0', 3.2);
sun.position.set(-16, 25, 12); sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -34; sun.shadow.camera.right = 34; sun.shadow.camera.top = 34; sun.shadow.camera.bottom = -34;
sun.shadow.bias = -.0005; scene.add(sun);
const fill = new THREE.DirectionalLight('#a2c8ce', 1.1); fill.position.set(13, 9, -18); scene.add(fill);
const clock = new THREE.Clock();
const mat = (color, roughness = .86, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
const mats = {
  grass: mat('#687653'), grass2: mat('#798260'), stone: mat('#77796b'), darkStone: mat('#454a43'), bark: mat('#51483a'), leaf: mat('#52664c'), leaf2: mat('#697657'),
  gold: mat('#d5b66e', .42, { metalness: .48 }), robe: mat('#344b47'), trim: mat('#ba9a5d', .46, { metalness: .35 }), skin: mat('#d5b68f'), steel: mat('#b8c2b9', .36, { metalness: .7 }),
  enemy: mat('#344444', .38, { emissive: '#102424', emissiveIntensity: .65 }), enemyLight: mat('#a8e8d8', .28, { emissive: '#56cbb4', emissiveIntensity: 2.5 }), crystal: mat('#75ead9', .24, { emissive: '#28bba7', emissiveIntensity: 2.1 }),
  portal: mat('#82e6d2', .25, { emissive: '#40d4bd', emissiveIntensity: 2.8, transparent: true, opacity: .8 }),
};
const ground = new THREE.Mesh(new THREE.PlaneGeometry(170, 170), mats.grass);
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
const world = new THREE.Group(); scene.add(world);
const rand = (() => { let s = 48621; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })();
const addMesh = (parent, geometry, material, pos, scale, cast = true) => {
  const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...pos); if (scale) mesh.scale.set(...scale); mesh.castShadow = cast; mesh.receiveShadow = true; parent.add(mesh); return mesh;
};
function makeTree(x, z, size = 1) {
  const g = new THREE.Group(); g.position.set(x, 0, z); world.add(g);
  addMesh(g, new THREE.CylinderGeometry(.22 * size, .38 * size, 2.7 * size, 7), mats.bark, [0, 1.15 * size, 0], null);
  for (let i = 0; i < 3; i++) {
    const r = (1.35 - i * .29) * size, y = (2.5 + i * .94) * size;
    const crown = addMesh(g, new THREE.IcosahedronGeometry(r, 1), i === 1 ? mats.leaf2 : mats.leaf, [0, y, 0], [1, 1.25, 1]);
    crown.rotation.y = rand() * 3;
  }
  return g;
}
function makeRock(x, z, size = 1, material = mats.stone) {
  const rock = addMesh(world, new THREE.DodecahedronGeometry(size, 0), material, [x, size * .5, z], [1, .7 + rand() * .5, .82]);
  rock.rotation.set(rand() * .4, rand() * 6, rand() * .25); return rock;
}
// Soft rolling ridges, ancient stone and a ring of forest frame the playable valley.
for (let i = 0; i < 24; i++) {
  const a = i / 24 * Math.PI * 2, radius = 30 + rand() * 9, x = Math.cos(a) * radius, z = Math.sin(a) * radius;
  const hill = addMesh(world, new THREE.IcosahedronGeometry(7 + rand() * 6, 1), i % 3 ? mats.grass2 : mats.grass, [x, 1.1, z], [1.35, .55 + rand() * .35, 1.2], false);
  hill.rotation.y = rand() * 2;
}
for (let i = 0; i < 90; i++) {
  const a = rand() * Math.PI * 2, r = 20 + rand() * 31, x = Math.cos(a) * r, z = Math.sin(a) * r;
  if (Math.abs(x) < 7 && z > -12 && z < 12) continue;
  makeTree(x, z, .65 + rand() * .85);
}
for (let i = 0; i < 85; i++) {
  const x = (rand() - .5) * 55, z = (rand() - .5) * 55;
  if (Math.abs(x) < 8 && Math.abs(z) < 14) continue;
  if (Math.hypot(x, z) > 31) continue;
  makeRock(x, z, .25 + rand() * .7, i % 4 === 0 ? mats.darkStone : mats.stone);
}
// Ruined paving, etched stones and the distant gate.
for (let row = 0; row < 8; row++) {
  for (let col = -1; col <= 1; col++) {
    const x = col * 1.32 + (rand() - .5) * .16;
    const z = -1.5 - row * 2.15 + (rand() - .5) * .18;
    const tile = addMesh(world, new THREE.BoxGeometry(1.18 + rand() * .12, .13, 1.72 + rand() * .12), (row + col) % 4 ? mats.darkStone : mats.stone, [x, .04, z]);
    tile.rotation.y = (rand() - .5) * .08;
  }
}
const portalGroup = new THREE.Group(); portalGroup.position.set(0, 0, -22); world.add(portalGroup);
const archMat = mat('#626659', .72);
for (const x of [-3.35, 3.35]) {
  addMesh(portalGroup, new THREE.BoxGeometry(.78, 6.4, .9), archMat, [x, 3.2, 0]);
  addMesh(portalGroup, new THREE.BoxGeometry(1.2, .38, 1.35), mats.gold, [x, 6.48, 0]);
  addMesh(portalGroup, new THREE.BoxGeometry(.98, .28, 1.1), mats.darkStone, [x, .18, 0]);
}
const archTop = addMesh(portalGroup, new THREE.TorusGeometry(3.35, .47, 8, 24, Math.PI), archMat, [0, 6.35, 0]);
archTop.rotation.z = Math.PI;
const portalInner = new THREE.Mesh(new THREE.CircleGeometry(2.85, 32), mats.portal);
portalInner.position.set(0, 3.12, -.18); portalInner.scale.y = 1.05; portalGroup.add(portalInner);
const portalRim = new THREE.Mesh(new THREE.TorusGeometry(2.85, .075, 8, 48, Math.PI), mats.gold);
portalRim.rotation.z = Math.PI; portalRim.position.set(0, 6.25, -.1); portalGroup.add(portalRim);
for (let i = 0; i < 3; i++) {
  const rune = addMesh(portalGroup, new THREE.OctahedronGeometry(.28 - i * .04), mats.crystal, [0, 1 + i * 1.7, .35]);
  rune.rotation.x = .3;
}
const portalLight = new THREE.PointLight('#55dfcb', 3.2, 15); portalLight.position.set(0, 3.5, 1.2); portalGroup.add(portalLight);
const portalRuneRing = new THREE.Mesh(new THREE.TorusGeometry(4.5, .045, 6, 48), mats.gold); portalRuneRing.rotation.x = -Math.PI / 2; portalRuneRing.position.y = .12; portalGroup.add(portalRuneRing);
// Hero, an armored wanderer with a luminous sword and a wind-swept cloak.
const player = new THREE.Group(); scene.add(player); player.position.set(0, 0, 10);
const hero = new THREE.Group(); player.add(hero);
addMesh(hero, new THREE.CylinderGeometry(.38, .56, .28, 8), mats.darkStone, [0, .15, 0]);
addMesh(hero, new THREE.ConeGeometry(.43, .48, 8), mats.robe, [0, .52, 0]);
addMesh(hero, new THREE.CylinderGeometry(.32, .43, .68, 8), mats.robe, [0, 1.04, 0]);
addMesh(hero, new THREE.BoxGeometry(.67, .12, .12), mats.trim, [0, .83, -.28]);
addMesh(hero, new THREE.SphereGeometry(.27, 12, 10), mats.skin, [0, 1.56, 0]);
const hood = addMesh(hero, new THREE.SphereGeometry(.31, 10, 8, 0, Math.PI * 2, 0, Math.PI * .58), mats.darkStone, [0, 1.63, -.015]);
hood.scale.set(1.08, 1, 1.08);
addMesh(hero, new THREE.BoxGeometry(.28, .075, .12), mats.gold, [0, 1.53, .24]);
const eyeMat = new THREE.MeshStandardMaterial({ color: '#b3f6e8', emissive: '#64e9d1', emissiveIntensity: 2 });
for (const x of [-.095, .095]) addMesh(hero, new THREE.SphereGeometry(.035, 8, 8), eyeMat, [x, 1.58, .26]);
for (const side of [-1, 1]) {
  addMesh(hero, new THREE.SphereGeometry(.21, 8, 8), mats.steel, [side * .46, 1.08, 0], [1, .85, .8]);
  addMesh(hero, new THREE.CylinderGeometry(.105, .13, .52, 7), mats.robe, [side * .52, .72, .02], null).rotation.z = side * -.14;
  addMesh(hero, new THREE.SphereGeometry(.14, 8, 8), mats.skin, [side * .54, .43, .1]);
  addMesh(hero, new THREE.CylinderGeometry(.14, .18, .52, 7), mats.darkStone, [side * .18, .17, 0]);
  addMesh(hero, new THREE.BoxGeometry(.31, .12, .44), mats.steel, [side * .18, .05, .08]);
}
const swordPivot = new THREE.Group(); swordPivot.position.set(.56, .48, .1); hero.add(swordPivot);
addMesh(swordPivot, new THREE.CylinderGeometry(.045, .055, .38, 6), mats.gold, [0, -.16, 0]);
addMesh(swordPivot, new THREE.BoxGeometry(.35, .075, .09), mats.gold, [0, .06, 0]);
const blade = addMesh(swordPivot, new THREE.ConeGeometry(.115, 1.35, 5), mats.steel, [0, .77, 0]); blade.rotation.z = Math.PI;
addMesh(swordPivot, new THREE.ConeGeometry(.1, .18, 5), mats.crystal, [0, .12, 0]).rotation.z = Math.PI;
const heroLight = new THREE.PointLight('#8be8d5', .48, 3.4); heroLight.position.set(0, 1.2, .7); hero.add(heroLight);

const relics = [];
function makeRelic(x, z, index) {
  const group = new THREE.Group(); group.position.set(x, 1, z); world.add(group);
  const crystal = addMesh(group, new THREE.OctahedronGeometry(.56, 0), mats.crystal, [0, 0, 0]); crystal.scale.y = 1.45;
  addMesh(group, new THREE.TorusGeometry(.8, .035, 6, 24), mats.gold, [0, -.55, 0]).rotation.x = Math.PI / 2;
  const light = new THREE.PointLight('#55e7d4', 1.6, 6); light.position.y = .1; group.add(light);
  const glyph = addMesh(group, new THREE.OctahedronGeometry(.12), mats.gold, [0, 1.05, 0]);
  relics.push({ group, crystal, light, glyph, index, collected: false, baseY: 1 });
}
makeRelic(-9, -3, 0); makeRelic(9, -3, 1); makeRelic(0, 16, 2);

const enemies = [];
function makeEnemy(x, z, boss = false) {
  const root = new THREE.Group(); root.position.set(x, 0, z); scene.add(root);
  const scale = boss ? 1.65 : 1;
  const bodyMat = boss ? mat('#473943', .43, { emissive: '#30151d', emissiveIntensity: .65 }) : mats.enemy;
  addMesh(root, new THREE.ConeGeometry(.7 * scale, 2.15 * scale, 7), bodyMat, [0, 1.03 * scale, 0]).rotation.x = .11;
  addMesh(root, new THREE.SphereGeometry(.39 * scale, 12, 10), bodyMat, [0, 2.03 * scale, 0]);
  const eye = boss ? mat('#ff916e', .28, { emissive: '#ff593b', emissiveIntensity: 3 }) : mats.enemyLight;
  for (const side of [-1, 1]) addMesh(root, new THREE.SphereGeometry(.075 * scale, 8, 8), eye, [side * .15 * scale, 2.1 * scale, .34 * scale]);
  for (let i = 0; i < 4; i++) {
    const wisp = addMesh(root, new THREE.ConeGeometry(.2 * scale, .65 * scale, 5), bodyMat, [(i - 1.5) * .32 * scale, .2, 0]); wisp.rotation.z = Math.PI;
  }
  const aura = new THREE.PointLight(boss ? '#ff795f' : '#73d7c6', boss ? 1.8 : .75, boss ? 9 : 5); aura.position.y = 1.4 * scale; root.add(aura);
  const enemy = { root, aura, boss, hp: boss ? 8 : 3, maxHp: boss ? 8 : 3, alive: true, phase: rand() * 8, hit: 0, attackTimer: 1.4 + rand() * 2, speed: boss ? 1.15 : 1.35, damage: boss ? 14 : 8 };
  enemies.push(enemy); return enemy;
}
makeEnemy(-6, -8); makeEnemy(7, 7); makeEnemy(13, 9); makeEnemy(-13, 8);
const boss = makeEnemy(0, -17, true); boss.root.visible = false;

const particles = [];
function burst(position, color = '#baf5df', count = 12) {
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .95 });
  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(.055 + rand() * .075, 0), material);
    mesh.position.copy(position); scene.add(mesh);
    const velocity = new THREE.Vector3((rand() - .5) * 4, rand() * 3 + .8, (rand() - .5) * 4);
    particles.push({ mesh, velocity, life: .55 + rand() * .55, maxLife: 1.1 });
  }
}
const state = { started: false, paused: false, over: false, hp: 100, shards: 0, potions: 2, attack: 0, dash: 0, invuln: 0, time: 0, kills: 0 };
const keys = new Set();
const moveInput = new THREE.Vector2();
const touchInput = new THREE.Vector2();
let toastTimer = 0, audioCtx, muted = false, joystickPointer = null;
function toast(message) {
  const el = $('toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}
function sound(freq = 440, duration = .09, type = 'sine', volume = .035) {
  if (muted) return;
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(volume, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audioCtx.currentTime + duration);
    osc.connect(gain); gain.connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime + duration);
  } catch {}
}
function updateHUD() {
  $('health-fill').style.width = `${Math.max(0, state.hp)}%`;
  $('health-text').textContent = Math.ceil(state.hp);
  $('shard-count').textContent = state.shards;
  $('progress-fill').style.width = `${state.shards / 3 * 100}%`;
  $('potion-count').textContent = `POCIÓN ×${state.potions}`;
  $('quest-hint').textContent = state.shards < 3 ? 'Recupera las reliquias del valle' : boss.alive ? 'Derrota al guardián del Umbral' : 'Acércate al portal ancestral';
  const distance = Math.round(player.position.distanceTo(portalGroup.position));
  $('portal-distance').textContent = state.shards === 3 ? `${distance} m` : 'BLOQUEADO';
}
function attack() {
  if (!state.started || state.paused || state.over || state.attack > .05) return;
  state.attack = .42; sound(240, .11, 'sawtooth', .035);
  let nearest = null, nearestDistance = 3.65;
  for (const enemy of enemies) {
    if (!enemy.alive || !enemy.root.visible) continue;
    const distance = player.position.distanceTo(enemy.root.position);
    if (distance < nearestDistance) { nearest = enemy; nearestDistance = distance; }
  }
  if (nearest) {
    nearest.hp--; nearest.hit = .2; nearest.aura.intensity = nearest.boss ? 3.5 : 2.4;
    burst(nearest.root.position.clone().add(new THREE.Vector3(0, 1.2, 0)), nearest.boss ? '#ffa17f' : '#a9f6df', 8);
    sound(nearest.boss ? 145 : 190, .12, 'triangle', .05);
    if (nearest.hp <= 0) {
      nearest.alive = false; nearest.root.visible = false; state.kills++;
      burst(nearest.root.position.clone().add(new THREE.Vector3(0, 1, 0)), nearest.boss ? '#ffd48c' : '#8be9d2', nearest.boss ? 28 : 18);
      sound(520, .32, 'sine', .055);
      if (nearest.boss) {
        $('boss-warning').classList.remove('show'); toast('El guardián ha caído. El Umbral te espera.');
      } else toast('Espectro derrotado');
    }
  }
}
function dash() {
  if (!state.started || state.paused || state.over || state.dash > 0) return;
  state.dash = .42; state.invuln = .55; sound(370, .14, 'triangle', .028);
  if (moveInput.lengthSq() > .1) player.userData.dashVector = new THREE.Vector3(moveInput.x, 0, moveInput.y).normalize();
  else player.userData.dashVector = new THREE.Vector3(0, 0, -1).applyQuaternion(player.quaternion);
}
function usePotion() {
  if (!state.started || state.paused || state.over || state.potions <= 0 || state.hp >= 100) return;
  state.potions--; state.hp = Math.min(100, state.hp + 42); updateHUD(); sound(660, .25, 'sine', .05); burst(player.position.clone().add(new THREE.Vector3(0, 1.2, 0)), '#e794ad', 14); toast('Poción utilizada · +42 salud');
}
function hurt(amount) {
  if (state.invuln > 0 || state.over) return;
  state.hp = Math.max(0, state.hp - amount); state.invuln = .6; updateHUD();
  $('damage-flash').style.opacity = '.29'; setTimeout(() => $('damage-flash').style.opacity = '0', 110);
  sound(95, .18, 'sawtooth', .045);
  if (state.hp <= 0) finish(false);
}
function finish(won) {
  state.over = true; $('end-overlay').classList.remove('hidden');
  $('end-title').innerHTML = won ? 'EL VALLE<br><span>ES LIBRE</span>' : 'LA SOMBRA<br><span>PREVALECE</span>';
  $('end-copy').textContent = won ? 'Las estrellas vuelven a brillar sobre Eldoria.' : 'El Umbral aguarda. Descansa y vuelve a intentarlo.';
}
function startGame() {
  state.started = true; state.paused = false; $('intro').classList.add('hidden'); $('pause-overlay').classList.add('hidden');
  if (innerWidth > 700) renderer.domElement.requestPointerLock?.();
}
function togglePause() {
  if (!state.started || state.over) return;
  state.paused = !state.paused; $('pause-overlay').classList.toggle('hidden', !state.paused);
  if (state.paused && document.pointerLockElement) document.exitPointerLock();
}
$('begin-btn').addEventListener('click', startGame);
$('resume-btn').addEventListener('click', togglePause);
$('restart-btn').addEventListener('click', () => location.reload());
$('attack-btn').addEventListener('click', attack); $('mobile-attack').addEventListener('pointerdown', (e) => { e.preventDefault(); attack(); });
$('dash-btn').addEventListener('click', dash); $('mobile-dash').addEventListener('pointerdown', (e) => { e.preventDefault(); dash(); }); $('potion-btn').addEventListener('click', usePotion);
$('sound-btn').addEventListener('click', () => { muted = !muted; $('sound-btn').textContent = muted ? '♪' : '♫'; toast(muted ? 'Sonido desactivado' : 'Sonido activado'); });
document.addEventListener('keydown', (event) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  keys.add(event.code);
  if (event.repeat) return;
  if (event.code === 'Space' || event.code === 'KeyQ') attack();
  if (event.code === 'ShiftLeft' || event.code === 'ShiftRight' || event.code === 'KeyE') dash();
  if (event.code === 'KeyR') usePotion();
  if (event.code === 'Escape') togglePause();
});
document.addEventListener('keyup', (event) => keys.delete(event.code));
renderer.domElement.addEventListener('pointerdown', (event) => { if (state.started && !state.paused && event.button === 0) attack(); });
const joystick = $('joystick'), knob = $('joy-knob');
joystick.addEventListener('pointerdown', (event) => { event.preventDefault(); joystickPointer = event.pointerId; joystick.setPointerCapture(event.pointerId); setJoystick(event); });
joystick.addEventListener('pointermove', (event) => { if (event.pointerId === joystickPointer) setJoystick(event); });
function setJoystick(event) {
  const rect = joystick.getBoundingClientRect(), dx = event.clientX - rect.left - rect.width / 2, dy = event.clientY - rect.top - rect.height / 2;
  const len = Math.min(31, Math.hypot(dx, dy)), angle = Math.atan2(dy, dx);
  knob.style.transform = `translate(${Math.cos(angle) * len}px,${Math.sin(angle) * len}px)`;
  touchInput.set(Math.cos(angle) * len / 31, Math.sin(angle) * len / 31);
}
function releaseJoystick(event) { if (event.pointerId === joystickPointer) { joystickPointer = null; touchInput.set(0, 0); knob.style.transform = ''; } }
joystick.addEventListener('pointerup', releaseJoystick); joystick.addEventListener('pointercancel', releaseJoystick);

// A handful of luminous flowers and fallen pillars lend the open valley some ancient life.
const flowerMats = ['#d3c37e', '#e7aa85', '#9dbe9c'].map(color => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .24, roughness: .7 }));
for (let i = 0; i < 95; i++) {
  const x = (rand() - .5) * 40, z = (rand() - .5) * 38;
  if (Math.abs(x) < 6 && z > -12 && z < 12) continue;
  const flower = addMesh(world, new THREE.SphereGeometry(.055 + rand() * .035, 6, 5), flowerMats[i % 3], [x, .11, z], [1, .6, 1], false);
}
for (const [x, z, rot] of [[-5, 2, .15], [5, -1, -.2], [-11, -14, .3], [11, -14, -.3]]) {
  const pillar = addMesh(world, new THREE.CylinderGeometry(.34, .48, 2.4, 6), mats.stone, [x, 1.1, z]); pillar.rotation.z = rot;
  addMesh(world, new THREE.BoxGeometry(1.05, .26, 1.05), mats.darkStone, [x, 2.25, z]).rotation.y = .3;
}

const cameraTarget = new THREE.Vector3();
const cameraPosition = new THREE.Vector3(0, 7.6, 20.5);
camera.position.copy(cameraPosition); camera.lookAt(0, 1.2, 8);
function update(dt) {
  state.time += dt;
  if (!state.paused && state.started && !state.over) {
    moveInput.copy(touchInput);
    if (keys.has('KeyA') || keys.has('ArrowLeft')) moveInput.x -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) moveInput.x += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) moveInput.y -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) moveInput.y += 1;
    if (moveInput.lengthSq() > 1) moveInput.normalize();
    const walking = moveInput.lengthSq() > .015;
    if (state.dash > 0) {
      state.dash -= dt;
      player.position.addScaledVector(player.userData.dashVector || new THREE.Vector3(0, 0, -1), dt * 13);
      hero.scale.setScalar(1 + Math.sin(state.dash * 16) * .035);
    } else if (walking) {
      player.position.x += moveInput.x * dt * 4.7;
      player.position.z += moveInput.y * dt * 4.7;
      player.rotation.y = Math.atan2(moveInput.x, -moveInput.y);
      hero.position.y = Math.sin(state.time * 12) * .055;
      hero.rotation.z = Math.sin(state.time * 6) * .025;
    } else {
      hero.position.y = Math.sin(state.time * 2.2) * .025;
      hero.rotation.z *= .9;
    }
    hero.scale.setScalar(1);
    player.position.x = THREE.MathUtils.clamp(player.position.x, -25, 25);
    player.position.z = THREE.MathUtils.clamp(player.position.z, -26, 28);
    state.invuln = Math.max(0, state.invuln - dt);
    state.attack = Math.max(0, state.attack - dt);
    state.dash = Math.max(0, state.dash);
    const attackProgress = state.attack > 0 ? 1 - state.attack / .42 : 0;
    swordPivot.rotation.z = state.attack > 0 ? -1.5 + Math.sin(attackProgress * Math.PI) * 2.6 : THREE.MathUtils.damp(swordPivot.rotation.z, 0, 12, dt);
    hero.visible = state.invuln <= 0 || Math.floor(state.time * 18) % 2 === 0;
    for (const relic of relics) {
      relic.group.position.y = relic.baseY + Math.sin(state.time * 1.7 + relic.index) * .16;
      relic.crystal.rotation.y += dt * .65; relic.glyph.rotation.y -= dt * .8; relic.light.intensity = 1.5 + Math.sin(state.time * 3 + relic.index) * .35;
      if (!relic.collected && player.position.distanceTo(relic.group.position) < 1.55) {
        relic.collected = true; relic.group.visible = false; state.shards++; updateHUD();
        burst(relic.group.position.clone(), '#8af6e0', 24); sound(740, .35, 'sine', .06);
        toast(`Reliquia ancestral recuperada · ${state.shards}/3`);
        if (state.shards === 3) {
          boss.root.visible = true; $('boss-warning').classList.add('show'); sound(110, .8, 'triangle', .06);
          setTimeout(() => $('boss-warning').classList.remove('show'), 3000);
        }
      }
    }
    for (const enemy of enemies) {
      if (!enemy.alive || !enemy.root.visible) continue;
      const p = enemy.root.position, delta = player.position.clone().sub(p); delta.y = 0;
      const distance = delta.length(); enemy.phase += dt * 3;
      enemy.root.position.y = Math.sin(enemy.phase) * .13 + (enemy.boss ? .05 : 0);
      enemy.root.rotation.y = Math.atan2(delta.x, delta.z);
      enemy.aura.intensity = THREE.MathUtils.damp(enemy.aura.intensity, enemy.boss ? 1.8 : .75, 4, dt);
      if (enemy.hit > 0) { enemy.hit -= dt; enemy.root.position.y += .12; }
      if (distance < 12) {
        if (distance > (enemy.boss ? 2.25 : 1.7)) p.addScaledVector(delta.normalize(), Math.min(distance - (enemy.boss ? 2.25 : 1.7), enemy.speed * dt));
        enemy.attackTimer -= dt;
        if (distance < (enemy.boss ? 2.85 : 2.1) && enemy.attackTimer <= 0) {
          enemy.attackTimer = enemy.boss ? 1.45 : 1.9; hurt(enemy.damage);
          burst(player.position.clone().add(new THREE.Vector3(0, 1.2, 0)), '#f2a58b', 5);
        }
      }
    }
    if (state.shards === 3 && !boss.alive && player.position.distanceTo(portalGroup.position) < 4.1) finish(true);
    updateHUD();
  }
  portalInner.material.opacity = .64 + Math.sin(state.time * 2.2) * .12;
  portalInner.rotation.z = Math.sin(state.time * .4) * .08;
  portalGroup.rotation.y = Math.sin(state.time * .35) * .025;
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]; p.life -= dt; p.mesh.position.addScaledVector(p.velocity, dt); p.velocity.y -= dt * 3.2;
    p.mesh.material.opacity = Math.max(0, p.life / p.maxLife); p.mesh.rotation.x += dt * 4; p.mesh.rotation.y += dt * 5;
    if (p.life <= 0) { scene.remove(p.mesh); p.mesh.geometry.dispose(); particles.splice(i, 1); }
  }
  const desired = new THREE.Vector3(player.position.x * .68, 7.2, player.position.z + 10.5);
  camera.position.lerp(desired, 1 - Math.exp(-3.2 * dt));
  cameraTarget.set(player.position.x * .48, 1.05, player.position.z - 1.1);
  camera.lookAt(cameraTarget);
}
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), .045);
  update(dt);
  renderer.render(scene, camera);
}
animate();
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
});
updateHUD();
