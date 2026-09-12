// ============================================
// 躺平发育 - 游戏核心逻辑（手机版 · 无数据库）
// ============================================

// ========== 游戏配置 ==========
const CONFIG = {
  TILE: 40, COLS: 20, ROWS: 15,
  PLAYER_SPEED: 3,
  WAVE_INTERVAL: 12000,
  GHOST_SPAWN_INTERVAL: 2500,
  SNAPSHOT_INTERVAL: 80,
  INPUT_INTERVAL: 50,
  MAX_PLAYERS: 4,
};

const BUILDINGS = {
  turret: { name: '炮塔', icon: '🗼', cost: 50, damage: 8, range: 130, fireRate: 1000, upgradeCost: (lv) => 40 * lv, upgrade: (b) => { b.damage += 6; b.range += 15; }, maxLevel: 10 },
  turret2: { name: '高级炮塔', icon: '🏰', cost: 200, damage: 22, range: 180, fireRate: 800, upgradeCost: (lv) => 100 * lv, upgrade: (b) => { b.damage += 12; b.range += 20; }, maxLevel: 10 },
  mine: { name: '矿机', icon: '⛏️', cost: 100, income: 2, upgradeCost: (lv) => 80 * lv, upgrade: (b) => { b.income += 2; }, maxLevel: 10 },
  repair: { name: '维修器', icon: '🔧', cost: 80, healRate: 3, upgradeCost: (lv) => 60 * lv, upgrade: (b) => { b.healRate += 2; }, maxLevel: 10 },
};

const DOOR = { baseHp: 100, hpPerLevel: 60, upgradeCost: (lv) => 30 * lv, maxLevel: 15 };
const BED = { baseIncome: 1, incomePerLevel: 1, upgradeCost: (lv) => 50 * lv, maxLevel: 15 };
const GHOST = { baseHp: 40, hpPerWave: 25, baseDamage: 4, damagePerWave: 1.5, speed: 1.2, reward: 15 };

// ========== 地图 ==========
const MAP_TEMPLATE = [
  [1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,5],
  [1,0,0,0,0,0,0,0,1,2,2,2,2,2,2,2,2,2,2,2],
  [1,0,0,0,0,0,0,0,1,2,2,2,2,2,2,2,2,2,2,2],
  [1,0,0,0,0,0,0,0,1,2,2,2,2,2,2,2,2,2,2,2],
  [1,0,0,0,0,0,0,0,1,2,2,2,2,2,2,2,2,2,2,2],
  [1,0,0,0,0,0,0,0,1,2,2,2,2,2,2,2,2,2,2,2],
  [1,0,0,0,4,0,0,0,3,2,2,2,2,2,2,2,2,2,2,2],
  [1,0,0,0,0,0,0,0,1,2,2,2,2,2,2,2,2,2,2,2],
  [1,0,0,0,0,0,0,0,1,2,2,2,2,2,2,2,2,2,2,2],
  [1,0,0,0,0,0,0,0,1,2,2,2,2,2,2,2,2,2,2,2],
  [1,0,0,0,0,0,0,0,1,2,2,2,2,2,2,2,2,2,2,2],
  [1,0,0,0,0,0,0,0,1,2,2,2,2,2,2,2,2,2,2,2],
  [1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2],
  [2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2],
  [2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2],
];

const GHOST_PATH = [
  { x: 19 * 40 + 20, y: 0 * 40 + 20 },
  { x: 9 * 40 + 20,  y: 0 * 40 + 20 },
  { x: 9 * 40 + 20,  y: 6 * 40 + 20 },
  { x: 8 * 40 + 20,  y: 6 * 40 + 20 },
];

const PLAYER_SPAWNS = [
  { x: 3 * 40 + 20, y: 5 * 40 + 20 },
  { x: 3 * 40 + 20, y: 7 * 40 + 20 },
  { x: 5 * 40 + 20, y: 5 * 40 + 20 },
  { x: 5 * 40 + 20, y: 7 * 40 + 20 },
];

// ========== 游戏状态 ==========
const game = {
  running: false, paused: false, mode: 'solo',
  canvas: null, ctx: null, player: null, otherPlayers: [],
  clientInputs: {}, map: [], buildings: [], bullets: [], ghosts: [], particles: [],
  coins: 0, totalCoinsEarned: 0, wave: 0, ghostKills: 0,
  doorHp: DOOR.baseHp, doorMaxHp: DOOR.baseHp, doorLevel: 1, bedLevel: 1,
  selectedBuildType: null, selectedBuilding: null,
  waveTimer: 0, ghostSpawnTimer: 0, ghostsToSpawn: 0, waveActive: false,
  lastTime: 0, playerName: '玩家',
  socket: null, roomId: '', isHost: false, mySocketId: '', latestSnapshot: null,
  _snapshotTimer: 0, _inputTimer: 0, _bedTimer: 0, doorX: 0, doorY: 0,
  canvasScale: 1,
};

// ========== 虚拟摇杆 ==========
const joystick = {
  el: null, knob: null,
  active: false, touchId: null,
  baseX: 0, baseY: 0,
  dx: 0, dy: 0,       // 归一化方向 -1~1
  maxDist: 40,         // 摇杆最大移动距离
};

function initJoystick() {
  joystick.el = document.getElementById('joystick');
  joystick.knob = document.getElementById('joystick-knob');
  if (!joystick.el) return;

  const onStart = (e) => {
    e.preventDefault();
    const t = e.touches ? e.touches[0] : e;
    const rect = joystick.el.getBoundingClientRect();
    joystick.active = true;
    joystick.touchId = e.touches ? t.identifier : 'mouse';
    joystick.baseX = rect.left + rect.width / 2;
    joystick.baseY = rect.top + rect.height / 2;
    updateJoystick(t.clientX, t.clientY);
  };

  const onMove = (e) => {
    if (!joystick.active) return;
    e.preventDefault();
    let t = null;
    if (e.touches) {
      for (const touch of e.touches) {
        if (touch.identifier === joystick.touchId) { t = touch; break; }
      }
    } else {
      t = e;
    }
    if (t) updateJoystick(t.clientX, t.clientY);
  };

  const onEnd = (e) => {
    if (e.changedTouches) {
      let ended = false;
      for (const touch of e.changedTouches) {
        if (touch.identifier === joystick.touchId) ended = true;
      }
      if (!ended) return;
    }
    joystick.active = false;
    joystick.touchId = null;
    joystick.dx = 0; joystick.dy = 0;
    joystick.knob.style.transform = 'translate(-50%, -50%)';
  };

  joystick.el.addEventListener('touchstart', onStart, { passive: false });
  joystick.el.addEventListener('touchmove', onMove, { passive: false });
  joystick.el.addEventListener('touchend', onEnd);
  joystick.el.addEventListener('touchcancel', onEnd);
  // 鼠标兼容（PC调试用）
  joystick.el.addEventListener('mousedown', onStart);
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onEnd);
}

function updateJoystick(clientX, clientY) {
  let dx = clientX - joystick.baseX;
  let dy = clientY - joystick.baseY;
  const dist = Math.hypot(dx, dy);
  if (dist > joystick.maxDist) {
    dx = dx / dist * joystick.maxDist;
    dy = dy / dist * joystick.maxDist;
  }
  joystick.dx = dx / joystick.maxDist;
  joystick.dy = dy / joystick.maxDist;
  joystick.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
}

// 把摇杆输入映射到 keys
function applyJoystickToKeys() {
  const threshold = 0.3;
  keys['w'] = joystick.dy < -threshold;
  keys['s'] = joystick.dy > threshold;
  keys['a'] = joystick.dx < -threshold;
  keys['d'] = joystick.dx > threshold;
}

// ========== 画布自适应 ==========
function resizeCanvas() {
  const wrap = document.getElementById('canvas-wrap');
  if (!wrap || !game.canvas) return;
  const wrapW = wrap.clientWidth;
  const wrapH = wrap.clientHeight;
  // 按宽度缩放，同时不超过高度
  let scale = wrapW / 800;
  if (600 * scale > wrapH) scale = wrapH / 600;
  game.canvasScale = scale;
  game.canvas.style.width = (800 * scale) + 'px';
  game.canvas.style.height = (600 * scale) + 'px';
}

// 把触摸/鼠标坐标转换为画布内部坐标
function getCanvasPos(clientX, clientY) {
  const rect = game.canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left) / game.canvasScale,
    y: (clientY - rect.top) / game.canvasScale,
  };
}

// ========== 玩家类 ==========
class Player {
  constructor(x, y, id, name) {
    this.x = x; this.y = y; this.id = id || 'local'; this.name = name || '玩家';
    this.width = 28; this.height = 28; this.speed = CONFIG.PLAYER_SPEED;
    this.dir = 'down'; this.frame = 0; this.moving = false; this.isLying = false;
    this.color = '#4ecdc4';
  }
  update(keys) {
    if (this.isLying) { this.moving = false; return; }
    let dx = 0, dy = 0;
    if (keys['w'] || keys['arrowup']) { dy = -1; this.dir = 'up'; }
    if (keys['s'] || keys['arrowdown']) { dy = 1; this.dir = 'down'; }
    if (keys['a'] || keys['arrowleft']) { dx = -1; this.dir = 'left'; }
    if (keys['d'] || keys['arrowright']) { dx = 1; this.dir = 'right'; }
    if (dx && dy) { dx *= 0.707; dy *= 0.707; }
    const nx = this.x + dx * this.speed, ny = this.y + dy * this.speed;
    if (!this.checkCollision(nx, this.y)) this.x = nx;
    if (!this.checkCollision(this.x, ny)) this.y = ny;
    this.moving = (dx || dy);
    if (this.moving) this.frame = (this.frame + 0.15) % 4;
  }
  checkCollision(x, y) {
    const hw = this.width / 2, hh = this.height / 2;
    const corners = [{ x: x - hw, y: y - hh }, { x: x + hw, y: y - hh }, { x: x - hw, y: y + hh }, { x: x + hw, y: y + hh }];
    for (const c of corners) {
      const col = Math.floor(c.x / CONFIG.TILE), row = Math.floor(c.y / CONFIG.TILE);
      if (col < 0 || col >= CONFIG.COLS || row < 0 || row >= CONFIG.ROWS) return true;
      const t = game.map[row][col];
      if (t === 1 || t === 2) return true;
    }
    return false;
  }
  isNearBed() {
    const bx = 4 * CONFIG.TILE + 20, by = 6 * CONFIG.TILE + 20;
    return Math.hypot(this.x - bx, this.y - by) < CONFIG.TILE * 1.5;
  }
  draw(ctx, isMe) {
    const x = this.x, y = this.y;
    ctx.font = 'bold 11px Arial'; ctx.textAlign = 'center';
    ctx.fillStyle = isMe ? '#ffd700' : '#aaaacc';
    ctx.fillText(this.name + (isMe ? ' (我)' : ''), x, y - 22);
    ctx.fillStyle = this.isLying ? '#6a6aff' : this.color;
    ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = isMe ? '#ffd700' : '#fff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#fff';
    const eo = this.dir === 'left' ? -4 : this.dir === 'right' ? 4 : 0;
    const ey = this.dir === 'up' ? -3 : this.dir === 'down' ? 3 : 0;
    ctx.beginPath(); ctx.arc(x - 4 + eo, y - 2 + ey, 3, 0, Math.PI * 2); ctx.arc(x + 4 + eo, y - 2 + ey, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(x - 4 + eo, y - 2 + ey, 1.5, 0, Math.PI * 2); ctx.arc(x + 4 + eo, y - 2 + ey, 1.5, 0, Math.PI * 2); ctx.fill();
    if (this.isLying) { ctx.font = '14px Arial'; ctx.fillText('💤', x - 7, y - 30); }
  }
}

// ========== 远程玩家 ==========
class RemotePlayer {
  constructor(id, name) { this.id = id; this.name = name; this.x = 100; this.y = 100; this.dir = 'down'; this.moving = false; this.isLying = false; this.color = '#ff9f43'; }
  updateFromSnapshot(d) { this.x = d.x; this.y = d.y; this.dir = d.dir; this.moving = d.moving; this.isLying = d.isLying; }
  update(keys) {
    if (this.isLying) { this.moving = false; return; }
    let dx = 0, dy = 0;
    if (keys['w'] || keys['arrowup']) { dy = -1; this.dir = 'up'; }
    if (keys['s'] || keys['arrowdown']) { dy = 1; this.dir = 'down'; }
    if (keys['a'] || keys['arrowleft']) { dx = -1; this.dir = 'left'; }
    if (keys['d'] || keys['arrowright']) { dx = 1; this.dir = 'right'; }
    if (dx && dy) { dx *= 0.707; dy *= 0.707; }
    const p = new Player(this.x, this.y, this.id, this.name);
    const nx = this.x + dx * CONFIG.PLAYER_SPEED, ny = this.y + dy * CONFIG.PLAYER_SPEED;
    if (!p.checkCollision(nx, this.y)) this.x = nx;
    if (!p.checkCollision(this.x, ny)) this.y = ny;
    this.moving = (dx || dy);
  }
  isNearBed() {
    const bx = 4 * CONFIG.TILE + 20, by = 6 * CONFIG.TILE + 20;
    return Math.hypot(this.x - bx, this.y - by) < CONFIG.TILE * 1.5;
  }
  draw(ctx) {
    const p = new Player(this.x, this.y, this.id, this.name);
    p.dir = this.dir; p.moving = this.moving; p.isLying = this.isLying; p.color = this.color;
    p.draw(ctx, false);
  }
}

// ========== 建筑 ==========
class Building {
  constructor(type, col, row) {
    const cfg = BUILDINGS[type];
    this.type = type; this.col = col; this.row = row;
    this.x = col * CONFIG.TILE + 20; this.y = row * CONFIG.TILE + 20;
    this.level = 1; this.name = cfg.name; this.icon = cfg.icon;
    if (cfg.damage !== undefined) this.damage = cfg.damage;
    if (cfg.range !== undefined) this.range = cfg.range;
    if (cfg.fireRate !== undefined) this.fireRate = cfg.fireRate;
    if (cfg.income !== undefined) this.income = cfg.income;
    if (cfg.healRate !== undefined) this.healRate = cfg.healRate;
    this.lastFire = 0; this.target = null; this._mineTimer = 0; this._repairTimer = 0;
  }
  update(dt) {
    if (this.type === 'turret' || this.type === 'turret2') {
      this.findTarget();
      if (this.target && Date.now() - this.lastFire >= this.fireRate) { this.fire(); this.lastFire = Date.now(); }
    }
    if (this.type === 'mine') {
      this._mineTimer += dt;
      if (this._mineTimer >= 1000) { game.coins += this.income; game.totalCoinsEarned += this.income; this._mineTimer -= 1000; spawnParticle(this.x, this.y - 10, '+' + this.income, '#ffd700'); }
    }
    if (this.type === 'repair') {
      this._repairTimer += dt;
      if (this._repairTimer >= 1000 && game.doorHp < game.doorMaxHp) { game.doorHp = Math.min(game.doorMaxHp, game.doorHp + this.healRate); this._repairTimer -= 1000; spawnParticle(this.x, this.y - 10, '+' + this.healRate + 'HP', '#4ecdc4'); }
    }
  }
  findTarget() {
    let closest = null, minD = this.range;
    for (const g of game.ghosts) { const d = Math.hypot(g.x - this.x, g.y - this.y); if (d < minD) { minD = d; closest = g; } }
    this.target = closest;
  }
  fire() {
    if (!this.target) return;
    game.bullets.push(new Bullet(this.x, this.y, this.target.x, this.target.y, this.damage, this.type === 'turret2' ? '#ff6b6b' : '#ffd700'));
  }
  upgrade() {
    const cfg = BUILDINGS[this.type];
    if (this.level >= cfg.maxLevel) return false;
    const cost = cfg.upgradeCost(this.level);
    if (game.coins < cost) return false;
    game.coins -= cost; this.level++; cfg.upgrade(this); return true;
  }
  getUpgradeCost() { const cfg = BUILDINGS[this.type]; if (this.level >= cfg.maxLevel) return null; return cfg.upgradeCost(this.level); }
  draw(ctx) {
    ctx.fillStyle = 'rgba(60,60,100,0.6)'; ctx.fillRect(this.col * CONFIG.TILE + 2, this.row * CONFIG.TILE + 2, CONFIG.TILE - 4, CONFIG.TILE - 4);
    ctx.font = '24px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(this.icon, this.x, this.y);
    ctx.font = 'bold 10px Arial'; ctx.fillStyle = '#ffd700'; ctx.fillText('Lv.' + this.level, this.x, this.y + 14);
    if (game.selectedBuilding === this && (this.type === 'turret' || this.type === 'turret2')) {
      ctx.strokeStyle = 'rgba(255,215,0,0.4)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(this.x, this.y, this.range, 0, Math.PI * 2); ctx.stroke();
    }
  }
  toJSON() { return { type: this.type, col: this.col, row: this.row, level: this.level, damage: this.damage, range: this.range, income: this.income, healRate: this.healRate, fireRate: this.fireRate }; }
}

// ========== 子弹 ==========
class Bullet {
  constructor(x, y, tx, ty, damage, color) {
    this.x = x; this.y = y; this.damage = damage; this.color = color; this.speed = 8;
    const a = Math.atan2(ty - y, tx - x);
    this.vx = Math.cos(a) * this.speed; this.vy = Math.sin(a) * this.speed; this.life = 60;
  }
  update() {
    this.x += this.vx; this.y += this.vy; this.life--;
    for (const g of game.ghosts) {
      if (Math.hypot(g.x - this.x, g.y - this.y) < 18) { g.takeDamage(this.damage); spawnParticle(this.x, this.y, '-' + this.damage, '#ff6b6b'); return false; }
    }
    return this.life > 0;
  }
  draw(ctx) {
    ctx.fillStyle = this.color; ctx.beginPath(); ctx.arc(this.x, this.y, 4, 0, Math.PI * 2); ctx.fill();
    ctx.shadowColor = this.color; ctx.shadowBlur = 8; ctx.fill(); ctx.shadowBlur = 0;
  }
}

// ========== 猛鬼 ==========
class Ghost {
  constructor(wave) {
    this.pathIndex = 0; this.x = GHOST_PATH[0].x; this.y = GHOST_PATH[0].y;
    this.maxHp = GHOST.baseHp + GHOST.hpPerWave * (wave - 1); this.hp = this.maxHp;
    this.damage = GHOST.baseDamage + GHOST.damagePerWave * (wave - 1);
    this.speed = GHOST.speed + wave * 0.05; this.attacking = false; this.attackTimer = 0;
    this.wobble = Math.random() * Math.PI * 2;
  }
  update(dt) {
    this.wobble += 0.1;
    if (this.attacking) {
      this.attackTimer += dt;
      if (this.attackTimer >= 1000) {
        game.doorHp -= this.damage; this.attackTimer = 0;
        spawnParticle(game.doorX, game.doorY, '-' + this.damage, '#ff6b6b');
        if (game.doorHp <= 0) { game.doorHp = 0; gameOver(false); }
      }
      return;
    }
    if (this.pathIndex >= GHOST_PATH.length - 1) { this.attacking = true; return; }
    const t = GHOST_PATH[this.pathIndex + 1];
    const dx = t.x - this.x, dy = t.y - this.y, d = Math.hypot(dx, dy);
    if (d < this.speed) { this.x = t.x; this.y = t.y; this.pathIndex++; }
    else { this.x += dx / d * this.speed; this.y += dy / d * this.speed; }
  }
  takeDamage(dmg) {
    this.hp -= dmg;
    if (this.hp <= 0) {
      game.ghostKills++; game.coins += GHOST.reward; game.totalCoinsEarned += GHOST.reward;
      spawnParticle(this.x, this.y, '+' + GHOST.reward + '💰', '#ffd700');
      for (let i = 0; i < 8; i++) game.particles.push({ x: this.x, y: this.y, vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4, life: 30, color: '#c44dff', text: '' });
      return true;
    }
    return false;
  }
  draw(ctx) {
    const wy = Math.sin(this.wobble) * 3, x = this.x, y = this.y + wy;
    ctx.fillStyle = '#8b1a8b';
    ctx.beginPath(); ctx.arc(x, y - 4, 14, Math.PI, 0); ctx.lineTo(x + 14, y + 10);
    for (let i = 0; i < 4; i++) ctx.lineTo(x + 14 - i * 7, y + 10 + (i % 2 === 0 ? 4 : 0));
    ctx.lineTo(x - 14, y + 10); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#c44dff'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#ff0000'; ctx.beginPath(); ctx.arc(x - 5, y - 4, 3, 0, Math.PI * 2); ctx.arc(x + 5, y - 4, 3, 0, Math.PI * 2); ctx.fill();
    const bw = 28, bh = 4;
    ctx.fillStyle = '#333'; ctx.fillRect(x - bw / 2, y - 24, bw, bh);
    ctx.fillStyle = this.hp > this.maxHp * 0.3 ? '#4ecdc4' : '#ff6b6b'; ctx.fillRect(x - bw / 2, y - 24, bw * (this.hp / this.maxHp), bh);
  }
  toJSON() { return { x: this.x, y: this.y, hp: this.hp, maxHp: this.maxHp, attacking: this.attacking, pathIndex: this.pathIndex }; }
}

// ========== 粒子 ==========
function spawnParticle(x, y, text, color) { game.particles.push({ x, y, text, color, life: 50, vy: -1.5 }); }
function updateParticles() { for (let i = game.particles.length - 1; i >= 0; i--) { const p = game.particles[i]; p.y += p.vy; p.life--; if (p.life <= 0) game.particles.splice(i, 1); } }
function drawParticles(ctx) {
  for (const p of game.particles) {
    ctx.globalAlpha = p.life / 50;
    if (p.text) { ctx.font = 'bold 14px Arial'; ctx.fillStyle = p.color; ctx.textAlign = 'center'; ctx.fillText(p.text, p.x, p.y); }
    else { ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
}

// ========== 地图渲染 ==========
function drawMap(ctx) {
  for (let row = 0; row < CONFIG.ROWS; row++) {
    for (let col = 0; col < CONFIG.COLS; col++) {
      const tile = game.map[row][col], x = col * CONFIG.TILE, y = row * CONFIG.TILE;
      if (tile === 1) { ctx.fillStyle = '#3a3a5a'; ctx.fillRect(x, y, CONFIG.TILE, CONFIG.TILE); ctx.strokeStyle = '#2a2a4a'; ctx.strokeRect(x, y, CONFIG.TILE, CONFIG.TILE); }
      else if (tile === 2) { ctx.fillStyle = '#1a1a2e'; ctx.fillRect(x, y, CONFIG.TILE, CONFIG.TILE); ctx.strokeStyle = '#252540'; ctx.strokeRect(x, y, CONFIG.TILE, CONFIG.TILE); }
      else if (tile === 0) { ctx.fillStyle = '#252545'; ctx.fillRect(x, y, CONFIG.TILE, CONFIG.TILE); ctx.strokeStyle = '#2a2a50'; ctx.strokeRect(x, y, CONFIG.TILE, CONFIG.TILE); }
      else if (tile === 3) {
        const r = game.doorHp / game.doorMaxHp;
        ctx.fillStyle = r > 0.5 ? '#8b4513' : r > 0.25 ? '#a0522d' : '#654321'; ctx.fillRect(x + 2, y, CONFIG.TILE - 4, CONFIG.TILE);
        ctx.fillStyle = '#ffd700'; ctx.beginPath(); ctx.arc(x + CONFIG.TILE - 10, y + CONFIG.TILE / 2, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#333'; ctx.fillRect(x, y - 8, CONFIG.TILE, 5);
        ctx.fillStyle = r > 0.3 ? '#4ecdc4' : '#ff6b6b'; ctx.fillRect(x, y - 8, CONFIG.TILE * r, 5);
        ctx.font = 'bold 9px Arial'; ctx.fillStyle = '#ffd700'; ctx.textAlign = 'center'; ctx.fillText('Lv.' + game.doorLevel, x + CONFIG.TILE / 2, y + CONFIG.TILE + 12);
      }
      else if (tile === 4) {
        ctx.fillStyle = '#4a4a6a'; ctx.fillRect(x + 2, y + 4, CONFIG.TILE - 4, CONFIG.TILE - 8);
        ctx.fillStyle = '#6a6a9a'; ctx.fillRect(x + 4, y + 6, CONFIG.TILE - 8, CONFIG.TILE - 16);
        ctx.fillStyle = '#fff'; ctx.fillRect(x + 6, y + 8, 10, 8);
        ctx.font = '14px Arial'; ctx.textAlign = 'center'; ctx.fillText('🛏️', x + CONFIG.TILE / 2, y + CONFIG.TILE / 2 + 5);
        ctx.font = 'bold 9px Arial'; ctx.fillStyle = '#ffd700'; ctx.fillText('Lv.' + game.bedLevel, x + CONFIG.TILE / 2, y + CONFIG.TILE + 12);
      }
      else if (tile === 5) { ctx.fillStyle = 'rgba(139,26,139,0.3)'; ctx.fillRect(x, y, CONFIG.TILE, CONFIG.TILE); ctx.font = '20px Arial'; ctx.textAlign = 'center'; ctx.fillText('💀', x + CONFIG.TILE / 2, y + CONFIG.TILE / 2 + 7); }
    }
  }
  if (game.selectedBuildType && game.mouseX > 0 && (game.mode === 'solo' || game.mode === 'host')) {
    const col = Math.floor(game.mouseX / CONFIG.TILE), row = Math.floor(game.mouseY / CONFIG.TILE);
    if (col >= 0 && col < CONFIG.COLS && row >= 0 && row < CONFIG.ROWS) {
      const ok = canBuildAt(col, row);
      ctx.fillStyle = ok ? 'rgba(78,205,196,0.3)' : 'rgba(255,107,107,0.3)'; ctx.fillRect(col * CONFIG.TILE, row * CONFIG.TILE, CONFIG.TILE, CONFIG.TILE);
      ctx.strokeStyle = ok ? '#4ecdc4' : '#ff6b6b'; ctx.lineWidth = 2; ctx.strokeRect(col * CONFIG.TILE, row * CONFIG.TILE, CONFIG.TILE, CONFIG.TILE);
      if (ok) { ctx.font = '24px Arial'; ctx.textAlign = 'center'; ctx.globalAlpha = 0.6; ctx.fillText(BUILDINGS[game.selectedBuildType].icon, col * CONFIG.TILE + 20, row * CONFIG.TILE + 28); ctx.globalAlpha = 1; }
    }
  }
}

// ========== 建造 ==========
function canBuildAt(col, row) {
  if (col < 0 || col >= CONFIG.COLS || row < 0 || row >= CONFIG.ROWS) return false;
  if (game.map[row][col] !== 0) return false;
  for (const b of game.buildings) if (b.col === col && b.row === row) return false;
  return true;
}
function placeBuilding(col, row, type) {
  const cfg = BUILDINGS[type];
  if (game.coins < cfg.cost) { showToast('金币不足！需要 ' + cfg.cost + ' 💰'); return false; }
  if (!canBuildAt(col, row)) { showToast('这里不能建造！'); return false; }
  game.coins -= cfg.cost; game.buildings.push(new Building(type, col, row)); showToast(cfg.name + ' 建造成功！'); return true;
}

// ========== 波次 ==========
function startWave() {
  game.wave++; game.waveActive = true;
  const pc = game.mode === 'solo' ? 1 : (game.otherPlayers.length + 1);
  game.ghostsToSpawn = Math.ceil((1 + game.wave * 0.8) * (1 + (pc - 1) * 0.4));
  game.ghostSpawnTimer = 0;
  showToast('⚠️ 第 ' + game.wave + ' 波猛鬼来袭！(' + game.ghostsToSpawn + '只)');
}
function updateWave(dt) {
  if (!game.waveActive) { game.waveTimer += dt; if (game.waveTimer >= CONFIG.WAVE_INTERVAL) { game.waveTimer = 0; startWave(); } }
  else {
    if (game.ghostsToSpawn > 0) { game.ghostSpawnTimer += dt; if (game.ghostSpawnTimer >= CONFIG.GHOST_SPAWN_INTERVAL) { game.ghostSpawnTimer = 0; game.ghosts.push(new Ghost(game.wave)); game.ghostsToSpawn--; } }
    if (game.ghostsToSpawn === 0 && game.ghosts.length === 0) {
      game.waveActive = false; game.waveTimer = 0;
      const bonus = 20 + game.wave * 10; game.coins += bonus; game.totalCoinsEarned += bonus;
      showToast('✅ 第 ' + game.wave + ' 波清除！奖励 ' + bonus + ' 💰');
    }
  }
}

// ========== 经济 ==========
function updateEconomy(dt) {
  const lc = getLyingPlayerCount();
  if (lc > 0) {
    game._bedTimer = (game._bedTimer || 0) + dt;
    if (game._bedTimer >= 1000) {
      const income = (BED.baseIncome + BED.incomePerLevel * (game.bedLevel - 1)) * lc;
      game.coins += income; game.totalCoinsEarned += income; game._bedTimer -= 1000;
      if (game.player && game.player.isLying) spawnParticle(game.player.x, game.player.y - 20, '+' + income, '#ffd700');
    }
  }
}
function getLyingPlayerCount() {
  let c = game.player && game.player.isLying ? 1 : 0;
  for (const p of game.otherPlayers) if (p.isLying) c++;
  return c;
}

// ========== 升级 ==========
function upgradeDoor() {
  if (game.doorLevel >= DOOR.maxLevel) { showToast('门已满级！'); return; }
  const cost = DOOR.upgradeCost(game.doorLevel);
  if (game.coins < cost) { showToast('金币不足！需要 ' + cost + ' 💰'); return; }
  game.coins -= cost; game.doorLevel++; game.doorMaxHp = DOOR.baseHp + DOOR.hpPerLevel * (game.doorLevel - 1); game.doorHp = game.doorMaxHp;
  showToast('🚪 门升级到 Lv.' + game.doorLevel + '！');
}
function upgradeBed() {
  if (game.bedLevel >= BED.maxLevel) { showToast('床已满级！'); return; }
  const cost = BED.upgradeCost(game.bedLevel);
  if (game.coins < cost) { showToast('金币不足！需要 ' + cost + ' 💰'); return; }
  game.coins -= cost; game.bedLevel++; showToast('🛏️ 床升级到 Lv.' + game.bedLevel + '！');
}

// ========== 网络模块 ==========
const net = {
  connect() {
    if (game.socket) return;
    game.socket = io();
    game.socket.on('connect', () => { game.mySocketId = game.socket.id; });
    game.socket.on('room-update', (players) => net.updateLobby(players));
    game.socket.on('game-start', () => net.onGameStart());
    game.socket.on('client-input', (data) => { if (game.isHost) game.clientInputs[data.playerId] = data.keys; });
    game.socket.on('client-action', (data) => { if (game.isHost) net.handleClientAction(data); });
    game.socket.on('snapshot', (snap) => { if (!game.isHost) game.latestSnapshot = snap; });
    game.socket.on('player-left', (pid) => { game.otherPlayers = game.otherPlayers.filter(p => p.id !== pid); delete game.clientInputs[pid]; showToast('一位玩家离开了'); });
    game.socket.on('disconnect', () => showToast('⚠️ 与服务器断开连接'));
  },
  createRoom(roomId, playerName) {
    net.connect(); game.roomId = roomId; game.isHost = true; game.playerName = playerName;
    game.socket.emit('join-room', { roomId, playerName });
    showScreen('lobby-screen');
    document.getElementById('lobby-room-id').textContent = roomId;
    document.getElementById('btn-start-game').classList.remove('hidden');
    document.getElementById('btn-ready').classList.add('hidden');
    document.getElementById('lobby-hint').textContent = '你是房主，所有人准备后点击开始游戏';
  },
  joinRoom(roomId, playerName) {
    net.connect(); game.roomId = roomId; game.isHost = false; game.playerName = playerName;
    game.socket.emit('join-room', { roomId, playerName });
    showScreen('lobby-screen');
    document.getElementById('lobby-room-id').textContent = roomId;
    document.getElementById('btn-start-game').classList.add('hidden');
    document.getElementById('btn-ready').classList.remove('hidden');
    document.getElementById('lobby-hint').textContent = '等待房主开始游戏...';
  },
  updateLobby(players) {
    document.getElementById('lobby-players').innerHTML = players.map(p =>
      `<div class="lobby-player-row ${p.id === game.mySocketId ? 'is-host' : ''}">
        <span class="lobby-player-name">${p.name}${p.id === game.mySocketId ? '<span class="host-tag">(我)</span>' : ''}</span>
        <span class="lobby-player-status ${p.ready ? 'ready' : 'not-ready'}">${p.ready ? '✅ 已准备' : '⏳ 未准备'}</span>
      </div>`).join('');
  },
  toggleReady() { game.socket.emit('toggle-ready', { roomId: game.roomId }); },
  startGame() { game.socket.emit('start-game', { roomId: game.roomId }); },
  leaveRoom() { if (game.socket) { game.socket.disconnect(); game.socket = null; } game.isHost = false; game.otherPlayers = []; game.clientInputs = {}; showScreen('start-screen'); },
  onGameStart() {
    game.mode = game.isHost ? 'host' : 'client';
    document.getElementById('lobby-screen').classList.add('hidden');
    document.getElementById('game-container').classList.remove('hidden');
    initGame();
  },
  sendInput(keys) { if (!game.socket || game.isHost) return; game.socket.emit('client-input', { playerId: game.mySocketId, keys }); },
  sendAction(action, data) {
    if (!game.socket) return;
    if (game.isHost) net.handleClientAction({ playerId: game.mySocketId, action, data });
    else game.socket.emit('client-action', { playerId: game.mySocketId, action, data });
  },
  handleClientAction(data) {
    const { action, data: payload } = data;
    if (action === 'lie') {
      const p = net.getPlayerById(data.playerId);
      if (p && p.isNearBed()) { p.isLying = !p.isLying; if (p.isLying) { p.x = 4 * CONFIG.TILE + 20; p.y = 6 * CONFIG.TILE + 20; } }
    } else if (action === 'build') { placeBuilding(payload.col, payload.row, payload.type); }
    else if (action === 'upgradeDoor') upgradeDoor();
    else if (action === 'upgradeBed') upgradeBed();
    else if (action === 'upgradeBuilding') { const b = game.buildings[payload.index]; if (b && b.upgrade()) showToast(b.name + ' 升级到 Lv.' + b.level + '！'); }
  },
  getPlayerById(id) { if (game.player && game.player.id === id) return game.player; return game.otherPlayers.find(p => p.id === id); },
  broadcastSnapshot() {
    if (!game.socket || !game.isHost) return;
    const snap = {
      t: Date.now(),
      players: [
        { id: game.player.id, name: game.player.name, x: game.player.x, y: game.player.y, dir: game.player.dir, moving: game.player.moving, isLying: game.player.isLying },
        ...game.otherPlayers.map(p => ({ id: p.id, name: p.name, x: p.x, y: p.y, dir: p.dir, moving: p.moving, isLying: p.isLying })),
      ],
      buildings: game.buildings.map(b => b.toJSON()),
      ghosts: game.ghosts.map(g => g.toJSON()),
      bullets: game.bullets.map(b => ({ x: b.x, y: b.y, color: b.color })),
      coins: game.coins, doorHp: game.doorHp, doorMaxHp: game.doorMaxHp, doorLevel: game.doorLevel,
      bedLevel: game.bedLevel, wave: game.wave, ghostKills: game.ghostKills, waveActive: game.waveActive, gameOver: false,
    };
    game.socket.emit('snapshot', snap);
    game.latestSnapshot = snap;
  },
  applySnapshot() {
    const snap = game.latestSnapshot;
    if (!snap) return;
    game.coins = snap.coins; game.doorHp = snap.doorHp; game.doorMaxHp = snap.doorMaxHp;
    game.doorLevel = snap.doorLevel; game.bedLevel = snap.bedLevel; game.wave = snap.wave;
    game.ghostKills = snap.ghostKills; game.waveActive = snap.waveActive;
    const myId = game.mySocketId;
    for (const pd of snap.players) {
      if (pd.id === myId) { if (game.player) { game.player.x = pd.x; game.player.y = pd.y; game.player.dir = pd.dir; game.player.moving = pd.moving; game.player.isLying = pd.isLying; } }
      else {
        let rp = game.otherPlayers.find(p => p.id === pd.id);
        if (!rp) { rp = new RemotePlayer(pd.id, pd.name); game.otherPlayers.push(rp); }
        rp.name = pd.name; rp.updateFromSnapshot(pd);
      }
    }
    game.otherPlayers = game.otherPlayers.filter(p => snap.players.some(sp => sp.id === p.id));
    game.buildings = snap.buildings.map(bd => { const b = new Building(bd.type, bd.col, bd.row); b.level = bd.level; b.damage = bd.damage; b.range = bd.range; b.income = bd.income; b.healRate = bd.healRate; b.fireRate = bd.fireRate; return b; });
    game.ghosts = snap.ghosts.map(gd => { const g = { x: gd.x, y: gd.y, hp: gd.hp, maxHp: gd.maxHp, attacking: gd.attacking, pathIndex: gd.pathIndex, wobble: Date.now() / 200, update() {}, takeDamage() { return false; }, draw: Ghost.prototype.draw }; return g; });
    game.bullets = snap.bullets.map(bd => ({ x: bd.x, y: bd.y, color: bd.color, update() { return true; }, draw: Bullet.prototype.draw }));
  },
};

// ========== UI ==========
function updateHUD() {
  document.getElementById('hud-coins').textContent = Math.floor(game.coins);
  document.getElementById('hud-wave').textContent = game.wave;
  document.getElementById('hud-door-hp').textContent = Math.ceil(game.doorHp);
  document.getElementById('hud-ghost-count').textContent = game.ghosts.length;
  const lc = getLyingPlayerCount();
  document.getElementById('hud-status').textContent = lc > 0 ? `😴${lc}人` : '🏃';
  const lieBtn = document.getElementById('btn-lie');
  lieBtn.classList.toggle('active', game.player && game.player.isLying);
  if (game.mode === 'client' || game.mode === 'host') {
    const bar = document.getElementById('online-players-bar');
    bar.classList.remove('hidden');
    const all = [{ name: game.playerName, isLying: game.player?.isLying, isMe: true }, ...game.otherPlayers.map(p => ({ name: p.name, isLying: p.isLying, isMe: false }))];
    bar.innerHTML = all.map(p => `<div class="op-row"><span class="op-name">${p.isMe ? '⭐' : ''}${p.name}</span><span class="op-state">${p.isLying ? '💤' : '🏃'}</span></div>`).join('');
  }
}

function showToast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(t._timer); t._timer = setTimeout(() => t.classList.add('hidden'), 2000); }
function showScreen(id) { document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden')); document.getElementById(id).classList.remove('hidden'); }

function showUpgradePanel() {
  const panel = document.getElementById('upgrade-panel'), content = document.getElementById('upgrade-content');
  let html = '';
  const doorCost = game.doorLevel >= DOOR.maxLevel ? null : DOOR.upgradeCost(game.doorLevel);
  html += `<div class="upgrade-row"><div class="upgrade-info"><div class="upgrade-name">🚪 门</div><div class="upgrade-level">Lv.${game.doorLevel} HP:${game.doorMaxHp}</div></div>${doorCost === null ? '<button class="upgrade-btn maxed" disabled>满级</button>' : `<button class="upgrade-btn" onclick="doUpgrade('door')">💰${doorCost}</button>`}</div>`;
  const bedCost = game.bedLevel >= BED.maxLevel ? null : BED.upgradeCost(game.bedLevel);
  html += `<div class="upgrade-row"><div class="upgrade-info"><div class="upgrade-name">🛏️ 床</div><div class="upgrade-level">Lv.${game.bedLevel}</div></div>${bedCost === null ? '<button class="upgrade-btn maxed" disabled>满级</button>' : `<button class="upgrade-btn" onclick="doUpgrade('bed')">💰${bedCost}</button>`}</div>`;
  if (game.selectedBuilding) {
    const b = game.selectedBuilding, bCost = b.getUpgradeCost();
    const idx = game.buildings.indexOf(b);
    html += `<div class="upgrade-row"><div class="upgrade-info"><div class="upgrade-name">${b.icon}${b.name}</div><div class="upgrade-level">Lv.${b.level}</div></div>${bCost === null ? '<button class="upgrade-btn maxed" disabled>满级</button>' : `<button class="upgrade-btn" onclick="doUpgrade('building',${idx})">💰${bCost}</button>`}</div>`;
  }
  content.innerHTML = html; panel.classList.remove('hidden');
}

function doUpgrade(type, idx) {
  if (game.mode === 'client') { net.sendAction('upgrade' + type.charAt(0).toUpperCase() + type.slice(1), idx !== undefined ? { index: idx } : {}); return; }
  if (type === 'door') upgradeDoor();
  else if (type === 'bed') upgradeBed();
  else if (type === 'building') { const b = game.buildings[idx]; if (b && b.upgrade()) showToast(b.name + ' 升级！'); }
  showUpgradePanel();
}

// ========== 初始化 ==========
function initGame() {
  game.canvas = document.getElementById('game-canvas'); game.ctx = game.canvas.getContext('2d');
  game.map = MAP_TEMPLATE.map(r => [...r]);
  game.buildings = []; game.bullets = []; game.ghosts = []; game.particles = [];
  game.coins = 50; game.totalCoinsEarned = 0; game.wave = 0; game.ghostKills = 0;
  game.doorLevel = 1; game.bedLevel = 1; game.doorMaxHp = DOOR.baseHp; game.doorHp = DOOR.baseHp;
  game.waveActive = false; game.waveTimer = 0; game.selectedBuildType = null; game.selectedBuilding = null;
  game._bedTimer = 0; game._snapshotTimer = 0; game._inputTimer = 0;
  game.doorX = 8 * CONFIG.TILE + 20; game.doorY = 6 * CONFIG.TILE + 20;
  const spawnIdx = game.isHost ? 0 : Math.min(game.otherPlayers.length, CONFIG.MAX_PLAYERS - 1);
  const spawn = PLAYER_SPAWNS[spawnIdx];
  game.player = new Player(spawn.x, spawn.y, game.mySocketId || 'local', game.playerName);
  if (game.mode === 'client') game.otherPlayers = [];
  game.running = true; game.paused = false; game.lastTime = performance.now();
  resizeCanvas();
  initJoystick();
  requestAnimationFrame(gameLoop);
  showToast(game.mode === 'solo' ? '💡 左下摇杆移动，靠近床点🛏️躺平' : '💡 联机合作：多人同时躺平产金更快');
}

function gameOver(win) {
  if (!game.running) return;
  game.running = false;
  document.getElementById('gameover-title').textContent = win ? '🎉 胜利！' : '💀 门被攻破了！';
  document.getElementById('gameover-title').style.color = win ? '#4ecdc4' : '#ff6b6b';
  document.getElementById('result-wave').textContent = game.wave;
  document.getElementById('result-coins').textContent = Math.floor(game.totalCoinsEarned);
  document.getElementById('result-kills').textContent = game.ghostKills;
  document.getElementById('gameover-screen').classList.remove('hidden');
  document.getElementById('game-container').classList.add('hidden');
  document.getElementById('online-players-bar').classList.add('hidden');
  if (game.socket) { game.socket.disconnect(); game.socket = null; }
}

// ========== 主循环 ==========
function gameLoop(timestamp) {
  if (!game.running) return;
  const dt = Math.min(timestamp - game.lastTime, 100); game.lastTime = timestamp;
  if (!game.paused) {
    applyJoystickToKeys();
    if (game.mode === 'solo' || game.mode === 'host') {
      game.player.update(keys);
      if (game.mode === 'host') for (const p of game.otherPlayers) p.update(game.clientInputs[p.id] || {});
      updateEconomy(dt); updateWave(dt);
      for (const b of game.buildings) b.update(dt);
      for (let i = game.ghosts.length - 1; i >= 0; i--) { game.ghosts[i].update(dt); if (game.ghosts[i].hp <= 0) game.ghosts.splice(i, 1); }
      game.bullets = game.bullets.filter(b => b.update());
      updateParticles();
      if (game.mode === 'host') { game._snapshotTimer += dt; if (game._snapshotTimer >= CONFIG.SNAPSHOT_INTERVAL) { net.broadcastSnapshot(); game._snapshotTimer = 0; } }
    } else if (game.mode === 'client') {
      game._inputTimer += dt;
      if (game._inputTimer >= CONFIG.INPUT_INTERVAL) { net.sendInput(keys); game._inputTimer = 0; }
      net.applySnapshot(); updateParticles();
    }
    updateHUD();
  }
  const ctx = game.ctx;
  ctx.clearRect(0, 0, game.canvas.width, game.canvas.height);
  drawMap(ctx);
  for (const b of game.buildings) b.draw(ctx);
  for (const g of game.ghosts) g.draw(ctx);
  for (const b of game.bullets) b.draw(ctx);
  for (const p of game.otherPlayers) p.draw(ctx);
  if (game.player) game.player.draw(ctx, true);
  drawParticles(ctx);
  if (game.paused) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, game.canvas.width, game.canvas.height); ctx.font = 'bold 36px Arial'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText('⏸️ 已暂停', game.canvas.width / 2, game.canvas.height / 2); }
  requestAnimationFrame(gameLoop);
}

// ========== 输入（键盘+PC鼠标备用） ==========
const keys = {};
document.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase(); keys[key] = true;
  if (!game.running) return;
  if (key === 'e') doLieAction();
  if (key === 'b' && (game.mode === 'solo' || game.mode === 'host')) toggleBuildMenu();
  if (key === 'u') showUpgradePanel();
  if (key === 'escape') closeAllMenus();
  if (key === 'p' || key === ' ') { e.preventDefault(); game.paused = !game.paused; }
});
document.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

// ========== 触摸画布（建造/选中） ==========
function initCanvasTouch() {
  const canvas = document.getElementById('game-canvas');
  if (!canvas) return;
  const onTouch = (e) => {
    if (!game.running || game.paused) return;
    if (game.mode === 'client') return; // 客户端不能建造
    e.preventDefault();
    const t = e.touches ? e.touches[0] : e;
    const pos = getCanvasPos(t.clientX, t.clientY);
    game.mouseX = pos.x; game.mouseY = pos.y;
    const col = Math.floor(pos.x / CONFIG.TILE), row = Math.floor(pos.y / CONFIG.TILE);
    if (game.selectedBuildType) {
      if (placeBuilding(col, row, game.selectedBuildType)) {
        // 保持建造模式
      }
    } else {
      let found = null;
      for (const b of game.buildings) if (b.col === col && b.row === row) { found = b; break; }
      game.selectedBuilding = found;
      if (found) showUpgradePanel(); else document.getElementById('upgrade-panel').classList.add('hidden');
    }
  };
  canvas.addEventListener('touchstart', onTouch, { passive: false });
  canvas.addEventListener('mousedown', onTouch);
}

// ========== 动作 ==========
function doLieAction() {
  if (!game.player) return;
  if (game.mode === 'client') { net.sendAction('lie'); return; }
  if (game.player.isNearBed()) {
    game.player.isLying = !game.player.isLying;
    if (game.player.isLying) { game.player.x = 4 * CONFIG.TILE + 20; game.player.y = 6 * CONFIG.TILE + 20; showToast('😴 开始躺平发育！'); }
    else showToast('🏃 起床了！');
  } else showToast('需要靠近床才能躺平！');
}

function toggleBuildMenu() {
  const m = document.getElementById('build-menu');
  m.classList.toggle('hidden');
  document.getElementById('upgrade-panel').classList.add('hidden');
  game.selectedBuildType = null;
}
function closeAllMenus() {
  document.getElementById('build-menu').classList.add('hidden');
  document.getElementById('upgrade-panel').classList.add('hidden');
  game.selectedBuildType = null; game.selectedBuilding = null;
}

document.querySelectorAll('.build-item').forEach(item => {
  item.addEventListener('click', () => {
    game.selectedBuildType = item.dataset.type; game.selectedBuilding = null;
    document.getElementById('build-menu').classList.add('hidden');
    showToast('点击空地放置 ' + BUILDINGS[game.selectedBuildType].name);
  });
});

// ========== 界面按钮绑定 ==========
document.getElementById('btn-solo').addEventListener('click', () => {
  game.playerName = document.getElementById('player-name').value.trim() || '玩家';
  game.mode = 'solo'; game.isHost = false;
  document.getElementById('start-screen').classList.add('hidden');
  document.getElementById('game-container').classList.remove('hidden');
  initGame();
});

document.getElementById('btn-online').addEventListener('click', () => {
  game.playerName = document.getElementById('player-name').value.trim() || '玩家';
  showScreen('online-screen');
});

document.getElementById('tab-create').addEventListener('click', () => {
  document.getElementById('tab-create').classList.add('active'); document.getElementById('tab-join').classList.remove('active');
  document.getElementById('create-panel').classList.remove('hidden'); document.getElementById('join-panel').classList.add('hidden');
});
document.getElementById('tab-join').addEventListener('click', () => {
  document.getElementById('tab-join').classList.add('active'); document.getElementById('tab-create').classList.remove('active');
  document.getElementById('join-panel').classList.remove('hidden'); document.getElementById('create-panel').classList.add('hidden');
});

function genRoomId() { return Math.random().toString(36).substring(2, 6).toUpperCase(); }

document.getElementById('btn-create-room').addEventListener('click', () => {
  let roomId = document.getElementById('create-room-id').value.trim().toUpperCase();
  if (!roomId) roomId = genRoomId();
  net.createRoom(roomId, game.playerName);
});
document.getElementById('btn-join-room').addEventListener('click', () => {
  const roomId = document.getElementById('join-room-id').value.trim().toUpperCase();
  if (!roomId) { showOnlineError('请输入房间号'); return; }
  net.joinRoom(roomId, game.playerName);
});
document.getElementById('btn-online-back').addEventListener('click', () => showScreen('start-screen'));
function showOnlineError(msg) { const e = document.getElementById('online-error'); e.textContent = msg; e.classList.remove('hidden'); setTimeout(() => e.classList.add('hidden'), 3000); }

document.getElementById('btn-ready').addEventListener('click', () => {
  net.toggleReady();
  const btn = document.getElementById('btn-ready');
  btn.textContent = btn.textContent === '准备' ? '取消准备' : '准备';
});
document.getElementById('btn-start-game').addEventListener('click', () => net.startGame());
document.getElementById('btn-leave-room').addEventListener('click', () => net.leaveRoom());

// 游戏内圆形按钮
document.getElementById('btn-lie').addEventListener('click', doLieAction);
document.getElementById('btn-build').addEventListener('click', () => {
  if (game.mode === 'client') { showToast('联机模式下只有房主可以建造'); return; }
  toggleBuildMenu();
});
document.getElementById('btn-upgrade').addEventListener('click', showUpgradePanel);
document.getElementById('btn-pause').addEventListener('click', () => { game.paused = !game.paused; });
document.getElementById('btn-cancel-build').addEventListener('click', () => {
  game.selectedBuildType = null;
  document.getElementById('build-menu').classList.add('hidden');
});
document.getElementById('btn-close-upgrade').addEventListener('click', () => {
  document.getElementById('upgrade-panel').classList.add('hidden'); game.selectedBuilding = null;
});

document.getElementById('btn-restart').addEventListener('click', () => {
  document.getElementById('gameover-screen').classList.add('hidden');
  document.getElementById('game-container').classList.remove('hidden');
  game.mode = 'solo'; initGame();
});
document.getElementById('btn-home').addEventListener('click', () => {
  document.getElementById('gameover-screen').classList.add('hidden'); showScreen('start-screen');
});

// 窗口大小变化时重新计算画布
window.addEventListener('resize', () => { if (game.running) resizeCanvas(); });
window.addEventListener('orientationchange', () => { setTimeout(resizeCanvas, 300); });

// 初始化画布触摸
initCanvasTouch();

window.doUpgrade = doUpgrade;
console.log('🎮 躺平发育（手机版）已加载');
