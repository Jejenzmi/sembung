import { Router } from 'express';
import { z } from 'zod';
import { ok, wrap } from '../lib/http';
import { jadwalBulanan, jadwalHarian } from '../services/shalat';

const router = Router();

const gagal = (res: import('express').Response, e: unknown) =>
  res.status(503).json({
    success: false,
    message:
      'Jadwal salat resmi sedang tidak dapat diambil. Aplikasi akan memakai ' +
      'jadwal tersimpan atau perhitungan lokal.',
    error: e instanceof Error ? e.message : 'gagal',
  });

/** Sebulan penuh — dipakai aplikasi untuk disimpan sebagai bekal offline. */
router.get(
  '/',
  wrap(async (req, res) => {
    const sekarang = new Date();
    const { tahun, bulan } = z
      .object({
        tahun: z.coerce.number().int().min(2020).max(2100).default(sekarang.getFullYear()),
        bulan: z.coerce.number().int().min(1).max(12).default(sekarang.getMonth() + 1),
      })
      .parse(req.query);

    try {
      return ok(res, await jadwalBulanan(tahun, bulan));
    } catch (e) {
      return gagal(res, e);
    }
  })
);

router.get(
  '/hari-ini',
  wrap(async (req, res) => {
    const tanggal =
      (req.query.tanggal as string) || new Date().toISOString().slice(0, 10);
    try {
      const { hari, bulanan } = await jadwalHarian(tanggal);
      return ok(res, {
        ...hari,
        lokasi: bulanan.lokasi,
        daerah: bulanan.daerah,
        sumber: bulanan.sumber,
      });
    } catch (e) {
      return gagal(res, e);
    }
  })
);

export default router;
