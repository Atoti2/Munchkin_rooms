const express = require('express');
const http = require('http');
const cors = require('cors');
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
    // Check the number of players in the room
    const playerCount = await prisma.player.count({ where: { room } });
    
    if (playerCount >= 6) {
      // Notify the player that the room is full
      socket.emit('room_full');
      return;
    }

    // Add player to the room
    socket.join(room);
    console.log(`Player ${name} joined room: ${room}`);

    // Add or update player data
    await prisma.player.upsert({
      where: { name },
      update: { level, gear, room },
      create: { name, level, gear, room }
    });

    // Retrieve existing player data for the room
    const players = await prisma.player.findMany({
      where: { room },
    });

    // Emit existing player data to the new player
    socket.emit('initial_data', players);

    // Broadcast the changes to the room
    socket.to(room).emit('receive_changes', { name, level, gear });
  });

  socket.on('send_changes', async (data) => {
    const { level, gear, room, name } = data;

    try {
      // Update player data
      await prisma.player.update({
        where: { name },
        data: { level, gear, room },
      });

      // Broadcast the changes to the room
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
      // Remove player from the room
      socket.leave(room);
      console.log(`Player ${name} left room: ${room}`);
  
      // Remove player data from the database
      await prisma.player.delete({ where: { name } });
  
      // Notify other players in the room
      socket.to(room).emit('player_left', name);
  
      // Retrieve updated player data for the room
      const players = await prisma.player.findMany({
        where: { room },
      });
  
      // Emit updated player data to the remaining players
      socket.to(room).emit('initial_data', players);
  
    } catch (error) {
      console.error('Error processing player leave:', error);
      socket.emit('error', 'An error occurred while processing player leave.');
    }
  });
});

server.listen(3001, () => {
  console.log('listening on *:3001');
});
