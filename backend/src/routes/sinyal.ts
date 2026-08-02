import { Router } from 'express';
import { z } from 'zod';
import { KuatSinyal } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ok, wrap } from '../lib/http';
import { authenticate, staffOnly } from '../middleware/auth';

const router = Router();

const URUT: Record<KuatSinyal, number> = {
  KOSONG: 0,
  LEMAH: 1,
  SEDANG: 2,
  BAIK: 3,
};

/**
 * Peta sinyal seluruh titik jalur. Ini bukan sekadar kenyamanan: pendaki perlu
 * tahu di mana ia masih bisa mengabari keluarga, dan di titik mana tombol SOS
 * tidak akan terkirim sehingga permintaannya hanya mengantre.
 */
router.get(
  '/:slug',
  wrap(async (req, res) => {
    const trail = await prisma.trail.findFirst({
      where: { OR: [{ slug: req.params.slug }, { id: req.params.slug }] },
      include: {
        points: {
          orderBy: { sequence: 'asc' },
          include: { sinyal: { orderBy: { operator: 'asc' } } },
        },
      },
    });
    if (!trail) return res.status(404).json({ success: false, message: 'Jalur tidak ditemukan' });

    const operator = Array.from(
      new Set(trail.points.flatMap((p) => p.sinyal.map((s) => s.operator)))
    ).sort();

    const titik = trail.points.map((p) => {
      const terbaik = p.sinyal.reduce<KuatSinyal>(
        (a, s) => (URUT[s.kuat] > URUT[a] ? s.kuat : a),
        'KOSONG'
      );
      return {
        id: p.id,
        nama: p.name,
        tipe: p.type,
        elevasi: p.elevationM,
        urutan: p.sequence,
        sinyalTerbaik: terbaik,
        operator: Object.fromEntries(
          p.sinyal.map((s) => [s.operator, { kuat: s.kuat, catatan: s.catatan }])
        ),
      };
    });

    // Titik terakhir yang masih bisa dipakai menelepon — informasi paling praktis.
    const terakhirAdaSinyal = [...titik]
      .filter((t) => t.sinyalTerbaik !== 'KOSONG')
      .sort((a, b) => b.urutan - a.urutan)[0];

    return ok(res, {
      jalur: trail.name,
      operator,
      titikSinyalTerakhir: terakhirAdaSinyal
        ? { nama: terakhirAdaSinyal.nama, elevasi: terakhirAdaSinyal.elevasi }
        : null,
      titik,
    });
  })
);

const schema = z.object({
  operator: z.string().min(2),
  kuat: z.nativeEnum(KuatSinyal),
  catatan: z.string().optional(),
});

/** Jagawana memperbarui hasil pengecekan sinyal di lapangan. */
router.put(
  '/titik/:pointId',
  authenticate,
  staffOnly,
  wrap(async (req, res) => {
    const body = schema.parse(req.body);
    const row = await prisma.sinyalTitik.upsert({
      where: { pointId_operator: { pointId: req.params.pointId, operator: body.operator } },
      create: { pointId: req.params.pointId, ...body },
      update: { kuat: body.kuat, catatan: body.catatan },
    });
    return ok(res, row, 'Data sinyal diperbarui');
  })
);

export default router;
