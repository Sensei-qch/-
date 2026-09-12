// ============================================
// 躺平发育 - 后端服务
// 功能：静态文件托管 + API + Socket.IO + Turso数据库
// ============================================

require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

// ---------- Turso 数据库 ----------
let db = null;
async function initDB() {
  if (!process.env.TURSO_DATABASE_URL) {
    console.log('⚠️  未配置 TURSO_DATABASE_URL，数据库功能暂不可用（游戏仍可正常玩）');
    return;
  }
  try {
    const { createClient } = require('@libsql/client');
    db = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    // 建表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS players (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        highest_wave INTEGER DEFAULT 0,
        total_coins INTEGER DEFAULT 0,
        games_played INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS game_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_name TEXT NOT NULL,
        wave_reached INTEGER NOT NULL,
        coins_earned INTEGER NOT NULL,
        result TEXT NOT NULL,
        played_at TEXT DEFAULT (datetime('now'))
      )
    `);
    console.log('✅ Turso 数据库连接成功');
  } catch (e) {
    console.error('❌ Turso 数据库连接失败:', e.message);
    console.log('   游戏仍可正常运行，只是存档/排行榜不可用');
  }
}

// ---------- Express 应用 ----------
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- API 路由 ----------

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', db: db ? 'connected' : 'disabled' });
});

// 获取排行榜
app.get('/api/leaderboard', async (req, res) => {
  if (!db) return res.json({ list: [] });
  try {
    const rs = await db.execute(
      'SELECT name, highest_wave, games_played FROM players ORDER BY highest_wave DESC LIMIT 20'
    );
    res.json({ list: rs.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 注册/获取玩家
app.post('/api/player', async (req, res) => {
  if (!db) return res.json({ id: 0, name: req.body.name || '游客', highest_wave: 0 });
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: '名字不能为空' });
  try {
    await db.execute({ sql: 'INSERT OR IGNORE INTO players (name) VALUES (?)', args: [name] });
    const rs = await db.execute({ sql: 'SELECT * FROM players WHERE name = ?', args: [name] });
    res.json(rs.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 提交游戏记录
app.post('/api/record', async (req, res) => {
  if (!db) return res.json({ saved: false, reason: 'db disabled' });
  const { player_name, wave_reached, coins_earned, result } = req.body;
  try {
    await db.execute({
      sql: 'INSERT INTO game_records (player_name, wave_reached, coins_earned, result) VALUES (?, ?, ?, ?)',
      args: [player_name, wave_reached, coins_earned, result],
    });
    await db.execute({
      sql: `UPDATE players SET 
              highest_wave = MAX(highest_wave, ?),
              total_coins = total_coins + ?,
              games_played = games_played + 1
            WHERE name = ?`,
      args: [wave_reached, coins_earned, player_name],
    });
    res.json({ saved: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- Socket.IO（联机合作模式） ----------
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const rooms = new Map(); // roomId -> { players: [], host: socketId }

io.on('connection', (socket) => {
  console.log('玩家连接:', socket.id);
  socket.joinedRooms = [];

  socket.on('join-room', ({ roomId, playerName }) => {
    socket.join(roomId);
    socket.joinedRooms.push(roomId);
    if (!rooms.has(roomId)) rooms.set(roomId, { players: [], host: socket.id });
    const room = rooms.get(roomId);
    // 防止重复加入
    if (!room.players.find(p => p.id === socket.id)) {
      room.players.push({ id: socket.id, name: playerName, ready: false });
    }
    io.to(roomId).emit('room-update', room.players);
    console.log(`玩家 ${playerName} 加入房间 ${roomId}，当前 ${room.players.length} 人`);
  });

  socket.on('toggle-ready', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const p = room.players.find((x) => x.id === socket.id);
    if (p) p.ready = !p.ready;
    io.to(roomId).emit('room-update', room.players);
  });

  socket.on('start-game', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    // 重置准备状态
    room.players.forEach(p => p.ready = false);
    io.to(roomId).emit('game-start');
    console.log(`房间 ${roomId} 游戏开始`);
  });

  // 客户端输入（按键状态）→ 转发给房间内其他人（房主用）
  socket.on('client-input', (data) => {
    const { roomId } = findPlayerRoom(socket.id);
    if (roomId) socket.to(roomId).emit('client-input', data);
  });

  // 客户端动作（躺平/建造/升级）→ 转发给房间内其他人（房主执行）
  socket.on('client-action', (data) => {
    const { roomId } = findPlayerRoom(socket.id);
    if (roomId) socket.to(roomId).emit('client-action', data);
  });

  // 房主广播游戏快照 → 转发给房间内其他人（客户端渲染）
  socket.on('snapshot', (snap) => {
    const { roomId } = findPlayerRoom(socket.id);
    if (roomId) socket.to(roomId).emit('snapshot', snap);
  });

  // 兼容旧的通用动作事件
  socket.on('game-action', ({ roomId, action, data }) => {
    socket.to(roomId).emit('game-action', { action, data, playerId: socket.id });
  });

  socket.on('disconnect', () => {
    for (const roomId of socket.joinedRooms) {
      const room = rooms.get(roomId);
      if (!room) continue;
      const leftPlayer = room.players.find(p => p.id === socket.id);
      room.players = room.players.filter((p) => p.id !== socket.id);
      // 通知房间内其他人
      socket.to(roomId).emit('player-left', socket.id);
      io.to(roomId).emit('room-update', room.players);
      if (leftPlayer) console.log(`玩家 ${leftPlayer.name} 离开房间 ${roomId}`);
      // 如果房主离开，转让给第一个人
      if (room.host === socket.id && room.players.length > 0) {
        room.host = room.players[0].id;
        console.log(`房间 ${roomId} 房主转让给 ${room.players[0].name}`);
      }
      if (room.players.length === 0) rooms.delete(roomId);
    }
    console.log('玩家断开:', socket.id);
  });
});

// 辅助：根据 socketId 找所在房间
function findPlayerRoom(socketId) {
  for (const [roomId, room] of rooms) {
    if (room.players.find(p => p.id === socketId)) return { roomId, room };
  }
  return { roomId: null, room: null };
}

// ---------- 启动 ----------
const PORT = process.env.PORT || 3000;
initDB().then(() => {
  server.listen(PORT, () => {
    console.log(`\n🎮 躺平发育服务器已启动`);
    console.log(`   本地访问: http://localhost:${PORT}`);
    console.log(`   数据库: ${db ? 'Turso 已连接' : '未配置（单机模式）'}\n`);
  });
});
