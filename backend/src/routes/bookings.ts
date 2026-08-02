import { Router } from 'express';
import { z } from 'zod';
import QRCode from 'qrcode';
import { BookingStatus, PaymentMethod, PaymentStatus, Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError, created, meta, ok, paginate, wrap } from '../lib/http';
import { authenticate, authorize, staffOnly } from '../middleware/auth';
import { createBooking, priceDraft, releaseBooking } from '../services/booking';
import { docCode, paymentRef, qrisPayload, vaNumber } from '../lib/codes';
import { emit } from '../lib/realtime';
import { simulationEnabled, verifyWebhookSignature } from '../lib/signature';

const router = Router();

const lineSchema = z.object({ id: z.string().uuid(), qty: z.number().int().min(1) });

const draftSchema = z.object({
  trailId: z.string().uuid(),
  startDate: z.string(),
  endDate: z.string(),
  members: z
    .array(
      z.object({
        name: z.string().min(2),
        nik: z.string().optional(),
        phone: z.string().optional(),
        age: z.number().int().optional(),
        gender: z.string().optional(),
        emergencyName: z.string().optional(),
        emergencyPhone: z.string().optional(),
        isLeader: z.boolean().optional(),
      })
    )
    .min(1),
  tickets: z.array(lineSchema).min(1),
  rentals: z.array(lineSchema).optional(),
  guides: z.array(lineSchema).optional(),
  homestays: z.array(lineSchema).optional(),
  voucherCode: z.string().min(3).optional(),
  notes: z.string().optional(),
});

const detailInclude = {
  trail: { select: { id: true, name: true, slug: true, difficulty: true, imageUrl: true } },
  user: { select: { id: true, name: true, phone: true, email: true } },
  items: true,
  members: true,
  payments: { orderBy: { createdAt: 'desc' as const } },
  checkLogs: { include: { gate: true, officer: { select: { name: true } } } },
};

/** Live price preview — no persistence, no quota hold. */
router.post(
  '/quote',
  authenticate,
  wrap(async (req, res) => {
    const draft = draftSchema.parse(req.body);
    const priced = await priceDraft(draft);
    return ok(res, {
      days: priced.days,
      persons: priced.persons,
      items: priced.lines,
      subtotal: priced.subtotal,
      discount: priced.discount,
      voucherCode: priced.voucherCode,
      serviceFee: priced.serviceFee,
      total: priced.total,
    });
  })
);

router.post(
  '/',
  authenticate,
  wrap(async (req, res) => {
    const draft = draftSchema.parse(req.body);
    const booking = await createBooking(req.user!.sub, draft);
    emit('booking:created', { id: booking.id, code: booking.code, total: booking.total });
    return created(res, booking, 'Booking dibuat, silakan lanjut pembayaran');
  })
);

router.get(
  '/mine',
  authenticate,
  wrap(async (req, res) => {
    const { page, limit, skip } = paginate(req.query);
    const where = {
      userId: req.user!.sub,
      ...(req.query.status ? { status: req.query.status as BookingStatus } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { trail: { select: { name: true, slug: true, imageUrl: true } }, items: true },
      }),
      prisma.booking.count({ where }),
    ]);
    return res.json({ success: true, data: rows, meta: meta(total, page, limit) });
  })
);

router.get(
  '/',
  authenticate,
  staffOnly,
  wrap(async (req, res) => {
    const { page, limit, skip } = paginate(req.query);
    const q = (req.query.q as string) || '';
    const where = {
      ...(req.query.status ? { status: req.query.status as BookingStatus } : {}),
      ...(req.query.trailId ? { trailId: req.query.trailId as string } : {}),
      ...(req.query.date ? { startDate: new Date(req.query.date as string) } : {}),
      ...(q
        ? {
            OR: [
              { code: { contains: q, mode: 'insensitive' as const } },
              { user: { name: { contains: q, mode: 'insensitive' as const } } },
              { user: { phone: { contains: q } } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          trail: { select: { name: true } },
          user: { select: { name: true, phone: true } },
          _count: { select: { members: true } },
        },
      }),
      prisma.booking.count({ where }),
    ]);
    return res.json({ success: true, data: rows, meta: meta(total, page, limit) });
  })
);

const loadOwned = async (id: string, userId: string, role: Role) => {
  const booking = await prisma.booking.findFirst({
    where: { OR: [{ id }, { code: id }] },
    include: detailInclude,
  });
  if (!booking) throw new AppError('Booking tidak ditemukan', 404);
  if (role === Role.VISITOR && booking.userId !== userId)
    throw new AppError('Bukan booking Anda', 403);
  return booking;
};

router.get(
  '/:id',
  authenticate,
  wrap(async (req, res) =>
    ok(res, await loadOwned(req.params.id, req.user!.sub, req.user!.role))
  )
);

/** The e-pass: QR data URL plus the summary printed on it. */
router.get(
  '/:id/epass',
  authenticate,
  wrap(async (req, res) => {
    const booking = await loadOwned(req.params.id, req.user!.sub, req.user!.role);
    if (booking.status === BookingStatus.PENDING_PAYMENT)
      throw new AppError('E-Pass terbit setelah pembayaran lunas', 400);

    const qrImage = await QRCode.toDataURL(booking.qrToken, { margin: 1, width: 512 });
    return ok(res, {
      code: booking.code,
      qrToken: booking.qrToken,
      qrImage,
      status: booking.status,
      trail: booking.trail.name,
      leader: booking.members.find((m) => m.isLeader)?.name ?? booking.user.name,
      persons: booking.totalPersons,
      startDate: booking.startDate,
      endDate: booking.endDate,
      items: booking.items,
    });
  })
);

const paySchema = z.object({
  method: z.nativeEnum(PaymentMethod),
});

/** Create a payment intent (QRIS payload / VA number) for a pending booking. */
router.post(
  '/:id/pay',
  authenticate,
  wrap(async (req, res) => {
    const { method } = paySchema.parse(req.body);
    const booking = await loadOwned(req.params.id, req.user!.sub, req.user!.role);
    if (booking.status !== BookingStatus.PENDING_PAYMENT)
      throw new AppError('Booking ini sudah tidak menunggu pembayaran', 400);

    const ref = paymentRef(method);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    const payment = await prisma.payment.create({
      data: {
        bookingId: booking.id,
        method,
        amount: booking.total,
        reference: ref,
        status: PaymentStatus.PENDING,
        expiresAt,
        qrisPayload: method === PaymentMethod.QRIS ? qrisPayload(ref, booking.total) : null,
        vaNumber:
          method === PaymentMethod.VA_BCA
            ? vaNumber('88810')
            : method === PaymentMethod.VA_BNI
            ? vaNumber('98810')
            : null,
      },
    });

    const qrImage = payment.qrisPayload
      ? await QRCode.toDataURL(payment.qrisPayload, { margin: 1, width: 512 })
      : null;

    return created(res, { ...payment, qrImage }, 'Instruksi pembayaran dibuat');
  })
);

/** Shared settlement path for both the gateway webhook and simulation mode. */
async function settlePayment(reference: string) {
  const payment = await prisma.payment.findUnique({
    where: { reference },
    include: { booking: true },
  });
  if (!payment) throw new AppError('Pembayaran tidak ditemukan', 404);
  if (payment.status === PaymentStatus.PAID) {
    return { payment, booking: payment.booking, alreadyPaid: true };
  }
  if (payment.booking.status === BookingStatus.EXPIRED)
    throw new AppError('Booking sudah kedaluwarsa, silakan pesan ulang', 409);
  if (payment.booking.status === BookingStatus.CANCELLED)
    throw new AppError('Booking sudah dibatalkan', 409);

  const [paid, booking] = await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.PAID, paidAt: new Date() },
    }),
    prisma.booking.update({
      where: { id: payment.bookingId },
      // Clearing expiresAt takes the booking out of the scheduler's sweep.
      data: { status: BookingStatus.PAID, expiresAt: null },
      include: { trail: { select: { name: true } } },
    }),
  ]);

  emit('booking:paid', { id: booking.id, code: booking.code, total: booking.total });
  return { payment: paid, booking, alreadyPaid: false };
}

/**
 * Payment gateway webhook. Requires an `X-Signature` HMAC-SHA256 of the raw body
 * using PAYMENT_WEBHOOK_SECRET — without it anyone knowing a reference could
 * mint a paid E-Pass.
 */
router.post(
  '/payments/webhook',
  wrap(async (req, res) => {
    const header = (req.headers['x-signature'] ?? req.headers['x-callback-signature']) as
      | string
      | undefined;
    if (!verifyWebhookSignature(req, header))
      throw new AppError('Signature webhook tidak valid', 401);

    const { reference, status } = z
      .object({ reference: z.string().min(4), status: z.string().optional() })
      .parse(req.body);

    if (status && !['PAID', 'SETTLEMENT', 'SUCCESS', 'success'].includes(status))
      return ok(res, null, `Status ${status} diabaikan`);

    const result = await settlePayment(reference);
    return ok(res, result, result.alreadyPaid ? 'Sudah lunas' : 'Pembayaran dikonfirmasi');
  })
);

/**
 * Simulation-only settlement so the demo (and manual counter payments) can
 * complete. Restricted to the booking owner or staff, and disabled entirely
 * when PAYMENT_MODE=live.
 */
router.post(
  '/:id/simulate-payment',
  authenticate,
  wrap(async (req, res) => {
    if (!simulationEnabled())
      throw new AppError('Mode simulasi nonaktif; pembayaran hanya lewat webhook gateway', 403);

    const booking = await loadOwned(req.params.id, req.user!.sub, req.user!.role);
    const pending = booking.payments.find((p) => p.status === PaymentStatus.PENDING);
    if (!pending) throw new AppError('Tidak ada tagihan menunggu pembayaran', 400);

    const result = await settlePayment(pending.reference);
    return ok(res, result, 'Pembayaran dikonfirmasi, E-Pass terbit');
  })
);

router.post(
  '/:id/cancel',
  authenticate,
  wrap(async (req, res) => {
    const booking = await loadOwned(req.params.id, req.user!.sub, req.user!.role);
    if (![BookingStatus.PENDING_PAYMENT, BookingStatus.PAID].includes(booking.status as never))
      throw new AppError('Booking tidak dapat dibatalkan pada status ini', 400);

    await releaseBooking(booking.id);
    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: { status: BookingStatus.CANCELLED, expiresAt: null },
    });

    // Uang yang sudah masuk tidak boleh hangus diam-diam: pembatalan booking
    // lunas otomatis membuka pengajuan refund untuk ditinjau admin.
    const paid = booking.payments
      .filter((p) => p.status === PaymentStatus.PAID)
      .reduce((s, p) => s + p.amount, 0);

    let refund = null;
    if (paid > 0) {
      refund = await prisma.refund.create({
        data: {
          code: docCode('RFD'),
          bookingId: booking.id,
          amount: paid,
          reason: 'Dibatalkan oleh pemesan',
          requestedById: req.user!.sub,
        },
      });
      emit('refund:new', { code: refund.code, amount: refund.amount });
    }

    emit('booking:cancelled', { id: updated.id, code: updated.code });
    return ok(
      res,
      { ...updated, refund },
      refund
        ? `Booking dibatalkan. Pengajuan refund ${refund.code} sebesar ${refund.amount} menunggu persetujuan pengelola.`
        : 'Booking dibatalkan'
    );
  })
);

router.post(
  '/:id/review',
  authenticate,
  wrap(async (req, res) => {
    const { rating, comment } = z
      .object({ rating: z.number().int().min(1).max(5), comment: z.string().optional() })
      .parse(req.body);
    const booking = await loadOwned(req.params.id, req.user!.sub, req.user!.role);
    if (booking.status !== BookingStatus.COMPLETED)
      throw new AppError('Ulasan dapat diberikan setelah pendakian selesai', 400);

    const review = await prisma.review.upsert({
      where: { userId_trailId: { userId: booking.userId, trailId: booking.trailId } },
      create: { userId: booking.userId, trailId: booking.trailId, rating, comment },
      update: { rating, comment },
    });
    return created(res, review, 'Terima kasih atas ulasannya');
  })
);

export default router;
