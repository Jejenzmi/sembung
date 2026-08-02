import { Router } from 'express';
import { z } from 'zod';
import { JenisPenginapan, Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError, created, ok, wrap } from '../lib/http';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

/** Daftar penginapan untuk pendaki — publik, tidak butuh akun. */
router.get(
  '/',
  wrap(async (req, res) => {
    const where = {
      ...(req.query.all === '1' ? {} : { isActive: true }),
      ...(req.query.type ? { type: req.query.type as JenisPenginapan } : {}),
      ...(req.query.trailId ? { trailId: req.query.trailId as string } : {}),
    };
    return ok(
      res,
      await prisma.homestay.findMany({
        where,
        orderBy: [{ distanceKm: 'asc' }, { pricePerNight: 'asc' }],
        include: { trail: { select: { name: true } } },
      })
    );
  })
);

router.get(
  '/:id',
  wrap(async (req, res) => {
    const row = await prisma.homestay.findUnique({
      where: { id: req.params.id },
      include: { trail: { select: { name: true, slug: true } } },
    });
    if (!row) throw new AppError('Penginapan tidak ditemukan', 404);
    return ok(res, row);
  })
);

const adminOnly = [authenticate, authorize(Role.ADMIN)];

const schema = z.object({
  code: z.string().min(2),
  name: z.string().min(3),
  type: z.nativeEnum(JenisPenginapan).default(JenisPenginapan.HOMESTAY),
  description: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  capacity: z.number().int().positive().default(4),
  units: z.number().int().nonnegative().default(1),
  pricePerNight: z.number().int().nonnegative(),
  facilities: z.array(z.string()).default([]),
  imageUrl: z.string().optional(),
  distanceKm: z.number().nullable().optional(),
  trailId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().default(true),
});

const bersihkan = (b: Partial<z.infer<typeof schema>>) => ({
  ...b,
  trailId: b.trailId || null,
  lat: b.lat ?? null,
  lng: b.lng ?? null,
  distanceKm: b.distanceKm ?? null,
});

router.post(
  '/',
  adminOnly,
  wrap(async (req, res) =>
    created(res, await prisma.homestay.create({ data: bersihkan(schema.parse(req.body)) as never }), 'Penginapan dibuat')
  )
);

router.put(
  '/:id',
  adminOnly,
  wrap(async (req, res) =>
    ok(
      res,
      await prisma.homestay.update({
        where: { id: req.params.id },
        data: bersihkan(schema.partial().parse(req.body)),
      }),
      'Penginapan diperbarui'
    )
  )
);

router.delete(
  '/:id',
  adminOnly,
  wrap(async (req, res) => {
    // Jangan hapus bila pernah dipesan — riwayat transaksi harus tetap utuh.
    const dipakai = await prisma.bookingItem.count({
      where: { refType: 'HOMESTAY', refId: req.params.id },
    });
    if (dipakai > 0) {
      await prisma.homestay.update({ where: { id: req.params.id }, data: { isActive: false } });
      return ok(res, null, `Pernah dipesan ${dipakai}×, dinonaktifkan alih-alih dihapus`);
    }
    await prisma.homestay.delete({ where: { id: req.params.id } });
    return ok(res, null, 'Penginapan dihapus');
  })
);

export default router;
