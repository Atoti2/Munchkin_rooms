const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');

const { Server } = require("socket.io");
const { PrismaClient } = require('@prisma/client');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", // Ensure no trailing slash here
    methods: ["GET", "POST"]
  }
});

app.use(cors({
  origin: "*", // Ensure no trailing slash here
  methods: ["GET", "POST"]
}));

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'default-src': ["'self'"],
      'script-src': [
        "'self'",
        "'unsafe-inline'",
        "https://cdn.example.com",
        "https://munchkin-rooms.vercel.app"
      ],
      'style-src': [
        "'self'",
        "'unsafe-inline'",
        "https://cdn.example.com",
        "https://munchkin-rooms.vercel.app"
      ],
      'img-src': [
        "'self'",
        "data:",
        "https://munchkin-rooms.vercel.app"
      ],
      'connect-src': [
        "'self'",
        "wss://munchkin-rooms.vercel.app" // Secure WebSocket for production
      ],
      'font-src': ["'self'"],
      'object-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
    },
  },
}));

const prisma = new PrismaClient();

io.on('connection', (socket) => {
  console.log('New player connected');

  socket.on("join_room", async ({ room, name, level, gear }) => {
    try {
      const playerCount = await prisma.player.count({ where: { room } });

      if (playerCount >= 6) {
        socket.emit('room_full');
        return;
      }

      socket.join(room);
      console.log(`Player ${name} joined room: ${room}`);

      await prisma.player.upsert({
        where: { name },
        update: { level, gear, room },
        create: { name, level, gear, room }
      });

      const players = await prisma.player.findMany({ where: { room } });
      socket.emit('initial_data', players);
      socket.to(room).emit('receive_changes', { name, level, gear });
    } catch (error) {
      console.error('Error in join_room:', error);
      socket.emit('error', 'An error occurred while joining the room.');
    }
  });

  socket.on('send_changes', async (data) => {
    const { level, gear, room, name } = data;

    try {
      await prisma.player.update({
        where: { name },
        data: { level, gear, room },
      });

      socket.to(room).emit('receive_changes', data);
      console.log(data);
    } catch (error) {
      console.error('Error processing player changes:', error);
      socket.emit('error', 'An error occurred while processing player changes.');
    }
  });

  socket.on('leave_room', async (data) => {
    const { room, name } = data;

    try {
      socket.leave(room);
      console.log(`Player ${name} left room: ${room}`);

      await prisma.player.delete({ where: { name } });
      socket.to(room).emit('player_left', name);

      const players = await prisma.player.findMany({ where: { room } });
      socket.to(room).emit('initial_data', players);
    } catch (error) {
      console.error('Error processing player leave:', error);
      socket.emit('error', 'An error occurred while processing player leave.');
    }
  });
});

app.use(express.static(path.join(__dirname, '../client/munchkin/dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/munchkin', 'index.html'));
});

server.listen(3001, () => {
  console.log('listening on *:3001');
});
