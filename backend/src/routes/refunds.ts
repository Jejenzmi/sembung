import { Router } from 'express';
import { z } from 'zod';
import { BookingStatus, PaymentStatus, RefundStatus, Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError, created, meta, ok, paginate, wrap } from '../lib/http';
import { authenticate, authorize, staffOnly } from '../middleware/auth';
import { docCode } from '../lib/codes';
import { releaseRentals } from '../services/booking';
import { emit } from '../lib/realtime';

const router = Router();
router.use(authenticate);

const include = {
  booking: {
    select: {
      code: true,
      total: true,
      status: true,
      startDate: true,
      trail: { select: { name: true } },
      user: { select: { name: true, phone: true } },
    },
  },
  requestedBy: { select: { name: true, role: true } },
  processedBy: { select: { name: true } },
};

const requestSchema = z.object({
  amount: z.number().int().positive().optional(),
  reason: z.string().min(4),
  method: z.string().optional(),
  accountName: z.string().optional(),
  accountNumber: z.string().optional(),
});

/**
 * Cancelling a paid booking previously flipped the status but left the money
 * with the park. A refund request makes that obligation explicit and auditable.
 */
router.post(
  '/booking/:bookingId',
  wrap(async (req, res) => {
    const body = requestSchema.parse(req.body);
    const booking = await prisma.booking.findFirst({
      where: { OR: [{ id: req.params.bookingId }, { code: req.params.bookingId }] },
      include: { payments: true, refunds: true },
    });
    if (!booking) throw new AppError('Booking tidak ditemukan', 404);
    if (req.user!.role === Role.VISITOR && booking.userId !== req.user!.sub)
      throw new AppError('Bukan booking Anda', 403);

    const paid = booking.payments
      .filter((p) => p.status === PaymentStatus.PAID)
      .reduce((s, p) => s + p.amount, 0);
    if (paid <= 0) throw new AppError('Booking ini belum pernah dibayar', 400);

    const alreadyClaimed = booking.refunds
      .filter((r) => r.status !== RefundStatus.REJECTED)
      .reduce((s, r) => s + r.amount, 0);
    const remaining = paid - alreadyClaimed;
    if (remaining <= 0) throw new AppError('Seluruh pembayaran sudah direfund', 409);

    const amount = body.amount ?? remaining;
    if (amount > remaining)
      throw new AppError(`Maksimal refund yang tersisa ${remaining}`, 400);

    const refund = await prisma.refund.create({
      data: {
        code: docCode('RFD'),
        bookingId: booking.id,
        amount,
        reason: body.reason,
        method: body.method,
        accountName: body.accountName,
        accountNumber: body.accountNumber,
        requestedById: req.user!.sub,
      },
      include,
    });

    emit('refund:new', { code: refund.code, amount: refund.amount });
    return created(res, refund, 'Pengajuan refund tercatat');
  })
);

router.get(
  '/mine',
  wrap(async (req, res) =>
    ok(
      res,
      await prisma.refund.findMany({
        where: { booking: { userId: req.user!.sub } },
        orderBy: { createdAt: 'desc' },
        include,
      })
    )
  )
);

router.get(
  '/',
  staffOnly,
  wrap(async (req, res) => {
    const { page, limit, skip } = paginate(req.query);
    const where = req.query.status ? { status: req.query.status as RefundStatus } : {};
    const [rows, total] = await Promise.all([
      prisma.refund.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        include,
      }),
      prisma.refund.count({ where }),
    ]);
    return res.json({ success: true, data: rows, meta: meta(total, page, limit) });
  })
);

const decisionSchema = z.object({
  status: z.nativeEnum(RefundStatus),
  note: z.string().optional(),
});

router.put(
  '/:id/status',
  authorize(Role.ADMIN),
  wrap(async (req, res) => {
    const body = decisionSchema.parse(req.body);
    const refund = await prisma.refund.findUnique({
      where: { id: req.params.id },
      include: { booking: true },
    });
    if (!refund) throw new AppError('Refund tidak ditemukan', 404);
    if (refund.status === RefundStatus.PAID)
      throw new AppError('Refund sudah dibayarkan', 409);

    const updated = await prisma.refund.update({
      where: { id: refund.id },
      data: {
        status: body.status,
        note: body.note,
        processedById: req.user!.sub,
        processedAt: new Date(),
      },
      include,
    });

    // Approving a refund ends the trip: free the slot and the gear.
    if (
      body.status === RefundStatus.APPROVED &&
      [BookingStatus.PAID, BookingStatus.PENDING_PAYMENT].includes(
        refund.booking.status as never
      )
    ) {
      await releaseRentals(refund.bookingId);
      await prisma.booking.update({
        where: { id: refund.bookingId },
        data: { status: BookingStatus.CANCELLED, expiresAt: null },
      });
    }

    emit('refund:updated', { code: updated.code, status: updated.status });
    return ok(res, updated, `Refund ${body.status}`);
  })
);

export default router;
