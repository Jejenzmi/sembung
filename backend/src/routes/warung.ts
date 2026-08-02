import { Router } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError, created, ok, wrap } from '../lib/http';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

/** Warung beserta menunya — publik, dipakai pendaki sebelum naik. */
router.get(
  '/',
  wrap(async (req, res) =>
    ok(
      res,
      await prisma.warung.findMany({
        where: req.query.all === '1' ? {} : { isActive: true },
        orderBy: [{ distanceKm: 'asc' }, { name: 'asc' }],
        include: {
          menu: {
            where: req.query.all === '1' ? {} : { isActive: true },
            orderBy: [{ category: 'asc' }, { price: 'asc' }],
          },
        },
      })
    )
  )
);

/** Hanya paket yang boleh dipesan di muka — dipakai layar pemesanan E-Pass. */
router.get(
  '/pra-pesan',
  wrap(async (_req, res) =>
    ok(
      res,
      await prisma.menuWarung.findMany({
        where: { bisaPraPesan: true, isActive: true, warung: { isActive: true } },
        orderBy: { price: 'asc' },
        include: { warung: { select: { name: true, phone: true } } },
      })
    )
  )
);

const adminOnly = [authenticate, authorize(Role.ADMIN)];

const warungSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(3),
  description: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  jamBuka: z.string().optional(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  imageUrl: z.string().optional(),
  distanceKm: z.number().nullable().optional(),
  isActive: z.boolean().default(true),
});

router.post(
  '/',
  adminOnly,
  wrap(async (req, res) =>
    created(res, await prisma.warung.create({ data: warungSchema.parse(req.body) }), 'Warung dibuat')
  )
);

router.put(
  '/:id',
  adminOnly,
  wrap(async (req, res) =>
    ok(
      res,
      await prisma.warung.update({
        where: { id: req.params.id },
        data: warungSchema.partial().parse(req.body),
      }),
      'Warung diperbarui'
    )
  )
);

const menuSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  category: z.string().default('Makanan'),
  price: z.number().int().nonnegative(),
  imageUrl: z.string().optional(),
  bisaPraPesan: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

router.post(
  '/:id/menu',
  adminOnly,
  wrap(async (req, res) =>
    created(
      res,
      await prisma.menuWarung.create({
        data: { ...menuSchema.parse(req.body), warungId: req.params.id },
      }),
      'Menu ditambahkan'
    )
  )
);

router.put(
  '/menu/:menuId',
  adminOnly,
  wrap(async (req, res) =>
    ok(
      res,
      await prisma.menuWarung.update({
        where: { id: req.params.menuId },
        data: menuSchema.partial().parse(req.body),
      }),
      'Menu diperbarui'
    )
  )
);

router.delete(
  '/menu/:menuId',
  adminOnly,
  wrap(async (req, res) => {
    const dipakai = await prisma.bookingItem.count({
      where: { refType: 'FOOD', refId: req.params.menuId },
    });
    if (dipakai > 0) {
      await prisma.menuWarung.update({
        where: { id: req.params.menuId },
        data: { isActive: false },
      });
      return ok(res, null, `Pernah dipesan ${dipakai}×, dinonaktifkan alih-alih dihapus`);
    }
    await prisma.menuWarung.delete({ where: { id: req.params.menuId } });
    return ok(res, null, 'Menu dihapus');
  })
);

router.delete(
  '/:id',
  adminOnly,
  wrap(async (req, res) => {
    const warung = await prisma.warung.findUnique({ where: { id: req.params.id } });
    if (!warung) throw new AppError('Warung tidak ditemukan', 404);
    await prisma.warung.update({ where: { id: req.params.id }, data: { isActive: false } });
    return ok(res, null, 'Warung dinonaktifkan');
  })
);

export default router;
