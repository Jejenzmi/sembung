import { Router } from 'express';
import { BookingStatus, PaymentStatus, SosStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ok, wrap } from '../lib/http';
import { authenticate, staffOnly } from '../middleware/auth';
import { liveOccupancy } from '../services/quota';

const router = Router();

/** Public capacity widget — shown on the mobile home screen. */
router.get(
  '/capacity',
  wrap(async (_req, res) => ok(res, await liveOccupancy()))
);

router.get(
  '/summary',
  authenticate,
  staffOnly,
  wrap(async (_req, res) => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);

    const [
      occupancy,
      todayBookings,
      todayRevenue,
      monthRevenue,
      activeSos,
      pendingPayment,
      totalVisitors,
      arrivalsToday,
    ] = await Promise.all([
      liveOccupancy(),
      prisma.booking.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.payment.aggregate({
        where: { status: PaymentStatus.PAID, paidAt: { gte: todayStart } },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: { status: PaymentStatus.PAID, paidAt: { gte: monthStart } },
        _sum: { amount: true },
      }),
      prisma.sosAlert.count({
        where: { status: { in: [SosStatus.OPEN, SosStatus.ACKNOWLEDGED, SosStatus.RESCUING] } },
      }),
      prisma.booking.count({ where: { status: BookingStatus.PENDING_PAYMENT } }),
      prisma.user.count({ where: { role: 'VISITOR' } }),
      prisma.booking.aggregate({
        where: { startDate: todayStart, status: { in: [BookingStatus.PAID, BookingStatus.CHECKED_IN] } },
        _sum: { totalPersons: true },
      }),
    ]);

    return ok(res, {
      onMountain: occupancy.totalPersons,
      groupsOnMountain: occupancy.totalGroups,
      trails: occupancy.trails,
      todayBookings,
      todayRevenue: todayRevenue._sum.amount ?? 0,
      monthRevenue: monthRevenue._sum.amount ?? 0,
      activeSos,
      pendingPayment,
      totalVisitors,
      arrivalsToday: arrivalsToday._sum.totalPersons ?? 0,
    });
  })
);

/** Daily visitors + revenue for the last N days (dashboard chart). */
router.get(
  '/trend',
  authenticate,
  staffOnly,
  wrap(async (req, res) => {
    const days = Math.min(90, Number(req.query.days) || 14);
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - (days - 1));
    // Dikirim sebagai string tanggal polos: melewatkan objek Date membuat
    // Postgres meng-cast timestamptz memakai zona sesi, yang bisa menggeser
    // hasil satu hari bila server berjalan di UTC.
    const sinceKey = since.toISOString().slice(0, 10);

    const rows = await prisma.$queryRaw<
      { day: Date; persons: bigint; bookings: bigint; revenue: bigint }[]
    >`
      SELECT d::date AS day,
             COALESCE(SUM(b."totalPersons"), 0)::bigint AS persons,
             COUNT(b.id)::bigint AS bookings,
             COALESCE(SUM(b.total), 0)::bigint AS revenue
      FROM generate_series(${sinceKey}::date, CURRENT_DATE, '1 day') AS d
      LEFT JOIN "Booking" b
        ON b."startDate" = d::date
       AND b.status IN ('PAID', 'CHECKED_IN', 'COMPLETED')
      GROUP BY d
      ORDER BY d
    `;

    return ok(
      res,
      rows.map((r) => ({
        date: new Date(r.day).toISOString().slice(0, 10),
        persons: Number(r.persons),
        bookings: Number(r.bookings),
        revenue: Number(r.revenue),
      }))
    );
  })
);

/** Revenue split by product line, for the finance tab. */
router.get(
  '/revenue-breakdown',
  authenticate,
  staffOnly,
  wrap(async (_req, res) => {
    const rows = await prisma.bookingItem.groupBy({
      by: ['refType'],
      where: { booking: { status: { in: [BookingStatus.PAID, BookingStatus.CHECKED_IN, BookingStatus.COMPLETED] } } },
      _sum: { amount: true },
      _count: { _all: true },
    });
    return ok(
      res,
      rows.map((r) => ({ type: r.refType, amount: r._sum.amount ?? 0, lines: r._count._all }))
    );
  })
);

export default router;
