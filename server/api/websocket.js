const WebSocket = require('ws');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const wsHandler = (req, res) => {
  if (req.method === 'GET') {
    const wsServer = new WebSocket.Server({ noServer: true });

    wsServer.on('connection', (ws) => {
      console.log('New player connected');

      ws.on('message', async (message) => {
        const data = JSON.parse(message);

        switch (data.type) {
          case 'join_room':
            await handleJoinRoom(ws, data);
            break;
          case 'send_changes':
            await handleSendChanges(ws, data);
            break;
          case 'leave_room':
            await handleLeaveRoom(ws, data);
            break;
          default:
            console.error('Unknown message type:', data.type);
        }
      });

      ws.on('close', () => {
        console.log('Player disconnected');
      });
    });

    req.socket.server.on('upgrade', (request, socket, head) => {
      if (request.url === '/api/websocket') {
        wsServer.handleUpgrade(request, socket, head, (ws) => {
          wsServer.emit('connection', ws, request);
        });
      }
    });

    res.status(200).send('WebSocket server running');
  } else {
    res.status(405).send('Method Not Allowed');
  }
};

const handleJoinRoom = async (ws, { room, name, level, gear }) => {
  try {
    const playerCount = await prisma.player.count({ where: { room } });
    
    if (playerCount >= 6) {
      ws.send(JSON.stringify({ type: 'room_full' }));
      return;
    }

    ws.join(room);
    console.log(`Player ${name} joined room: ${room}`);

    await prisma.player.upsert({
      where: { name },
      update: { level, gear, room },
      create: { name, level, gear, room }
    });

    const players = await prisma.player.findMany({ where: { room } });
    ws.send(JSON.stringify({ type: 'initial_data', players }));

    wsServer.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN && client !== ws) {
        client.send(JSON.stringify({ type: 'receive_changes', name, level, gear }));
      }
    });
  } catch (error) {
    console.error('Error processing join_room:', error);
    ws.send(JSON.stringify({ type: 'error', message: 'An error occurred while joining the room.' }));
  }
};

const handleSendChanges = async (ws, { level, gear, room, name }) => {
  try {
    await prisma.player.update({
      where: { name },
      data: { level, gear, room }
    });

    wsServer.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'receive_changes', level, gear, room, name }));
      }
    });
  } catch (error) {
    console.error('Error processing send_changes:', error);
    ws.send(JSON.stringify({ type: 'error', message: 'An error occurred while sending changes.' }));
  }
};

const handleLeaveRoom = async (ws, { room, name }) => {
  try {
    ws.leave(room);
    console.log(`Player ${name} left room: ${room}`);

    await prisma.player.delete({ where: { name } });

    wsServer.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'player_left', name }));
      }
    });

    const players = await prisma.player.findMany({ where: { room } });
    wsServer.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'initial_data', players }));
      }
    });
  } catch (error) {
    console.error('Error processing leave_room:', error);
    ws.send(JSON.stringify({ type: 'error', message: 'An error occurred while leaving the room.' }));
  }
};

module.exports = wsHandler;
