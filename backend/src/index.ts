import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { Server } from 'socket.io';

import authRoutes from './routes/auth';
import trailRoutes from './routes/trails';
import catalogRoutes from './routes/catalog';
import bookingRoutes from './routes/bookings';
import gateRoutes from './routes/gate';
import sosRoutes from './routes/sos';
import dashboardRoutes from './routes/dashboard';
import contentRoutes from './routes/content';
import userRoutes from './routes/users';
import settingRoutes from './routes/settings';
import reportRoutes from './routes/reports';
import refundRoutes from './routes/refunds';
import { audit } from './middleware/audit';
import { errorHandler, notFound } from './middleware/error';
import { attachIo } from './lib/realtime';
import { ok } from './lib/http';
import { startScheduler } from './services/scheduler';

const app = express();
const server = http.createServer(app);

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(
  express.json({
    limit: '5mb',
    // Keep the exact bytes so payment webhook signatures can be verified.
    verify: (req, _res, buf) => {
      (req as express.Request).rawBody = Buffer.from(buf);
    },
  })
);
app.use(morgan('dev'));
// Dipasang di level app agar route baru tidak bisa lupa diaudit. Penulisan
// terjadi saat respons selesai, jadi req.user sudah terisi oleh authenticate.
app.use(audit);

app.get('/health', (_req, res) => ok(res, { service: 'sembung-explorer-api', time: new Date() }));

app.use('/api/auth', authRoutes);
app.use('/api/trails', trailRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/gate', gateRoutes);
app.use('/api/sos', sosRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/refunds', refundRoutes);

app.use(notFound);
app.use(errorHandler);

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
