// ============================================
// 躺平发育 - 后端服务（手机版，无数据库）
// 功能：静态文件托管 + Socket.IO 联机房间
// ============================================

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

// ---------- Express 应用 ----------
const app = express();
app.use(cors());
app.use(express.json())；
app.use(express.static(__dirname));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));


// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ---------- Socket.IO（联机合作模式） ----------
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const rooms = new Map();

io.on('connection', (socket) => {
  console.log('玩家连接:', socket.id);
  socket.joinedRooms = [];

  socket.on('join-room', ({ roomId, playerName }) => {
    socket.join(roomId);
    socket.joinedRooms.push(roomId);
    if (!rooms.has(roomId)) rooms.set(roomId, { players: [], host: socket.id });
    const room = rooms.get(roomId);
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
    room.players.forEach(p => p.ready = false);
    io.to(roomId).emit('game-start');
    console.log(`房间 ${roomId} 游戏开始`);
  });

  socket.on('client-input', (data) => {
    const { roomId } = findPlayerRoom(socket.id);
    if (roomId) socket.to(roomId).emit('client-input', data);
  });

  socket.on('client-action', (data) => {
    const { roomId } = findPlayerRoom(socket.id);
    if (roomId) socket.to(roomId).emit('client-action', data);
  });

  socket.on('snapshot', (snap) => {
    const { roomId } = findPlayerRoom(socket.id);
    if (roomId) socket.to(roomId).emit('snapshot', snap);
  });

  socket.on('game-action', ({ roomId, action, data }) => {
    socket.to(roomId).emit('game-action', { action, data, playerId: socket.id });
  });

  socket.on('disconnect', () => {
    for (const roomId of socket.joinedRooms) {
      const room = rooms.get(roomId);
      if (!room) continue;
      const leftPlayer = room.players.find(p => p.id === socket.id);
      room.players = room.players.filter((p) => p.id !== socket.id);
      socket.to(roomId).emit('player-left', socket.id);
      io.to(roomId).emit('room-update', room.players);
      if (leftPlayer) console.log(`玩家 ${leftPlayer.name} 离开房间 ${roomId}`);
      if (room.host === socket.id && room.players.length > 0) {
        room.host = room.players[0].id;
      }
      if (room.players.length === 0) rooms.delete(roomId);
    }
    console.log('玩家断开:', socket.id);
  });
});

function findPlayerRoom(socketId) {
  for (const [roomId, room] of rooms) {
    if (room.players.find(p => p.id === socketId)) return { roomId, room };
  }
  return { roomId: null, room: null };
}

// ---------- 启动 ----------
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🎮 躺平发育（手机版）已启动`);
  console.log(`   访问: http://localhost:${PORT}\n`);
});
