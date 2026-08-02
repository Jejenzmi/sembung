import 'dotenv/config';
import http from 'http';
import { Server } from 'socket.io';

import { createApp } from './app';
import { attachIo } from './lib/realtime';
import { startScheduler } from './services/scheduler';

const app = createApp();
const server = http.createServer(app);

const io = new Server(server, { cors: { origin: process.env.CORS_ORIGIN || '*' } });
attachIo(io);
io.on('connection', (socket) => {
  socket.on('join', (room: string) => socket.join(room));
});

const port = Number(process.env.PORT) || 5022;
server.listen(port, () => {
  console.log(`🏔️  Sembung Explorer API  →  http://localhost:${port}`);
  console.log(
    `   Pembayaran: ${(process.env.PAYMENT_MODE || 'simulation').toUpperCase()} · ` +
      `webhook secret ${process.env.PAYMENT_WEBHOOK_SECRET ? 'terpasang' : 'BELUM DISET'}`
  );
  startScheduler();
});
