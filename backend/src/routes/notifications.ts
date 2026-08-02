import { Router } from 'express';
import { NotifChannel, NotifStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { meta, ok, paginate, wrap } from '../lib/http';
import { authenticate } from '../middleware/auth';

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

export default router;
