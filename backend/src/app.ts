import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

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
import { ok } from './lib/http';

/**
 * Merakit aplikasi Express tanpa menyalakan listener, socket, atau penjadwal —
 * supaya berkas uji bisa memakainya langsung lewat supertest.
 */
export function createApp() {
  const app = express();

  app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
  app.use(
    express.json({
      limit: '5mb',
      // Simpan byte asli agar signature webhook pembayaran bisa diverifikasi.
      verify: (req, _res, buf) => {
        (req as express.Request).rawBody = Buffer.from(buf);
      },
    })
  );
  if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));
  // Dipasang di level app agar route baru tidak bisa lupa diaudit.
  app.use(audit);

  app.get('/health', (_req, res) =>
    ok(res, {
      service: 'sembung-explorer-api',
      time: new Date(),
      paymentMode: (process.env.PAYMENT_MODE || 'simulation').toLowerCase(),
    })
  );

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
  return app;
}
