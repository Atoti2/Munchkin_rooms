const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const { Server } = require("socket.io");
const { PrismaClient } = require('@prisma/client');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

app.use(cors());

const prisma = new PrismaClient();

io.on('connection', (socket) => {
  console.log('New player connected');

  socket.on("join_room", async ({ room, name, level, gear }) => {
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

    const players = await prisma.player.findMany({
      where: { room },
    });

    socket.emit('initial_data', players);
    socket.to(room).emit('receive_changes', { name, level, gear });
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
  
      const players = await prisma.player.findMany({
        where: { room },
      });
  
      socket.to(room).emit('initial_data', players);
  
    } catch (error) {
      console.error('Error processing player leave:', error);
      socket.emit('error', 'An error occurred while processing player leave.');
    }
  });
});

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../client/munchkin/dist')));

// Catch-all handler to serve the React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/munchkin/dist', 'index.html'));
});

server.listen(3001, () => {
  console.log('listening on *:3001');
});
