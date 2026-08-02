import { Router } from 'express';
import { ok, wrap } from '../lib/http';
import { cuacaKawasan } from '../services/weather';

const router = Router();

/**
 * Publik: dipakai layar beranda aplikasi pendaki dan dasbor pengelola.
 * Bila BMKG tidak dapat dihubungi, kegagalannya dinyatakan terus terang
 * alih-alih menampilkan data lama seolah masih berlaku.
 */
router.get(
  '/',
  wrap(async (_req, res) => {
    try {
      return ok(res, await cuacaKawasan());
    } catch (e) {
      return res.status(503).json({
        success: false,
        message:
          'Prakiraan BMKG sedang tidak dapat diambil. Periksa kondisi langit secara langsung sebelum naik.',
        error: e instanceof Error ? e.message : 'gagal',
      });
    }
  })
);

export default router;
