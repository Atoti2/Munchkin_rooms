// index.js

const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { PrismaClient } = require('@prisma/client');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

const prisma = new PrismaClient();

io.on('connection', (socket) => {
  console.log('New player connected');

  socket.on('join_room', async ({ room, name, level, gear }) => {
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
      console.error('Error processing join_room:', error);
      socket.emit('error', 'An error occurred while joining the room.');
    }
  });

  socket.on('send_changes', async (data) => {
    const { level, gear, room, name } = data;

    try {
      await prisma.player.update({
        where: { name },
        data: { level, gear, room }
      });

      socket.to(room).emit('receive_changes', data);
      console.log(data);
    } catch (error) {
      console.error('Error processing send_changes:', error);
      socket.emit('error', 'An error occurred while sending changes.');
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
      console.error('Error processing leave_room:', error);
      socket.emit('error', 'An error occurred while leaving the room.');
    }
  });
});

server.listen(process.env.PORT || 3001, () => {
  console.log('Server is listening on port 3001');
});
