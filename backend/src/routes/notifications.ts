import { Router } from 'express';
import { NotifChannel, NotifStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { meta, ok, paginate, wrap } from '../lib/http';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { pushSiap } from '../services/push';

const router = Router();
router.use(authenticate);

/**
 * Kotak masuk dalam aplikasi. Dipakai untuk menutup lingkaran informasi ke
 * pendaki (status SOS, pengingat pendakian) tanpa bergantung layanan push
 * pihak ketiga yang belum tersedia.
 */
router.get(
  '/',
  wrap(async (req, res) => {
    const { page, limit, skip } = paginate(req.query);
    const where = {
      userId: req.user!.sub,
      channel: NotifChannel.INAPP,
      ...(req.query.unread === '1' ? { readAt: null } : {}),
    };
    const [rows, total, unread] = await Promise.all([
      prisma.notification.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.notification.count({ where }),
      prisma.notification.count({
        where: { userId: req.user!.sub, channel: NotifChannel.INAPP, readAt: null },
      }),
    ]);
    return res.json({ success: true, data: rows, meta: { ...meta(total, page, limit), unread } });
  })
);

router.post(
  '/:id/read',
  wrap(async (req, res) => {
    await prisma.notification.updateMany({
      where: { id: req.params.id, userId: req.user!.sub },
      data: { readAt: new Date(), status: NotifStatus.SENT },
    });
    return ok(res, null, 'Ditandai sudah dibaca');
  })
);

router.post(
  '/read-all',
  wrap(async (req, res) => {
    const hasil = await prisma.notification.updateMany({
      where: { userId: req.user!.sub, channel: NotifChannel.INAPP, readAt: null },
      data: { readAt: new Date(), status: NotifStatus.SENT },
    });
    return ok(res, { count: hasil.count }, `${hasil.count} notifikasi ditandai dibaca`);
  })
);

/** Status layanan push, dipakai aplikasi untuk memutuskan meminta izin. */
router.get('/push/status', (_req, res) => ok(res, { siap: pushSiap() }));

/** Aplikasi mendaftarkan token FCM-nya di sini setiap kali token berubah. */
router.post(
  '/device',
  wrap(async (req, res) => {
    const { token, platform } = z
      .object({ token: z.string().min(20), platform: z.string().default('android') })
      .parse(req.body);

    const row = await prisma.deviceToken.upsert({
      where: { token },
      create: { token, platform, userId: req.user!.sub },
      // Satu perangkat bisa berpindah akun; kepemilikan ikut berpindah.
      update: { userId: req.user!.sub, platform, lastSeen: new Date() },
    });
    return ok(res, { id: row.id }, 'Perangkat terdaftar untuk notifikasi');
  })
);

router.delete(
  '/device/:token',
  wrap(async (req, res) => {
    await prisma.deviceToken.deleteMany({
      where: { token: req.params.token, userId: req.user!.sub },
    });
    return ok(res, null, 'Perangkat dilepas');
  })
);

export default router;
