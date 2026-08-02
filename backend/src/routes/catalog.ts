import { Router } from 'express';
import { z } from 'zod';
import { GuideType, Role, TicketCategory } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { created, ok, wrap } from '../lib/http';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
const adminOnly = [authenticate, authorize(Role.ADMIN)];

/* ---------------------------------- tickets --------------------------------- */

router.get(
  '/tickets',
  wrap(async (req, res) =>
    ok(
      res,
      await prisma.ticketType.findMany({
        where: req.query.all === '1' ? {} : { isActive: true },
        orderBy: [{ category: 'asc' }, { price: 'asc' }],
      })
    )
  )
);

const ticketSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(2),
  category: z.nativeEnum(TicketCategory),
  price: z.number().int().nonnegative(),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
});

router.post(
  '/tickets',
  adminOnly,
  wrap(async (req, res) => created(res, await prisma.ticketType.create({ data: ticketSchema.parse(req.body) })))
);

router.put(
  '/tickets/:id',
  adminOnly,
  wrap(async (req, res) =>
    ok(
      res,
      await prisma.ticketType.update({
        where: { id: req.params.id },
        data: ticketSchema.partial().parse(req.body),
      }),
      'Tiket diperbarui'
    )
  )
);

router.delete(
  '/tickets/:id',
  adminOnly,
  wrap(async (req, res) => {
    await prisma.ticketType.delete({ where: { id: req.params.id } });
    return ok(res, null, 'Tiket dihapus');
  })
);

/* ---------------------------------- rentals --------------------------------- */

router.get(
  '/rentals',
  wrap(async (req, res) =>
    ok(
      res,
      await prisma.rentalItem.findMany({
        where: req.query.all === '1' ? {} : { isActive: true },
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
      })
    )
  )
);

const rentalSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(2),
  category: z.string().min(2),
  pricePerDay: z.number().int().nonnegative(),
  stock: z.number().int().nonnegative(),
  imageUrl: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
});

router.post(
  '/rentals',
  adminOnly,
  wrap(async (req, res) => created(res, await prisma.rentalItem.create({ data: rentalSchema.parse(req.body) })))
);

router.put(
  '/rentals/:id',
  adminOnly,
  wrap(async (req, res) =>
    ok(
      res,
      await prisma.rentalItem.update({
        where: { id: req.params.id },
        data: rentalSchema.partial().parse(req.body),
      }),
      'Alat sewa diperbarui'
    )
  )
);

router.delete(
  '/rentals/:id',
  adminOnly,
  wrap(async (req, res) => {
    await prisma.rentalItem.delete({ where: { id: req.params.id } });
    return ok(res, null, 'Alat sewa dihapus');
  })
);

/* ---------------------------------- guides ---------------------------------- */

router.get(
  '/guides',
  wrap(async (req, res) =>
    ok(
      res,
      await prisma.guide.findMany({
        where: req.query.all === '1' ? {} : { isAvailable: true },
        orderBy: [{ type: 'asc' }, { rating: 'desc' }],
      })
    )
  )
);

const guideSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(8),
  type: z.nativeEnum(GuideType).default(GuideType.GUIDE),
  ratePerDay: z.number().int().nonnegative(),
  experienceYears: z.number().int().nonnegative().default(0),
  rating: z.number().min(0).max(5).default(5),
  bio: z.string().optional(),
  photoUrl: z.string().optional(),
  isAvailable: z.boolean().default(true),
});

router.post(
  '/guides',
  adminOnly,
  wrap(async (req, res) => created(res, await prisma.guide.create({ data: guideSchema.parse(req.body) })))
);

router.put(
  '/guides/:id',
  adminOnly,
  wrap(async (req, res) =>
    ok(
      res,
      await prisma.guide.update({
        where: { id: req.params.id },
        data: guideSchema.partial().parse(req.body),
      }),
      'Guide diperbarui'
    )
  )
);

router.delete(
  '/guides/:id',
  adminOnly,
  wrap(async (req, res) => {
    await prisma.guide.delete({ where: { id: req.params.id } });
    return ok(res, null, 'Guide dihapus');
  })
);

/* ----------------------------------- gates ---------------------------------- */

router.get(
  '/gates',
  wrap(async (_req, res) =>
    ok(res, await prisma.gate.findMany({ orderBy: { name: 'asc' }, include: { trail: true } }))
  )
);

const gateSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(2),
  lat: z.number(),
  lng: z.number(),
  trailId: z.string().uuid().optional(),
  isActive: z.boolean().default(true),
});

router.post(
  '/gates',
  adminOnly,
  wrap(async (req, res) => created(res, await prisma.gate.create({ data: gateSchema.parse(req.body) })))
);

router.put(
  '/gates/:id',
  adminOnly,
  wrap(async (req, res) =>
    ok(
      res,
      await prisma.gate.update({
        where: { id: req.params.id },
        data: gateSchema.partial().parse(req.body),
      }),
      'Pos gerbang diperbarui'
    )
  )
);

router.delete(
  '/gates/:id',
  adminOnly,
  wrap(async (req, res) => {
    await prisma.gate.delete({ where: { id: req.params.id } });
    return ok(res, null, 'Pos gerbang dihapus');
  })
);

export default router;
