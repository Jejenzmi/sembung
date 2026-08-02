import { Router } from 'express';
import { z } from 'zod';
import { BookingStatus, ItemRef } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError, created, ok, wrap } from '../lib/http';
import { authenticate } from '../middleware/auth';

const router = Router();

/** Ulasan publik satu pemandu, dipakai pendaki sebelum memilih. */
router.get(
  '/:guideId',
  wrap(async (req, res) => {
    const [rows, agg] = await Promise.all([
      prisma.guideReview.findMany({
        where: { guideId: req.params.guideId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { user: { select: { name: true } } },
      }),
      prisma.guideReview.aggregate({
        where: { guideId: req.params.guideId },
        _avg: { rating: true },
        _count: true,
      }),
    ]);
    return ok(res, {
      rating: Number((agg._avg.rating ?? 0).toFixed(1)),
      count: agg._count,
      reviews: rows,
    });
  })
);

const schema = z.object({
  guideId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional(),
});

/**
 * Hanya pendaki yang benar-benar memakai jasa pemandu itu, dan hanya setelah
 * pendakiannya selesai — supaya rating tidak bisa dikarang.
 */
router.post(
  '/booking/:bookingId',
  authenticate,
  wrap(async (req, res) => {
    const body = schema.parse(req.body);
    const booking = await prisma.booking.findFirst({
      where: { OR: [{ id: req.params.bookingId }, { code: req.params.bookingId }] },
      include: { items: true },
    });
    if (!booking) throw new AppError('Booking tidak ditemukan', 404);
    if (booking.userId !== req.user!.sub) throw new AppError('Bukan booking Anda', 403);
    if (booking.status !== BookingStatus.COMPLETED)
      throw new AppError('Ulasan dapat diberikan setelah pendakian selesai', 400);

    const memakai = booking.items.some(
      (i) => i.refType === ItemRef.GUIDE && i.refId === body.guideId
    );
    if (!memakai) throw new AppError('Pemandu ini tidak ada pada booking tersebut', 400);

    const review = await prisma.guideReview.upsert({
      where: {
        userId_guideId_bookingId: {
          userId: req.user!.sub,
          guideId: body.guideId,
          bookingId: booking.id,
        },
      },
      create: {
        userId: req.user!.sub,
        guideId: body.guideId,
        bookingId: booking.id,
        rating: body.rating,
        comment: body.comment,
      },
      update: { rating: body.rating, comment: body.comment },
    });

    // Rating pemandu selalu turunan dari ulasan, bukan angka yang diketik admin.
    const agg = await prisma.guideReview.aggregate({
      where: { guideId: body.guideId },
      _avg: { rating: true },
    });
    await prisma.guide.update({
      where: { id: body.guideId },
      data: { rating: Number((agg._avg.rating ?? 5).toFixed(2)) },
    });

    return created(res, review, 'Terima kasih atas ulasannya');
  })
);

export default router;
