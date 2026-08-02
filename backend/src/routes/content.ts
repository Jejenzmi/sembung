import { Router } from 'express';
import { z } from 'zod';
import { ContentCategory, Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError, created, ok, wrap } from '../lib/http';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
const adminOnly = [authenticate, authorize(Role.ADMIN)];

router.get(
  '/',
  wrap(async (req, res) => {
    const where = {
      ...(req.query.all === '1' ? {} : { isPublished: true }),
      ...(req.query.category ? { category: req.query.category as ContentCategory } : {}),
    };
    return ok(
      res,
      await prisma.content.findMany({ where, orderBy: { publishedAt: 'desc' }, take: 50 })
    );
  })
);

router.get(
  '/:slug',
  wrap(async (req, res) => {
    const item = await prisma.content.findFirst({
      where: { OR: [{ slug: req.params.slug }, { id: req.params.slug }] },
    });
    if (!item) throw new AppError('Konten tidak ditemukan', 404);
    return ok(res, item);
  })
);

const contentSchema = z.object({
  title: z.string().min(3),
  slug: z.string().min(3),
  category: z.nativeEnum(ContentCategory).default(ContentCategory.NEWS),
  excerpt: z.string().optional(),
  body: z.string().min(10),
  imageUrl: z.string().optional(),
  isPublished: z.boolean().default(true),
});

router.post(
  '/',
  adminOnly,
  wrap(async (req, res) => created(res, await prisma.content.create({ data: contentSchema.parse(req.body) })))
);

router.put(
  '/:id',
  adminOnly,
  wrap(async (req, res) =>
    ok(
      res,
      await prisma.content.update({
        where: { id: req.params.id },
        data: contentSchema.partial().parse(req.body),
      }),
      'Konten diperbarui'
    )
  )
);

router.delete(
  '/:id',
  adminOnly,
  wrap(async (req, res) => {
    await prisma.content.delete({ where: { id: req.params.id } });
    return ok(res, null, 'Konten dihapus');
  })
);

export default router;
