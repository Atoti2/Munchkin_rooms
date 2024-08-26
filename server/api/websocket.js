// api/socket.js

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async (req, res) => {
  if (req.method === 'POST') {
    const { room, name, level, gear } = req.body;

    try {
      const playerCount = await prisma.player.count({ where: { room } });

      if (playerCount >= 6) {
        res.status(400).json({ error: 'Room is full' });
        return;
      }

      await prisma.player.upsert({
        where: { name },
        update: { level, gear, room },
        create: { name, level, gear, room }
      });

      const players = await prisma.player.findMany({ where: { room } });
      res.status(200).json(players);

    } catch (error) {
      res.status(500).json({ error: 'Error processing request' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
