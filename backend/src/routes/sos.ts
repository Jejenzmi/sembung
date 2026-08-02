import { Router } from 'express';
import { z } from 'zod';
import { BookingStatus, Role, SosStatus, SosType } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError, created, meta, ok, paginate, wrap } from '../lib/http';
import { authenticate, staffOnly } from '../middleware/auth';
import { docCode } from '../lib/codes';
import { emit } from '../lib/realtime';
import { notifyStaff, notifyUser } from '../services/notify';

const router = Router();
router.use(authenticate);

const alertInclude = {
  user: { select: { id: true, name: true, phone: true, emergencyName: true, emergencyPhone: true } },
  booking: {
    select: {
      code: true,
      totalPersons: true,
      startDate: true,
      endDate: true,
      trail: { select: { name: true } },
      members: { select: { name: true, phone: true, isLeader: true } },
    },
  },
  handler: { select: { id: true, name: true } },
};

const sosSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  elevationM: z.number().int().optional(),
  accuracy: z.number().optional(),
  type: z.nativeEnum(SosType).default(SosType.OTHER),
  message: z.string().optional(),
  bookingId: z.string().uuid().optional(),
});

/** Panic button. Resolves the active booking automatically when not supplied. */
router.post(
  '/',
  wrap(async (req, res) => {
    const body = sosSchema.parse(req.body);
    const bookingId =
      body.bookingId ??
      (
        await prisma.booking.findFirst({
          where: { userId: req.user!.sub, status: BookingStatus.CHECKED_IN },
          orderBy: { checkedInAt: 'desc' },
          select: { id: true },
        })
      )?.id;

    const alert = await prisma.sosAlert.create({
      data: {
        code: docCode('SOS'),
        userId: req.user!.sub,
        bookingId,
        type: body.type,
        lat: body.lat,
        lng: body.lng,
        elevationM: body.elevationM,
        accuracy: body.accuracy,
        message: body.message,
      },
      include: alertInclude,
    });

    emit('sos:new', alert);

    // Fan out immediately: an alert nobody is watching for is not a safety feature.
    notifyStaff({
      subject: `SOS ${alert.code} — ${alert.type}`,
      body:
        `${alert.user.name} (${alert.user.phone}) menekan tombol darurat.\n` +
        `Lokasi: ${alert.lat.toFixed(5)}, ${alert.lng.toFixed(5)}` +
        (alert.elevationM ? ` · ${alert.elevationM} mdpl` : '') +
        '\n' +
        (alert.booking
          ? `Rombongan ${alert.booking.code} · ${alert.booking.trail.name} · ${alert.booking.totalPersons} orang\n`
          : 'Tidak terkait booking aktif.\n') +
        (alert.message ? `Pesan: ${alert.message}` : ''),
      refType: 'SOS',
      refId: alert.id,
      extraPhones: alert.user.emergencyPhone ? [alert.user.emergencyPhone] : [],
    }).catch((e) => console.error('Notifikasi SOS gagal:', e));

    return created(res, alert, 'Sinyal darurat terkirim ke pos pemantau');
  })
);

router.get(
  '/mine',
  wrap(async (req, res) =>
    ok(
      res,
      await prisma.sosAlert.findMany({
        where: { userId: req.user!.sub },
        orderBy: { createdAt: 'desc' },
        include: alertInclude,
      })
    )
  )
);

router.get(
  '/',
  staffOnly,
  wrap(async (req, res) => {
    const { page, limit, skip } = paginate(req.query);
    const where = req.query.status
      ? { status: req.query.status as SosStatus }
      : req.query.active === '1'
      ? { status: { in: [SosStatus.OPEN, SosStatus.ACKNOWLEDGED, SosStatus.RESCUING] } }
      : {};
    const [rows, total] = await Promise.all([
      prisma.sosAlert.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        include: alertInclude,
      }),
      prisma.sosAlert.count({ where }),
    ]);
    return res.json({ success: true, data: rows, meta: meta(total, page, limit) });
  })
);

router.get(
  '/:id',
  wrap(async (req, res) => {
    const alert = await prisma.sosAlert.findFirst({
      where: { OR: [{ id: req.params.id }, { code: req.params.id }] },
      include: alertInclude,
    });
    if (!alert) throw new AppError('Sinyal darurat tidak ditemukan', 404);
    if (req.user!.role === Role.VISITOR && alert.userId !== req.user!.sub)
      throw new AppError('Akses ditolak', 403);

    const [track, notifications] = await Promise.all([
      prisma.trackPing.findMany({
        where: { userId: alert.userId },
        orderBy: { at: 'desc' },
        take: 50,
      }),
      // Staff need to see whether the alert actually reached anyone.
      req.user!.role === Role.VISITOR
        ? Promise.resolve([])
        : prisma.notification.findMany({
            where: { refType: 'SOS', refId: alert.id },
            orderBy: { createdAt: 'asc' },
          }),
    ]);
    return ok(res, { ...alert, track, notifications });
  })
);

const statusSchema = z.object({
  status: z.nativeEnum(SosStatus),
  resolutionNote: z.string().optional(),
});

router.put(
  '/:id/status',
  staffOnly,
  wrap(async (req, res) => {
    const body = statusSchema.parse(req.body);
    const terminal = [SosStatus.RESOLVED, SosStatus.FALSE_ALARM].includes(body.status as never);

    const alert = await prisma.sosAlert.update({
      where: { id: req.params.id },
      data: {
        status: body.status,
        handlerId: req.user!.sub,
        resolutionNote: body.resolutionNote,
        acknowledgedAt: body.status === SosStatus.ACKNOWLEDGED ? new Date() : undefined,
        resolvedAt: terminal ? new Date() : null,
      },
      include: alertInclude,
    });

    // Pendaki berhak tahu permintaannya sedang ditangani, bukan menunggu buta.
    const pesan: Record<string, string> = {
      ACKNOWLEDGED: 'Pos pemantau sudah menerima sinyal darurat Anda.',
      RESCUING: 'Tim evakuasi sedang menuju lokasi Anda. Tetap di tempat aman.',
      RESOLVED: 'Penanganan darurat dinyatakan selesai.',
      FALSE_ALARM: 'Sinyal darurat Anda ditandai sebagai alarm palsu oleh petugas.',
    };
    if (pesan[body.status]) {
      notifyUser(alert.userId, {
        subject: `Status darurat ${alert.code}`,
        body: pesan[body.status] + (body.resolutionNote ? `\n\nCatatan: ${body.resolutionNote}` : ''),
        refType: 'SOS',
        refId: alert.id,
      }).catch((e) => console.error('Notifikasi pendaki gagal:', e));
    }

    emit('sos:updated', alert);
    return ok(res, alert, `Status darurat: ${body.status}`);
  })
);

/* ------------------------------- live tracking ------------------------------ */

const pingSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  elevationM: z.number().int().optional(),
  accuracy: z.number().optional(),
  battery: z.number().int().min(0).max(100).optional(),
  bookingId: z.string().uuid().optional(),
});

router.post(
  '/track',
  wrap(async (req, res) => {
    const body = pingSchema.parse(req.body);
    const bookingId =
      body.bookingId ??
      (
        await prisma.booking.findFirst({
          where: { userId: req.user!.sub, status: BookingStatus.CHECKED_IN },
          orderBy: { checkedInAt: 'desc' },
          select: { id: true },
        })
      )?.id;

    const ping = await prisma.trackPing.create({
      data: { ...body, bookingId, userId: req.user!.sub },
    });
    emit('track:ping', { userId: req.user!.sub, bookingId, lat: ping.lat, lng: ping.lng, at: ping.at });
    return created(res, ping, 'Lokasi terkirim');
  })
);

router.get(
  '/track/:bookingId',
  staffOnly,
  wrap(async (req, res) =>
    ok(
      res,
      await prisma.trackPing.findMany({
        where: { bookingId: req.params.bookingId },
        orderBy: { at: 'asc' },
      })
    )
  )
);

export default router;
