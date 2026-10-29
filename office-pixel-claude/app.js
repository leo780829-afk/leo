/* ============================================================
   像素 AI 辦公室 - 原創像素渲染引擎
   所有角色/家具皆以程式繪製（canvas pixel drawing），非外部美術資源。
   ============================================================ */
(() => {
'use strict';

const TILE = 16;
const MAP_W = 24;
const MAP_H = 16;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

/* ---------------- Tile types ---------------- */
const T = {
  FLOOR: 0, ADMIN: 1, INVEST: 2, CONTENT: 3, BREAK: 4,
  WALL: 5, WINDOW: 6, DOOR: 7, DESK: 8, PLANT: 9,
  COFFEE: 10, SIGN: 11, SOFA: 12,
};

const FLOOR_TILES = new Set([T.FLOOR, T.ADMIN, T.INVEST, T.CONTENT, T.BREAK]);
const BLOCKED_TILES = new Set([T.WALL, T.WINDOW, T.DOOR, T.DESK, T.PLANT, T.COFFEE, T.SIGN, T.SOFA]);

/* ---------------- Build map ---------------- */
const map = [];
for (let y = 0; y < MAP_H; y++) {
  map.push(new Array(MAP_W).fill(T.FLOOR));
}
function setTile(x, y, t) { if (map[y] && x >= 0 && x < MAP_W) map[y][x] = t; }
function fillRect(x0, y0, x1, y1, t) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) setTile(x, y, t);
}

// Border walls
fillRect(0, 0, MAP_W - 1, 0, T.WALL);
fillRect(0, MAP_H - 1, MAP_W - 1, MAP_H - 1, T.WALL);
fillRect(0, 0, 0, MAP_H - 1, T.WALL);
fillRect(MAP_W - 1, 0, MAP_W - 1, MAP_H - 1, T.WALL);
// windows on top wall
[4, 11, 19].forEach(x => setTile(x, 0, T.WINDOW));
// door (decorative) on bottom wall
setTile(12, MAP_H - 1, T.DOOR);

// Department floor tints (interior zones)
fillRect(1, 1, 6, 4, T.ADMIN);     // 管理部
fillRect(8, 1, 14, 7, T.INVEST);   // 投資研究部
fillRect(16, 1, 22, 4, T.CONTENT); // 內容工作室
fillRect(1, 10, 22, 13, T.BREAK);  // 休息區

/* ---------------- Furniture & desks ---------------- */
// desk: {x,y} is the desk tile (monitor). seat is the tile directly south (y+1).
const DESKS = [
  { id: 'meimei',     x: 3,  y: 2 },
  { id: 'alfred',     x: 5,  y: 2 },
  { id: 'four',       x: 9,  y: 2 },
  { id: 'daytrade',   x: 11, y: 2 },
  { id: 'buffett',    x: 9,  y: 5 },
  { id: 'researcher', x: 11, y: 5 },
  { id: 'ip',         x: 17, y: 2 },
  { id: 'math',       x: 19, y: 2 },
  { id: 'badminton',  x: 21, y: 2 },
];
DESKS.forEach(d => { setTile(d.x, d.y, T.DESK); });

const SIGNS = [
  { x: 4,  y: 1, label: '管理部', color: '#7f98c9' },
  { x: 10, y: 1, label: '投資研究部', color: '#7fbf8a' },
  { x: 18, y: 1, label: '內容工作室', color: '#c98fbf' },
];
SIGNS.forEach(s => setTile(s.x, s.y, T.SIGN));

const PLANTS = [
  { x: 1, y: 1 }, { x: 22, y: 1 }, { x: 15, y: 1 },
  { x: 2, y: 10 }, { x: 21, y: 10 }, { x: 2, y: 13 }, { x: 21, y: 13 },
  { x: 7, y: 9 },
];
PLANTS.forEach(p => setTile(p.x, p.y, T.PLANT));

const COFFEE = { x: 8, y: 11 };
setTile(COFFEE.x, COFFEE.y, T.COFFEE);

// Sofa: 3-tile couch, each tile is a sit spot (facing south/down toward room)
const SOFA_TILES = [
  { x: 3, y: 11 }, { x: 4, y: 11 }, { x: 5, y: 11 },
];
SOFA_TILES.forEach(s => setTile(s.x, s.y, T.SOFA));

function inBounds(x, y) { return x >= 0 && x < MAP_W && y >= 0 && y < MAP_H; }
function isBlocked(x, y) {
  if (!inBounds(x, y)) return true;
  return BLOCKED_TILES.has(map[y][x]);
}

/* ---------------- BFS pathfinding ---------------- */
function findPath(sx, sy, gx, gy) {
  if (!inBounds(gx, gy)) return null;
  if (sx === gx && sy === gy) return [];
  const key = (x, y) => y * MAP_W + x;
  const visited = new Uint8Array(MAP_W * MAP_H);
  const prev = new Int32Array(MAP_W * MAP_H).fill(-1);
  const queue = [[sx, sy]];
  visited[key(sx, sy)] = 1;
  const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  let found = false;
  while (queue.length) {
    const [cx, cy] = queue.shift();
    if (cx === gx && cy === gy) { found = true; break; }
    for (const [dx, dy] of dirs) {
      const nx = cx + dx, ny = cy + dy;
      if (!inBounds(nx, ny)) continue;
      const nk = key(nx, ny);
      if (visited[nk]) continue;
      if (isBlocked(nx, ny) && !(nx === gx && ny === gy)) continue;
      visited[nk] = 1;
      prev[nk] = key(cx, cy);
      queue.push([nx, ny]);
    }
  }
  if (!found) return null;
  const path = [];
  let ck = key(gx, gy);
  while (ck !== key(sx, sy)) {
    const cy = Math.floor(ck / MAP_W), cx = ck % MAP_W;
    path.push({ x: cx, y: cy });
    ck = prev[ck];
    if (ck === -1) break;
  }
  path.reverse();
  return path;
}

function randomWalkableTile(excludeSet) {
  for (let tries = 0; tries < 60; tries++) {
    const x = 1 + Math.floor(Math.random() * (MAP_W - 2));
    const y = 1 + Math.floor(Math.random() * (MAP_H - 2));
    if (!isBlocked(x, y) && !(excludeSet && excludeSet.has(x + ',' + y))) return { x, y };
  }
  return null;
}

/* ============================================================
   原創像素角色生成（程式繪製，非外部素材）
   ============================================================ */
const SPRITE_W = 16, SPRITE_H = 18;
const DIRS = ['down', 'up', 'left', 'right'];

function px(ictx, x, y, color) {
  ictx.fillStyle = color;
  ictx.fillRect(x, y, 1, 1);
}

// Draw one 16x18 character frame onto an offscreen context at (0,0).
function drawCharFrame(ictx, dir, frame, pal) {
  ictx.clearRect(0, 0, SPRITE_W, SPRITE_H);
  const bob = frame === 1 ? 1 : 0; // bounce on alt frame
  const oy = -bob; // shift whole body up 1px on step frame
  // --- hair crown ---
  for (let x = 3; x <= 12; x++) px(ictx, x, 0 + oy, pal.hair);
  for (let x = 2; x <= 13; x++) px(ictx, x, 1 + oy, pal.hair);
  // --- head sides (hair) + face (skin) ---
  for (let y = 2; y <= 6; y++) {
    px(ictx, 2, y + oy, pal.hair);
    px(ictx, 13, y + oy, pal.hair);
    for (let x = 3; x <= 12; x++) px(ictx, x, y + oy, pal.skin);
  }
  // hair style accent (fringe / side length)
  if (pal.hairStyle === 'long') {
    for (let y = 5; y <= 9; y++) { px(ictx, 1, y + oy, pal.hair); px(ictx, 14, y + oy, pal.hair); }
  }
  if (pal.hairStyle === 'bun') {
    px(ictx, 7, -1 + oy, pal.hair); px(ictx, 8, -1 + oy, pal.hair);
  }
  // eyes / face direction
  if (dir === 'down') {
    px(ictx, 5, 4 + oy, pal.eye); px(ictx, 10, 4 + oy, pal.eye);
    if (pal.glasses) { for (let x = 4; x <= 11; x++) px(ictx, x, 3 + oy, pal.glasses); }
  } else if (dir === 'up') {
    // back of head: no eyes, slightly darker crown patch
    for (let x = 4; x <= 11; x++) px(ictx, x, 2 + oy, pal.hairDark);
  } else if (dir === 'left') {
    px(ictx, 4, 4 + oy, pal.eye);
    if (pal.glasses) { for (let x = 3; x <= 6; x++) px(ictx, x, 3 + oy, pal.glasses); }
  } else if (dir === 'right') {
    px(ictx, 11, 4 + oy, pal.eye);
    if (pal.glasses) { for (let x = 9; x <= 12; x++) px(ictx, x, 3 + oy, pal.glasses); }
  }
  // --- torso / shirt ---
  for (let y = 7; y <= 12; y++) {
    for (let x = 3; x <= 12; x++) px(ictx, x, y + oy, pal.shirt);
  }
  for (let x = 3; x <= 12; x++) px(ictx, x, 7 + oy, pal.shirtDark);
  // arms (sides), swap per frame for walk cycle on left/right
  const armShift = (dir === 'left' || dir === 'right') ? (frame === 1 ? 1 : 0) : 0;
  for (let y = 8; y <= 11; y++) {
    px(ictx, 2 - (frame === 1 ? 0 : 0), y + oy + armShift, pal.skin);
    px(ictx, 13, y + oy - armShift, pal.skin);
  }
  if (pal.tie) {
    px(ictx, 7, 7 + oy, pal.tie); px(ictx, 7, 8 + oy, pal.tie);
    px(ictx, 8, 9 + oy, pal.tie); px(ictx, 7, 10 + oy, pal.tie);
  }
  if (pal.bow) {
    px(ictx, 6, 2 + oy, pal.bow); px(ictx, 9, 2 + oy, pal.bow);
  }
  // --- legs / shoes ---
  const stepL = frame === 0 ? 0 : 1;
  const stepR = frame === 0 ? 1 : 0;
  for (let y = 13; y <= 15; y++) {
    for (let x = 4; x <= 7; x++) px(ictx, x, y + stepL, pal.pants);
    for (let x = 8; x <= 11; x++) px(ictx, x, y + stepR, pal.pants);
  }
  for (let x = 4; x <= 7; x++) px(ictx, x, 16 + stepL, pal.shoe);
  for (let x = 8; x <= 11; x++) px(ictx, x, 16 + stepR, pal.shoe);
}

function buildSpriteSheet(pal) {
  const sheet = document.createElement('canvas');
  sheet.width = SPRITE_W * 2;
  sheet.height = SPRITE_H * DIRS.length;
  const sctx = sheet.getContext('2d');
  const tmp = document.createElement('canvas');
  tmp.width = SPRITE_W; tmp.height = SPRITE_H;
  const tctx = tmp.getContext('2d');
  DIRS.forEach((dir, di) => {
    for (let f = 0; f < 2; f++) {
      drawCharFrame(tctx, dir, f, pal);
      sctx.drawImage(tmp, f * SPRITE_W, di * SPRITE_H);
    }
  });
  return sheet;
}

/* ---------------- Employee palettes ---------------- */
const EMP_META = {
  meimei:     { name: '美美',       dept: '管理部',     pal: { skin:'#f2c49b', hair:'#3a2a24', hairDark:'#2a1d18', hairStyle:'long', eye:'#2a2a2a', shirt:'#e06a8c', shirtDark:'#c6557a', pants:'#4a4560', shoe:'#2a2a33', bow:'#ffd166' } },
  alfred:     { name: '天睿顧問Alfred', dept: '管理部', pal: { skin:'#e8b48b', hair:'#555962', hairDark:'#3f4249', hairStyle:'short', eye:'#2a2a2a', shirt:'#2d4a73', shirtDark:'#213757', pants:'#2a2a33', shoe:'#1c1c22', tie:'#b8333a', glasses:'#2a2a2a' } },
  four:       { name: '以恆',       dept: '投資研究部', pal: { skin:'#f2c49b', hair:'#2a2420', hairDark:'#1c1814', hairStyle:'short', eye:'#2a2a2a', shirt:'#3b6ea5', shirtDark:'#2c5684', pants:'#36394a', shoe:'#1c1c22' } },
  daytrade:   { name: '子睿',       dept: '投資研究部', pal: { skin:'#e8b48b', hair:'#4a3a2a', hairDark:'#362a1e', hairStyle:'short', eye:'#2a2a2a', shirt:'#6a6f7a', shirtDark:'#51555e', pants:'#2e3140', shoe:'#1c1c22' } },
  buffett:    { name: '承遠',       dept: '投資研究部', pal: { skin:'#e8b48b', hair:'#5a4330', hairDark:'#423021', hairStyle:'short', eye:'#2a2a2a', shirt:'#8a6a45', shirtDark:'#6e5234', pants:'#3a3228', shoe:'#1c1c22', glasses:'#2a2a2a' } },
  researcher: { name: '書妍',       dept: '投資研究部', pal: { skin:'#f2c49b', hair:'#2a221c', hairDark:'#1a1512', hairStyle:'bun', eye:'#2a2a2a', shirt:'#dfe6f5', shirtDark:'#c3cde3', pants:'#3a5a85', shoe:'#1c1c22', glasses:'#2a2a2a' } },
  ip:         { name: '語彤',       dept: '內容工作室', pal: { skin:'#f2c49b', hair:'#6a2e4a', hairDark:'#4e2238', hairStyle:'long', eye:'#2a2a2a', shirt:'#c968b3', shirtDark:'#aa4f97', pants:'#3a2e45', shoe:'#1c1c22', bow:'#ffd166' } },
  math:       { name: '若晴',       dept: '內容工作室', pal: { skin:'#f2c49b', hair:'#3a2a24', hairDark:'#281c17', hairStyle:'bun', eye:'#2a2a2a', shirt:'#e0a84a', shirtDark:'#c4902f', pants:'#4a3c2a', shoe:'#1c1c22', glasses:'#2a2a2a' } },
  badminton:  { name: '品安',       dept: '內容工作室', pal: { skin:'#e8b48b', hair:'#20201f', hairDark:'#141413', hairStyle:'short', eye:'#2a2a2a', shirt:'#3f9a52', shirtDark:'#2f7a40', pants:'#2a2e38', shoe:'#1c1c22' } },
};

Object.keys(EMP_META).forEach(id => {
  EMP_META[id].sheet = buildSpriteSheet(EMP_META[id].pal);
});

/* ============================================================
   Employee entity + behaviour state machine
   ============================================================ */
const DESK_BY_ID = {};
DESKS.forEach(d => { DESK_BY_ID[d.id] = d; });

const DEPT_ZONE = {
  meimei: [1, 1, 6, 4], alfred: [1, 1, 6, 4],
  four: [8, 1, 14, 7], daytrade: [8, 1, 14, 7], buffett: [8, 1, 14, 7], researcher: [8, 1, 14, 7],
  ip: [16, 1, 22, 4], math: [16, 1, 22, 4], badminton: [16, 1, 22, 4],
};

const CHAT_LINES = ['...', '！', '？', '嗯嗯', '是喔', '好喔', '辛苦了', '哈哈'];
const sofaOccupancy = new Map(); // "x,y" -> emp id

class Employee {
  constructor(id) {
    this.id = id;
    const meta = EMP_META[id];
    this.meta = meta;
    const desk = DESK_BY_ID[id];
    this.deskSeat = { x: desk.x, y: desk.y + 1 };
    this.desk = desk;
    this.tileX = this.deskSeat.x;
    this.tileY = this.deskSeat.y;
    this.px = this.tileX * TILE + TILE / 2;
    this.py = this.tileY * TILE + TILE;
    this.dir = 'down';
    this.frame = 0;
    this.animTimer = 0;
    this.moving = false;
    this.path = [];
    this.speed = 46; // px/sec
    this.activity = 'init';
    this.activityTimer = 0;
    this.chatPartner = null;
    this.sofaTile = null;
    this.monitorState = 'off';
    this.chatCooldown = 0;
    // data fields (merged from status.json)
    this.data = { name: meta.name, light: 'waiting', state: '', title: '', sub: '', screen: '', lines: [] };
    this.activity = 'idleStand';
    this.activityTimer = 0.3 + Math.random() * 0.6;
    this._wasWorking = undefined;
  }
  setGoalSeat() { this.goTo(this.deskSeat.x, this.deskSeat.y, 'toSeatWork'); }
  goTo(x, y, nextActivity) {
    const path = findPath(this.tileX, this.tileY, x, y);
    if (path === null) { this.activity = 'idleStand'; this.activityTimer = 1 + Math.random(); return; }
    this.path = path;
    this.pendingActivity = nextActivity;
    this.activity = 'moving';
  }
  releaseSofa() {
    if (this.sofaTile) { sofaOccupancy.delete(this.sofaTile.x + ',' + this.sofaTile.y); this.sofaTile = null; }
  }
  applyData(d) {
    this.data = Object.assign({}, this.data, d);
    const light = this.data.light;
    const isWorking = light === 'working';
    const firstTime = this._wasWorking === undefined;
    if (isWorking && (firstTime || !this._wasWorking)) {
      this.releaseSofa();
      this.chatPartner = null;
      this.setGoalSeat();
    } else if (!isWorking && (firstTime || this._wasWorking)) {
      this.activity = 'idleStand';
      this.activityTimer = firstTime ? (0.3 + Math.random() * 1.5) : 0.3;
    }
    this._wasWorking = isWorking;
  }
  update(dt, all) {
    if (this.activity === 'moving') {
      this.advanceMovement(dt);
      return;
    }

    // non-moving activities: countdown timers
    this.activityTimer -= dt;
    this.animTick(dt, false);

    if (this.data.light === 'working') {
      this.activity = 'working';
      this.dir = 'up';
      this.monitorState = 'working';
      return;
    }

    if (this.activityTimer <= 0) this.pickNextIdleActivity(all);
  }
  animTick(dt, forceWalk) {
    this.animTimer += dt;
    const flip = this.activity === 'working' || this.activity === 'deskPlay' || this.activity === 'sofaSit' || this.activity === 'chatting';
    const period = flip ? 1.1 : 0.16;
    if (this.animTimer > period) {
      this.animTimer = 0;
      this.frame = flip ? (this.frame === 0 ? 1 : 0) : (forceWalk ? (this.frame === 0 ? 1 : 0) : this.frame);
    }
  }
  advanceMovement(dt) {
    if (!this.path.length) {
      this.activity = this.pendingActivity || 'idleStand';
      this.onArrive();
      return;
    }
    const target = this.path[0];
    const tx = target.x * TILE + TILE / 2, ty = target.y * TILE + TILE;
    const dx = tx - this.px, dy = ty - this.py;
    const dist = Math.hypot(dx, dy);
    const step = this.speed * dt;
    this.animTimer += dt;
    if (this.animTimer > 0.14) { this.animTimer = 0; this.frame = this.frame === 0 ? 1 : 0; }
    if (dist <= step) {
      this.px = tx; this.py = ty;
      this.tileX = target.x; this.tileY = target.y;
      this.path.shift();
    } else {
      this.px += (dx / dist) * step;
      this.py += (dy / dist) * step;
      if (Math.abs(dx) > Math.abs(dy)) this.dir = dx > 0 ? 'right' : 'left';
      else this.dir = dy > 0 ? 'down' : 'up';
    }
  }
  onArrive() {
    this.frame = 0;
    if (this.pendingActivity === 'toSeatWork') {
      this.activity = 'working'; this.dir = 'up'; this.monitorState = 'working';
    } else if (this.pendingActivity === 'deskPlay') {
      this.activity = 'deskPlay'; this.dir = 'up'; this.monitorState = 'play';
      this.activityTimer = 5 + Math.random() * 4;
    } else if (this.pendingActivity === 'sofaSit') {
      this.activity = 'sofaSit'; this.dir = 'down';
      this.activityTimer = 5 + Math.random() * 5;
    } else if (this.pendingActivity === 'wander') {
      this.activity = 'idleStand'; this.dir = 'down';
      this.activityTimer = 1.2 + Math.random() * 2.2;
    } else if (this.pendingActivity === 'toChat') {
      this.activity = 'chatting'; this.monitorState = 'off';
      this.activityTimer = 4 + Math.random() * 3;
      this.chatTimer = 0;
      this.chatLineIdx = Math.floor(Math.random() * CHAT_LINES.length);
    } else {
      this.activity = 'idleStand';
      this.activityTimer = 1 + Math.random() * 2;
    }
  }
  pickNextIdleActivity(all) {
    this.monitorState = 'off';
    if (this.data.light === 'working') return;
    this.chatPartner = null;
    this.releaseSofa();
    const roll = Math.random();
    if (roll < 0.32) {
      // wander to a nearby-ish free tile
      const zone = DEPT_ZONE[this.id];
      let target = null;
      for (let i = 0; i < 12 && !target; i++) {
        const biased = Math.random() < 0.6 && zone;
        if (biased) {
          const [x0, y0, x1, y1] = zone;
          const x = x0 + Math.floor(Math.random() * (x1 - x0 + 1));
          const y = y0 + Math.floor(Math.random() * (y1 - y0 + 1));
          if (!isBlocked(x, y)) target = { x, y };
        } else {
          target = randomWalkableTile();
        }
      }
      if (target) this.goTo(target.x, target.y, 'wander');
      else { this.activity = 'idleStand'; this.activityTimer = 1.5; }
    } else if (roll < 0.58) {
      this.goTo(this.deskSeat.x, this.deskSeat.y, 'deskPlay');
    } else if (roll < 0.80) {
      const free = SOFA_TILES.find(s => !sofaOccupancy.has(s.x + ',' + s.y));
      if (free) {
        sofaOccupancy.set(free.x + ',' + free.y, this.id);
        this.sofaTile = free;
        this.goTo(free.x, free.y, 'sofaSit');
      } else {
        this.activity = 'idleStand'; this.activityTimer = 1.5;
      }
    } else {
      this.activity = 'idleStand';
      this.activityTimer = 1 + Math.random() * 2;
    }
  }
  get feetY() { return this.py; }
  get drawOriginX() { return Math.round(this.px - SPRITE_W / 2); }
  get drawOriginY() { return Math.round(this.py - SPRITE_H); }
  isFreeForChat() {
    return this.data.light !== 'working' &&
      (this.activity === 'idleStand') &&
      !this.chatCooldown;
  }
}

/* ---------------- World / employees init ---------------- */
const employees = Object.keys(EMP_META).map(id => new Employee(id));
const empById = {}; employees.forEach(e => { empById[e.id] = e; });

/* ---------------- Chat matchmaker ---------------- */
let chatTickTimer = 0;
function updateChatMatchmaker(dt) {
  chatTickTimer -= dt;
  employees.forEach(e => { if (e.chatCooldown > 0) e.chatCooldown -= dt; });
  if (chatTickTimer > 0) return;
  chatTickTimer = 2.5 + Math.random() * 2;
  const pool = employees.filter(e => e.isFreeForChat());
  if (pool.length < 2) return;
  // shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  for (let i = 0; i + 1 < pool.length; i += 2) {
    if (Math.random() > 0.55) continue;
    const a = pool[i], b = pool[i + 1];
    const meet = { x: a.tileX, y: a.tileY };
    let near = null;
    const candidates = [
      { x: meet.x + 1, y: meet.y }, { x: meet.x - 1, y: meet.y },
      { x: meet.x, y: meet.y + 1 }, { x: meet.x, y: meet.y - 1 },
    ];
    for (const c of candidates) if (!isBlocked(c.x, c.y)) { near = c; break; }
    if (!near) near = meet;
    a.chatPartner = b.id; b.chatPartner = a.id;
    a.goTo(meet.x, meet.y, 'toChat');
    b.goTo(near.x, near.y, 'toChat');
    a.chatCooldown = 10 + Math.random() * 6;
    b.chatCooldown = 10 + Math.random() * 6;
  }
}

/* ============================================================
   Rendering
   ============================================================ */
function floorColor(t, x, y) {
  const alt = (x + y) % 2 === 0;
  switch (t) {
    case T.ADMIN: return alt ? '#8fa8d9' : '#7f98c9';
    case T.INVEST: return alt ? '#8fcf9a' : '#7fbf8a';
    case T.CONTENT: return alt ? '#d99fcf' : '#c98fbf';
    case T.BREAK: return alt ? '#e8d9a0' : '#dccb8f';
    default: return alt ? '#b89a6a' : '#ad8f5e';
  }
}

function drawTile(x, y, t) {
  const px0 = x * TILE, py0 = y * TILE;
  if (FLOOR_TILES.has(t)) {
    ctx.fillStyle = floorColor(t, x, y);
    ctx.fillRect(px0, py0, TILE, TILE);
    return;
  }
  // default floor under furniture/walls where relevant drawn by caller
  switch (t) {
    case T.WALL:
      ctx.fillStyle = '#2d3354'; ctx.fillRect(px0, py0, TILE, TILE);
      ctx.fillStyle = '#39406a'; ctx.fillRect(px0, py0, TILE, 4);
      break;
    case T.WINDOW:
      ctx.fillStyle = '#2d3354'; ctx.fillRect(px0, py0, TILE, TILE);
      ctx.fillStyle = '#9fd1ff'; ctx.fillRect(px0 + 3, py0 + 3, TILE - 6, TILE - 7);
      ctx.fillStyle = '#6fb3e6'; ctx.fillRect(px0 + 3, py0 + 8, TILE - 6, 2);
      break;
    case T.DOOR:
      ctx.fillStyle = '#6b4a30'; ctx.fillRect(px0, py0, TILE, TILE);
      ctx.fillStyle = '#8a6440'; ctx.fillRect(px0 + 2, py0 + 1, TILE - 4, TILE - 2);
      break;
    default:
      ctx.fillStyle = floorColor(T.FLOOR, x, y);
      ctx.fillRect(px0, py0, TILE, TILE);
  }
}

function drawDesk(d) {
  const px0 = d.x * TILE, py0 = d.y * TILE;
  // desk surface
  ctx.fillStyle = '#8a5a3a'; ctx.fillRect(px0, py0 + 6, TILE, 10);
  ctx.fillStyle = '#a8744c'; ctx.fillRect(px0, py0 + 6, TILE, 2);
  // monitor
  const emp = empById[d.id];
  const screenColor = emp && emp.monitorState === 'working' ? '#3dd6b0'
    : emp && emp.monitorState === 'play' ? '#d66bd6' : '#55596b';
  ctx.fillStyle = '#2a2a33'; ctx.fillRect(px0 + 3, py0, 10, 7);
  ctx.fillStyle = screenColor; ctx.fillRect(px0 + 4, py0 + 1, 8, 5);
  ctx.fillStyle = '#2a2a33'; ctx.fillRect(px0 + 6, py0 + 7, 4, 1);
}

function drawSign(s) {
  const px0 = s.x * TILE, py0 = s.y * TILE;
  ctx.fillStyle = '#3a3a44'; ctx.fillRect(px0 + 7, py0 + 8, 2, 8);
  ctx.fillStyle = s.color; ctx.fillRect(px0 - 2, py0 + 2, TILE + 4, 8);
  ctx.strokeStyle = '#1c1c22'; ctx.lineWidth = 1;
  ctx.strokeRect(px0 - 1.5, py0 + 2.5, TILE + 3, 7);
  ctx.fillStyle = '#1c1c22';
  ctx.font = '7px "PixelZh", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(s.label, px0 + TILE / 2, py0 + 6.5);
}

function drawPlant(p) {
  const px0 = p.x * TILE, py0 = p.y * TILE;
  ctx.fillStyle = '#7a5030'; ctx.fillRect(px0 + 4, py0 + 11, 8, 5);
  ctx.fillStyle = '#3f9a52';
  ctx.beginPath(); ctx.arc(px0 + 8, py0 + 7, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2f7a40';
  ctx.beginPath(); ctx.arc(px0 + 5, py0 + 9, 4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(px0 + 11, py0 + 9, 4, 0, Math.PI * 2); ctx.fill();
}

function drawCoffee(c) {
  const px0 = c.x * TILE, py0 = c.y * TILE;
  ctx.fillStyle = '#b7bfcf'; ctx.fillRect(px0 + 3, py0 + 2, 10, 13);
  ctx.fillStyle = '#8a93a8'; ctx.fillRect(px0 + 3, py0 + 2, 10, 3);
  ctx.fillStyle = '#ff5a5a'; ctx.fillRect(px0 + 7, py0 + 7, 2, 2);
  ctx.fillStyle = '#4a3222'; ctx.fillRect(px0 + 5, py0 + 11, 6, 3);
}

function drawSofaRow() {
  const minX = Math.min(...SOFA_TILES.map(s => s.x));
  const maxX = Math.max(...SOFA_TILES.map(s => s.x));
  const y = SOFA_TILES[0].y;
  const px0 = minX * TILE, py0 = y * TILE;
  const w = (maxX - minX + 1) * TILE;
  ctx.fillStyle = '#a4455a'; ctx.fillRect(px0, py0 + 5, w, 11);
  ctx.fillStyle = '#c96a7e'; ctx.fillRect(px0, py0 + 2, w, 5);
  for (let i = 0; i < (maxX - minX + 1); i++) {
    ctx.fillStyle = '#8a3a4c'; ctx.fillRect(px0 + i * TILE + 1, py0 + 2, 2, 14);
  }
}

/* ---- speech / status bubbles ---- */
function drawBubble(emp) {
  const x = emp.drawOriginX + SPRITE_W / 2;
  const y = emp.drawOriginY - 18; // clear of the DOM nameplate sitting just above the head
  let glyph = null;
  if (emp.activity === 'chatting') {
    glyph = CHAT_LINES[Math.floor((performance.now() / 650 + (emp.chatLineIdx||0))) % CHAT_LINES.length];
  } else if (emp.activity === 'deskPlay') {
    glyph = '🎮';
  } else if (emp.activity === 'sofaSit') {
    glyph = '☕';
  }
  if (!glyph) return;
  ctx.font = '7px "PixelZh", sans-serif';
  const textW = ctx.measureText(glyph).width;
  const w = Math.max(14, textW + 6);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x - w / 2, y - 10, w, 10, 3); else ctx.rect(x - w / 2, y - 10, w, 10);
  ctx.fill();
  ctx.strokeStyle = '#2a2a33'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = '#2a2a33';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(glyph, x, y - 5);
}

function lightColor(light) {
  switch (light) {
    case 'working': return '#3fae5a';
    case 'waiting': return '#d9a52e';
    case 'idle': return '#7f8bb8';
    case 'blocked': return '#c9544a';
    default: return '#7f8bb8';
  }
}

/* ---------------- DOM nameplates ---------------- */
const nameplateLayer = document.createElement('div');
nameplateLayer.id = 'nameplate-layer';
nameplateLayer.style.position = 'absolute';
nameplateLayer.style.left = '0'; nameplateLayer.style.top = '0';
nameplateLayer.style.pointerEvents = 'none';
document.getElementById('stage').appendChild(nameplateLayer);

const nameplates = {};
employees.forEach(e => {
  const el = document.createElement('div');
  el.className = 'nameplate';
  nameplateLayer.appendChild(el);
  nameplates[e.id] = el;
});

function syncNameplates(scale, canvasRect, stageRect) {
  employees.forEach(e => {
    const el = nameplates[e.id];
    el.textContent = e.data.title || e.data.state || '';
    el.style.background = lightColor(e.data.light);
    const screenX = canvasRect.left - stageRect.left + (e.drawOriginX + SPRITE_W / 2) * scale;
    const screenY = canvasRect.top - stageRect.top + (e.drawOriginY - 8) * scale;
    el.style.transform = `translate(${screenX}px, ${screenY}px) translate(-50%, -100%) scale(${Math.max(0.72, Math.min(1, scale))})`;
  });
}

/* ============================================================
   Data loading
   ============================================================ */
let lastStatus = null;
const asofEl = document.getElementById('asof-text');

async function tryFetch(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('bad status ' + res.status);
  return res.json();
}

async function loadStatus() {
  let data = null;
  try { data = await tryFetch('../office/status.json'); }
  catch (e) {
    try { data = await tryFetch('./status.json'); }
    catch (e2) { console.warn('status.json 讀取失敗', e2); return; }
  }
  lastStatus = data;
  asofEl.textContent = data.asOf || '—';
  (data.employees || []).forEach(rec => {
    let emp = empById[rec.id];
    if (!emp) {
      emp = employees.find(e => e.meta.name === rec.name);
    }
    if (!emp) return;
    emp.applyData(rec);
  });
}

/* ============================================================
   Dialog UI
   ============================================================ */
const overlay = document.getElementById('dialog-overlay');
const dName = document.getElementById('dialog-name');
const dState = document.getElementById('dialog-state');
const dSub = document.getElementById('dialog-sub');
const dScreen = document.getElementById('dialog-screen');
const dLines = document.getElementById('dialog-lines');
const dAsof = document.getElementById('dialog-asof');

function stateClass(light) {
  if (light === 'waiting') return 'state-waiting';
  if (light === 'idle') return 'state-idle';
  if (light === 'blocked') return 'state-blocked';
  return '';
}

function openDialog(emp) {
  const d = emp.data;
  dName.textContent = `${d.name}${d.role ? '・' + d.role : ''}`;
  dState.textContent = d.state || d.light || '';
  dState.className = stateClass(d.light);
  dSub.textContent = d.sub || '';
  dScreen.textContent = d.screen || '（目前沒有畫面內容）';
  dLines.innerHTML = '';
  (d.lines || []).forEach(l => {
    const span = document.createElement('span');
    span.textContent = l;
    dLines.appendChild(span);
  });
  dAsof.textContent = `更新：${d.updated || ''}　資料時間 asOf：${(lastStatus && lastStatus.asOf) || ''}`;
  overlay.classList.remove('hidden');
}
document.getElementById('dialog-close').addEventListener('click', () => overlay.classList.add('hidden'));
overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.add('hidden'); });

/* ---------------- Input: click/tap hit-test ---------------- */
function getCanvasCoords(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
}

function hitTestEmployee(cx, cy) {
  let best = null, bestDist = Infinity;
  employees.forEach(e => {
    const x0 = e.drawOriginX, y0 = e.drawOriginY;
    if (cx >= x0 - 2 && cx <= x0 + SPRITE_W + 2 && cy >= y0 - 6 && cy <= y0 + SPRITE_H) {
      const cxp = x0 + SPRITE_W / 2, cyp = y0 + SPRITE_H / 2;
      const dist = Math.hypot(cx - cxp, cy - cyp);
      if (dist < bestDist) { bestDist = dist; best = e; }
    }
  });
  return best;
}

canvas.addEventListener('click', (e) => {
  const { x, y } = getCanvasCoords(e.clientX, e.clientY);
  const emp = hitTestEmployee(x, y);
  if (emp) openDialog(emp);
});

/* ============================================================
   Main loop
   ============================================================ */
let lastTime = performance.now();
function frame(now) {
  let dt = (now - lastTime) / 1000;
  if (dt > 0.1) dt = 0.1;
  lastTime = now;

  updateChatMatchmaker(dt);
  employees.forEach(e => e.update(dt, employees));

  render();
  resizeCanvasToFit();

  requestAnimationFrame(frame);
}

function render() {
  // 1. floor
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      drawTile(x, y, map[y][x]);
    }
  }
  // 2. furniture baseline list + employees, painter's sort by baseline Y
  const drawables = [];
  DESKS.forEach(d => drawables.push({ y: d.y * TILE + TILE, draw: () => drawDesk(d) }));
  SIGNS.forEach(s => drawables.push({ y: s.y * TILE + TILE, draw: () => drawSign(s) }));
  PLANTS.forEach(p => drawables.push({ y: p.y * TILE + TILE, draw: () => drawPlant(p) }));
  drawables.push({ y: COFFEE.y * TILE + TILE, draw: () => drawCoffee(COFFEE) });
  drawables.push({ y: SOFA_TILES[0].y * TILE + 2, draw: () => drawSofaRow() });
  employees.forEach(e => drawables.push({
    y: e.py,
    draw: () => {
      const sheet = e.meta.sheet;
      const di = DIRS.indexOf(e.dir);
      const sitShift = (e.activity === 'sofaSit') ? 3 : 0;
      ctx.drawImage(
        sheet, e.frame * SPRITE_W, di * SPRITE_H, SPRITE_W, SPRITE_H,
        e.drawOriginX, e.drawOriginY + sitShift, SPRITE_W, SPRITE_H
      );
      drawBubble(e);
    }
  }));
  drawables.sort((a, b) => a.y - b.y);
  drawables.forEach(d => d.draw());
}

/* ---------------- resize / scale handling ---------------- */
let currentScale = 1;
const legendEl = document.getElementById('legend');
function resizeCanvasToFit() {
  const stage = document.getElementById('stage');
  const stageRect = stage.getBoundingClientRect();
  const legendRect = legendEl.getBoundingClientRect();
  const reserved = legendRect.height + 24; // gap + padding-top
  const availW = stageRect.width - 8;
  const availH = Math.max(120, stageRect.height - reserved);
  const scale = Math.max(0.5, Math.min(availW / (MAP_W * TILE), availH / (MAP_H * TILE)));
  if (Math.abs(scale - currentScale) > 0.005) {
    currentScale = scale;
    canvas.style.width = (MAP_W * TILE * scale) + 'px';
    canvas.style.height = (MAP_H * TILE * scale) + 'px';
  }
  const canvasRect = canvas.getBoundingClientRect();
  syncNameplates(currentScale, canvasRect, stageRect);
}

/* ---------------- boot ---------------- */
async function boot() {
  try {
    if (document.fonts && document.fonts.load) {
      await document.fonts.load('8px "PixelZh"');
      await document.fonts.ready;
    }
  } catch (e) { /* font optional */ }
  await loadStatus();
  document.getElementById('loading').classList.add('hidden');
  window.addEventListener('resize', resizeCanvasToFit);
  resizeCanvasToFit();
  requestAnimationFrame(frame);
  setInterval(loadStatus, 20000);
}

boot();

})();
