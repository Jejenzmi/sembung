import { Router } from 'express';
import { z } from 'zod';
import { Difficulty, PointType, Role, TrailStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError, created, ok, wrap } from '../lib/http';
import { authenticate, authorize } from '../middleware/auth';
import { quotaCalendar, quotaForDate } from '../services/quota';

const router = Router();
const adminOnly = [authenticate, authorize(Role.ADMIN)];

router.get(
  '/',
  wrap(async (_req, res) => {
    const trails = await prisma.trail.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { points: true, reviews: true } } },
    });
    const ratings = await prisma.review.groupBy({ by: ['trailId'], _avg: { rating: true } });
    return ok(
      res,
      trails.map((t) => ({
        ...t,
        rating: Number((ratings.find((r) => r.trailId === t.id)?._avg.rating ?? 0).toFixed(1)),
      }))
    );
  })
);

router.get(
  '/:slug',
  wrap(async (req, res) => {
    const trail = await prisma.trail.findFirst({
      where: { OR: [{ slug: req.params.slug }, { id: req.params.slug }] },
      include: {
        points: { orderBy: { sequence: 'asc' } },
        gates: true,
        reviews: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { name: true, avatarUrl: true } } },
        },
      },
    });
    if (!trail) throw new AppError('Jalur tidak ditemukan', 404);
    const avg = await prisma.review.aggregate({
      where: { trailId: trail.id },
      _avg: { rating: true },
      _count: true,
    });
    return ok(res, {
      ...trail,
      rating: Number((avg._avg.rating ?? 0).toFixed(1)),
      reviewCount: avg._count,
    });
  })
);

/** Offline map bundle: everything the Flutter app caches for a trail. */
router.get(
  '/:slug/offline-bundle',
  wrap(async (req, res) => {
    const trail = await prisma.trail.findFirst({
      where: { OR: [{ slug: req.params.slug }, { id: req.params.slug }] },
      include: { points: { orderBy: { sequence: 'asc' } }, gates: true },
    });
    if (!trail) throw new AppError('Jalur tidak ditemukan', 404);

    const track = trail.points
      .filter((p) => p.type !== PointType.PHOTO_SPOT)
      .map((p) => ({ lat: p.lat, lng: p.lng, ele: p.elevationM }));

    return ok(res, {
      version: trail.updatedAt.toISOString(),
      trail: {
        id: trail.id,
        code: trail.code,
        name: trail.name,
        slug: trail.slug,
        difficulty: trail.difficulty,
        distanceKm: trail.distanceKm,
        elevationGainM: trail.elevationGainM,
        summitElevM: trail.summitElevM,
        estimatedHours: trail.estimatedHours,
      },
      bbox: track.length
        ? {
            minLat: Math.min(...track.map((t) => t.lat)),
            maxLat: Math.max(...track.map((t) => t.lat)),
            minLng: Math.min(...track.map((t) => t.lng)),
            maxLng: Math.max(...track.map((t) => t.lng)),
          }
        : null,
      track,
      points: trail.points,
      gates: trail.gates,
    });
  })
);

router.get(
  '/:id/quota',
  wrap(async (req, res) => {
    const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
    const data = await quotaForDate(req.params.id, date);
    if (!data) throw new AppError('Jalur tidak ditemukan', 404);
    return ok(res, data);
  })
);

router.get(
  '/:id/quota-calendar',
  wrap(async (req, res) => {
    const days = Math.min(90, Number(req.query.days) || 30);
    return ok(res, await quotaCalendar(req.params.id, days));
  })
);

const trailSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(3),
  slug: z.string().min(3),
  difficulty: z.nativeEnum(Difficulty).default(Difficulty.MODERATE),
  status: z.nativeEnum(TrailStatus).default(TrailStatus.OPEN),
  distanceKm: z.number().positive(),
  elevationGainM: z.number().int().nonnegative(),
  summitElevM: z.number().int().nonnegative(),
  estimatedHours: z.number().positive(),
  dailyQuota: z.number().int().positive(),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
});

router.post(
  '/',
  adminOnly,
  wrap(async (req, res) => created(res, await prisma.trail.create({ data: trailSchema.parse(req.body) })))
);

router.put(
  '/:id',
  adminOnly,
  wrap(async (req, res) =>
    ok(
      res,
      await prisma.trail.update({
        where: { id: req.params.id },
        data: trailSchema.partial().parse(req.body),
      }),
      'Jalur diperbarui'
    )
  )
);

router.delete(
  '/:id',
  adminOnly,
  wrap(async (req, res) => {
    await prisma.trail.delete({ where: { id: req.params.id } });
    return ok(res, null, 'Jalur dihapus');
  })
);

const pointSchema = z.object({
  name: z.string().min(2),
  type: z.nativeEnum(PointType),
  lat: z.number(),
  lng: z.number(),
  elevationM: z.number().int().default(0),
  sequence: z.number().int().default(0),
  description: z.string().optional(),
});

router.post(
  '/:id/points',
  adminOnly,
  wrap(async (req, res) =>
    created(
      res,
      await prisma.trailPoint.create({
        data: { ...pointSchema.parse(req.body), trailId: req.params.id },
      })
    )
  )
);

router.put(
  '/points/:pointId',
  adminOnly,
  wrap(async (req, res) =>
    ok(
      res,
      await prisma.trailPoint.update({
        where: { id: req.params.pointId },
        data: pointSchema.partial().parse(req.body),
      }),
      'Titik diperbarui'
    )
  )
);

router.delete(
  '/points/:pointId',
  adminOnly,
  wrap(async (req, res) => {
    await prisma.trailPoint.delete({ where: { id: req.params.pointId } });
    return ok(res, null, 'Titik dihapus');
  })
);

export default router;
