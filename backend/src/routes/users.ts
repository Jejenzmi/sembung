import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { created, meta, ok, paginate, wrap } from '../lib/http';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate, authorize(Role.ADMIN));

const select = {
  id: true,
  name: true,
  username: true,
  email: true,
  phone: true,
  role: true,
  nik: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  _count: { select: { bookings: true } },
} as const;

router.get(
  '/',
  wrap(async (req, res) => {
    const { page, limit, skip } = paginate(req.query);
    const q = (req.query.q as string) || '';
    const where = {
      ...(req.query.role ? { role: req.query.role as Role } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' as const } },
              { phone: { contains: q } },
              { email: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.user.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, select }),
      prisma.user.count({ where }),
    ]);
    return res.json({ success: true, data: rows, meta: meta(total, page, limit) });
  })
);

const userSchema = z.object({
  name: z.string().min(3),
  phone: z.string().min(8),
  username: z.string().min(3).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6),
  role: z.nativeEnum(Role),
  nik: z.string().optional(),
  isActive: z.boolean().default(true),
});

router.post(
  '/',
  wrap(async (req, res) => {
    const { password, ...rest } = userSchema.parse(req.body);
    return created(
      res,
      await prisma.user.create({
        data: { ...rest, passwordHash: await bcrypt.hash(password, 10) },
        select,
      }),
      'Pengguna dibuat'
    );
  })
);

router.put(
  '/:id',
  wrap(async (req, res) => {
    const { password, ...rest } = userSchema.partial().parse(req.body);
    return ok(
      res,
      await prisma.user.update({
        where: { id: req.params.id },
        data: {
          ...rest,
          ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
        },
        select,
      }),
      'Pengguna diperbarui'
    );
  })
);

router.delete(
  '/:id',
  wrap(async (req, res) => {
    await prisma.user.update({ where: { id: req.params.id }, data: { isActive: false } });
    return ok(res, null, 'Pengguna dinonaktifkan');
  })
);

export default router;
