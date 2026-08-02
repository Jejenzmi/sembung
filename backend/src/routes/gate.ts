import { Router } from 'express';
import { z } from 'zod';
import { BookingStatus, CheckType } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError, created, meta, ok, paginate, wrap } from '../lib/http';
import { authenticate, staffOnly } from '../middleware/auth';
import { emit } from '../lib/realtime';
import { liveOccupancy } from '../services/quota';
import { releaseRentals } from '../services/booking';

const router = Router();
router.use(authenticate, staffOnly);

const scanInclude = {
  trail: { select: { id: true, name: true, difficulty: true } },
  user: { select: { name: true, phone: true } },
  members: true,
  items: true,
  checkLogs: { orderBy: { at: 'desc' as const }, take: 5, include: { gate: true } },
};

/** Read-only lookup so the officer sees who they are about to admit. */
router.post(
  '/scan',
  wrap(async (req, res) => {
    const { token } = z.object({ token: z.string().min(4) }).parse(req.body);
    const booking = await prisma.booking.findFirst({
      where: { OR: [{ qrToken: token }, { code: token }] },
      include: scanInclude,
    });
    if (!booking) throw new AppError('E-Pass tidak dikenali', 404);

    const today = new Date().toISOString().slice(0, 10);
    const startDay = booking.startDate.toISOString().slice(0, 10);
    const endDay = booking.endDate.toISOString().slice(0, 10);

    const reasons: string[] = [];
    if (booking.status === BookingStatus.PENDING_PAYMENT) reasons.push('Belum lunas');
    if (booking.status === BookingStatus.CANCELLED) reasons.push('Booking dibatalkan');
    if (booking.status === BookingStatus.EXPIRED) reasons.push('E-Pass kedaluwarsa');
    if (booking.status === BookingStatus.COMPLETED) reasons.push('Sudah turun gunung');
    if (today < startDay) reasons.push(`Baru berlaku ${startDay}`);
    if (today > endDay && booking.status !== BookingStatus.CHECKED_IN)
      reasons.push(`Sudah lewat masa berlaku (${endDay})`);

    return ok(res, {
      booking,
      nextAction:
        booking.status === BookingStatus.PAID
          ? 'CHECK_IN'
          : booking.status === BookingStatus.CHECKED_IN
          ? 'CHECK_OUT'
          : 'NONE',
      valid: reasons.length === 0,
      reasons,
    });
  })
);

const actionSchema = z.object({
  token: z.string().min(4),
  gateId: z.string().uuid(),
  personCount: z.number().int().min(0).optional(),
  /// Berat sampah yang ditimbang saat check-out (tata tertib butir 2).
  wasteKg: z.number().min(0).max(500).optional(),
  notes: z.string().optional(),
});

router.post(
  '/check-in',
  wrap(async (req, res) => {
    const body = actionSchema.parse(req.body);
    const booking = await prisma.booking.findFirst({
      where: { OR: [{ qrToken: body.token }, { code: body.token }] },
    });
    if (!booking) throw new AppError('E-Pass tidak dikenali', 404);
    if (booking.status === BookingStatus.CHECKED_IN)
      throw new AppError('Rombongan ini sudah check-in', 409);
    if (booking.status !== BookingStatus.PAID)
      throw new AppError(`Tidak bisa check-in pada status ${booking.status}`, 400);

    const persons = body.personCount ?? booking.totalPersons;
    const [log, updated] = await prisma.$transaction([
      prisma.checkLog.create({
        data: {
          bookingId: booking.id,
          gateId: body.gateId,
          officerId: req.user!.sub,
          type: CheckType.CHECK_IN,
          personCount: persons,
          notes: body.notes,
        },
        include: { gate: true },
      }),
      prisma.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.CHECKED_IN, checkedInAt: new Date(), totalPersons: persons },
        include: { trail: { select: { name: true } } },
      }),
    ]);

    emit('gate:check-in', { code: updated.code, persons, trail: updated.trail.name });
    emit('capacity:changed', await liveOccupancy());
    return created(res, { log, booking: updated }, `Check-in berhasil — ${persons} orang naik`);
  })
);

router.post(
  '/check-out',
  wrap(async (req, res) => {
    const body = actionSchema.parse(req.body);
    const booking = await prisma.booking.findFirst({
      where: { OR: [{ qrToken: body.token }, { code: body.token }] },
    });
    if (!booking) throw new AppError('E-Pass tidak dikenali', 404);
    if (booking.status !== BookingStatus.CHECKED_IN)
      throw new AppError('Rombongan ini belum check-in', 400);

    // Gear comes back down with the group, so return it to the rental pool.
    await releaseRentals(booking.id);

    const persons = body.personCount ?? booking.totalPersons;
    const [log, updated] = await prisma.$transaction([
      prisma.checkLog.create({
        data: {
          bookingId: booking.id,
          gateId: body.gateId,
          officerId: req.user!.sub,
          type: CheckType.CHECK_OUT,
          personCount: persons,
          wasteKg: body.wasteKg,
          notes: body.notes,
        },
        include: { gate: true },
      }),
      prisma.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.COMPLETED, checkedOutAt: new Date() },
        include: { trail: { select: { name: true } } },
      }),
    ]);

    const missing = booking.totalPersons - persons;
    emit('gate:check-out', { code: updated.code, persons, missing });
    emit('capacity:changed', await liveOccupancy());
    return created(
      res,
      { log, booking: updated, missing },
      missing > 0
        ? `Check-out tercatat, ${missing} orang belum turun — verifikasi manual`
        : 'Check-out berhasil, seluruh rombongan turun'
    );
  })
);

router.get(
  '/logs',
  wrap(async (req, res) => {
    const { page, limit, skip } = paginate(req.query);
    const where = {
      ...(req.query.gateId ? { gateId: req.query.gateId as string } : {}),
      ...(req.query.type ? { type: req.query.type as CheckType } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.checkLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { at: 'desc' },
        include: {
          gate: true,
          officer: { select: { name: true } },
          booking: {
            select: { code: true, totalPersons: true, trail: { select: { name: true } } },
          },
        },
      }),
      prisma.checkLog.count({ where }),
    ]);
    return res.json({ success: true, data: rows, meta: meta(total, page, limit) });
  })
);

/** Groups currently on the mountain — the ranger's "who is still up there" list. */
router.get(
  '/on-mountain',
  wrap(async (_req, res) => {
    const rows = await prisma.booking.findMany({
      where: { status: BookingStatus.CHECKED_IN },
      orderBy: { checkedInAt: 'asc' },
      include: {
        trail: { select: { name: true } },
        user: { select: { name: true, phone: true } },
        members: { select: { name: true, phone: true, isLeader: true } },
        trackPings: { orderBy: { at: 'desc' }, take: 1 },
      },
    });
    const now = Date.now();
    return ok(
      res,
      rows.map((b) => ({
        ...b,
        overdue: now > new Date(b.endDate).getTime() + 86_400_000,
        lastPing: b.trackPings[0] ?? null,
      }))
    );
  })
);

export default router;
