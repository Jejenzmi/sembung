import { Router, Request, Response } from 'express';
import { BookingStatus, CheckType, PaymentStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ok, wrap } from '../lib/http';
import { authenticate, staffOnly } from '../middleware/auth';
import { Column, sendCsv } from '../lib/csv';

const router = Router();
router.use(authenticate, staffOnly);

/** Reports default to the current month when no range is supplied. */
function range(req: Request) {
  const now = new Date();
  const from = req.query.from
    ? new Date(`${req.query.from}T00:00:00.000Z`)
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = req.query.to
    ? new Date(`${req.query.to}T23:59:59.999Z`)
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  return { from, to, label: `${from.toISOString().slice(0, 10)}_${to.toISOString().slice(0, 10)}` };
}

/** Every report answers JSON by default and CSV with ?format=csv. */
function deliver<T extends Record<string, unknown>>(
  req: Request,
  res: Response,
  name: string,
  rows: T[],
  columns: Column<T>[],
  extra?: Record<string, unknown>
) {
  if (req.query.format === 'csv') return sendCsv(res, `${name}.csv`, rows, columns);
  return ok(res, { rows, ...(extra ?? {}) });
}

/* ------------------------- retribusi harian (kas) ------------------------- */

router.get(
  '/revenue-daily',
  wrap(async (req, res) => {
    const { from, to, label } = range(req);
    // Dikelompokkan di JS, bukan SQL mentah: kolom DateTime Prisma bertipe
    // `timestamp` tanpa zona, sehingga dibandingkan dengan parameter bertimezone
    // hasilnya bergeser sebesar offset server (7 jam di WIB).
    const payments = await prisma.payment.findMany({
      where: { status: PaymentStatus.PAID, paidAt: { gte: from, lte: to } },
      select: { paidAt: true, method: true, amount: true },
    });

    const bucket = new Map<string, { tanggal: string; metode: string; transaksi: number; nominal: number }>();
    for (const p of payments) {
      const tanggal = p.paidAt!.toISOString().slice(0, 10);
      const key = `${tanggal}|${p.method}`;
      const row = bucket.get(key) ?? { tanggal, metode: p.method, transaksi: 0, nominal: 0 };
      row.transaksi++;
      row.nominal += p.amount;
      bucket.set(key, row);
    }

    const rows = Array.from(bucket.values()).sort(
      (a, b) => a.tanggal.localeCompare(b.tanggal) || a.metode.localeCompare(b.metode)
    );

    return deliver(
      req,
      res,
      `retribusi-harian_${label}`,
      rows,
      [
        { key: 'tanggal', label: 'Tanggal' },
        { key: 'metode', label: 'Metode Pembayaran' },
        { key: 'transaksi', label: 'Jumlah Transaksi' },
        { key: 'nominal', label: 'Nominal (Rp)' },
      ],
      { total: rows.reduce((s, r) => s + r.nominal, 0) }
    );
  })
);

/* ---------------------- rincian per jenis penerimaan ---------------------- */

router.get(
  '/revenue-by-item',
  wrap(async (req, res) => {
    const { from, to, label } = range(req);
    const items = await prisma.bookingItem.findMany({
      where: {
        booking: {
          status: { in: [BookingStatus.PAID, BookingStatus.CHECKED_IN, BookingStatus.COMPLETED] },
          createdAt: { gte: from, lte: to },
        },
      },
      select: { refType: true, name: true, qty: true, amount: true },
    });

    const bucket = new Map<string, { jenis: string; nama: string; unit: number; nominal: number }>();
    for (const i of items) {
      const key = `${i.refType}|${i.name}`;
      const row = bucket.get(key) ?? { jenis: i.refType, nama: i.name, unit: 0, nominal: 0 };
      row.unit += i.qty;
      row.nominal += i.amount;
      bucket.set(key, row);
    }

    const rows = Array.from(bucket.values()).sort((a, b) => b.nominal - a.nominal);

    return deliver(
      req,
      res,
      `penerimaan-per-jenis_${label}`,
      rows,
      [
        { key: 'jenis', label: 'Kelompok' },
        { key: 'nama', label: 'Item' },
        { key: 'unit', label: 'Unit Terjual' },
        { key: 'nominal', label: 'Nominal (Rp)' },
      ],
      { total: rows.reduce((s, r) => s + r.nominal, 0) }
    );
  })
);

/* ------------------------- kunjungan per jalur ---------------------------- */

router.get(
  '/visitors-by-trail',
  wrap(async (req, res) => {
    const { from, to, label } = range(req);
    const grouped = await prisma.booking.groupBy({
      by: ['trailId'],
      where: {
        startDate: { gte: from, lte: to },
        status: { in: [BookingStatus.PAID, BookingStatus.CHECKED_IN, BookingStatus.COMPLETED] },
      },
      _sum: { totalPersons: true, total: true },
      _count: { _all: true },
    });
    const trails = await prisma.trail.findMany({ select: { id: true, name: true } });

    const rows = grouped.map((g) => ({
      jalur: trails.find((t) => t.id === g.trailId)?.name ?? g.trailId,
      rombongan: g._count._all,
      pendaki: g._sum.totalPersons ?? 0,
      nominal: g._sum.total ?? 0,
    }));

    return deliver(
      req,
      res,
      `kunjungan-per-jalur_${label}`,
      rows,
      [
        { key: 'jalur', label: 'Jalur' },
        { key: 'rombongan', label: 'Rombongan' },
        { key: 'pendaki', label: 'Jumlah Pendaki' },
        { key: 'nominal', label: 'Nominal (Rp)' },
      ],
      {
        totalPendaki: rows.reduce((s, r) => s + r.pendaki, 0),
        total: rows.reduce((s, r) => s + r.nominal, 0),
      }
    );
  })
);

/* --------------------- rekap petugas & sampah turun ----------------------- */

router.get(
  '/gate-recap',
  wrap(async (req, res) => {
    const { from, to, label } = range(req);
    const logs = await prisma.checkLog.findMany({
      where: { at: { gte: from, lte: to } },
      include: {
        officer: { select: { name: true } },
        gate: { select: { name: true } },
      },
    });

    const map = new Map<string, { petugas: string; pos: string; naik: number; turun: number; orangNaik: number; orangTurun: number; sampahKg: number }>();
    for (const log of logs) {
      const key = `${log.officer.name}|${log.gate.name}`;
      const row = map.get(key) ?? {
        petugas: log.officer.name,
        pos: log.gate.name,
        naik: 0,
        turun: 0,
        orangNaik: 0,
        orangTurun: 0,
        sampahKg: 0,
      };
      if (log.type === CheckType.CHECK_IN) {
        row.naik++;
        row.orangNaik += log.personCount;
      } else {
        row.turun++;
        row.orangTurun += log.personCount;
        row.sampahKg += log.wasteKg ?? 0;
      }
      map.set(key, row);
    }

    const rows = Array.from(map.values()).map((r) => ({
      ...r,
      sampahKg: Number(r.sampahKg.toFixed(1)),
    }));

    return deliver(
      req,
      res,
      `rekap-pos-gerbang_${label}`,
      rows,
      [
        { key: 'petugas', label: 'Petugas' },
        { key: 'pos', label: 'Pos Gerbang' },
        { key: 'naik', label: 'Rombongan Naik' },
        { key: 'orangNaik', label: 'Orang Naik' },
        { key: 'turun', label: 'Rombongan Turun' },
        { key: 'orangTurun', label: 'Orang Turun' },
        { key: 'sampahKg', label: 'Sampah Turun (kg)' },
      ],
      { totalSampahKg: Number(rows.reduce((s, r) => s + r.sampahKg, 0).toFixed(1)) }
    );
  })
);

/* --------------------------- buku besar booking --------------------------- */

router.get(
  '/bookings',
  wrap(async (req, res) => {
    const { from, to, label } = range(req);
    const bookings = await prisma.booking.findMany({
      where: { createdAt: { gte: from, lte: to } },
      orderBy: { createdAt: 'asc' },
      include: {
        trail: { select: { name: true } },
        user: { select: { name: true, phone: true } },
        payments: { where: { status: PaymentStatus.PAID }, take: 1 },
      },
    });

    const rows = bookings.map((b) => ({
      kode: b.code,
      tanggalPesan: b.createdAt.toISOString().slice(0, 10),
      pemesan: b.user.name,
      telepon: b.user.phone,
      jalur: b.trail.name,
      mulai: b.startDate.toISOString().slice(0, 10),
      selesai: b.endDate.toISOString().slice(0, 10),
      orang: b.totalPersons,
      status: b.status,
      metode: b.payments[0]?.method ?? '-',
      total: b.total,
    }));

    return deliver(req, res, `buku-booking_${label}`, rows, [
      { key: 'kode', label: 'Kode Booking' },
      { key: 'tanggalPesan', label: 'Tanggal Pesan' },
      { key: 'pemesan', label: 'Pemesan' },
      { key: 'telepon', label: 'Telepon' },
      { key: 'jalur', label: 'Jalur' },
      { key: 'mulai', label: 'Mulai' },
      { key: 'selesai', label: 'Selesai' },
      { key: 'orang', label: 'Jumlah Orang' },
      { key: 'status', label: 'Status' },
      { key: 'metode', label: 'Metode Bayar' },
      { key: 'total', label: 'Total (Rp)' },
    ]);
  })
);

/* -------------------------------- ringkasan ------------------------------- */

router.get(
  '/summary',
  wrap(async (req, res) => {
    const { from, to } = range(req);
    const [payments, bookings, persons, waste, refunds] = await Promise.all([
      prisma.payment.aggregate({
        where: { status: PaymentStatus.PAID, paidAt: { gte: from, lte: to } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.booking.count({ where: { createdAt: { gte: from, lte: to } } }),
      prisma.booking.aggregate({
        where: {
          startDate: { gte: from, lte: to },
          status: { in: [BookingStatus.PAID, BookingStatus.CHECKED_IN, BookingStatus.COMPLETED] },
        },
        _sum: { totalPersons: true },
      }),
      prisma.checkLog.aggregate({
        where: { type: CheckType.CHECK_OUT, at: { gte: from, lte: to } },
        _sum: { wasteKg: true },
      }),
      prisma.refund.aggregate({
        where: { createdAt: { gte: from, lte: to }, status: { in: ['APPROVED', 'PAID'] } },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return ok(res, {
      periode: { dari: from.toISOString().slice(0, 10), sampai: to.toISOString().slice(0, 10) },
      penerimaan: payments._sum.amount ?? 0,
      transaksi: payments._count,
      booking: bookings,
      pendaki: persons._sum.totalPersons ?? 0,
      sampahKg: Number((waste._sum.wasteKg ?? 0).toFixed(1)),
      refund: refunds._sum.amount ?? 0,
      refundCount: refunds._count,
      penerimaanBersih: (payments._sum.amount ?? 0) - (refunds._sum.amount ?? 0),
    });
  })
);

export default router;
