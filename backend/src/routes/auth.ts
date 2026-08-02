import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError, created, ok, wrap } from '../lib/http';
import { authenticate, signToken } from '../middleware/auth';
import { rateLimit, resetLimit } from '../middleware/ratelimit';

const router = Router();

const publicUser = {
  id: true,
  name: true,
  username: true,
  email: true,
  phone: true,
  role: true,
  nik: true,
  address: true,
  emergencyName: true,
  emergencyPhone: true,
  avatarUrl: true,
  isActive: true,
  createdAt: true,
} as const;

const registerSchema = z.object({
  name: z.string().min(3),
  phone: z.string().min(8),
  email: z.string().email().optional(),
  password: z.string().min(6),
  nik: z.string().optional(),
  emergencyName: z.string().optional(),
  emergencyPhone: z.string().optional(),
});

router.post(
  '/register',
  wrap(async (req, res) => {
    const body = registerSchema.parse(req.body);
    const exists = await prisma.user.findFirst({
      where: { OR: [{ phone: body.phone }, ...(body.email ? [{ email: body.email }] : [])] },
    });
    if (exists) throw new AppError('Nomor HP atau email sudah terdaftar', 409);

    const user = await prisma.user.create({
      data: {
        name: body.name,
        phone: body.phone,
        email: body.email,
        nik: body.nik,
        emergencyName: body.emergencyName,
        emergencyPhone: body.emergencyPhone,
        passwordHash: await bcrypt.hash(body.password, 10),
        role: Role.VISITOR,
      },
      select: publicUser,
    });

    return created(res, {
      user,
      token: signToken({ sub: user.id, role: user.role, name: user.name }),
    }, 'Registrasi berhasil');
  })
);

const loginSchema = z.object({
  identifier: z.string().min(3),
  password: z.string().min(1),
});

/** Brute-force guard: 8 attempts per IP+identifier per 10 minutes. */
const loginLimiter = rateLimit({
  windowMs: 10 * 60_000,
  max: 8,
  keyBy: (req) => `login:${req.ip}:${(req.body?.identifier ?? '').toString().toLowerCase()}`,
  message: 'Terlalu banyak percobaan masuk',
});

router.post(
  '/login',
  loginLimiter,
  wrap(async (req, res) => {
    const { identifier, password } = loginSchema.parse(req.body);
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ username: identifier }, { email: identifier }, { phone: identifier }],
      },
    });
    if (!user || !(await bcrypt.compare(password, user.passwordHash)))
      throw new AppError('Kredensial tidak valid', 401);
    if (!user.isActive) throw new AppError('Akun dinonaktifkan', 403);

    // Honest users get their counter cleared the moment they succeed.
    resetLimit(`login:${req.ip}:${identifier.toLowerCase()}`);
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const { passwordHash, ...safe } = user;
    return ok(res, {
      user: safe,
      token: signToken({ sub: user.id, role: user.role, name: user.name }),
    }, 'Login berhasil');
  })
);

router.get(
  '/me',
  authenticate,
  wrap(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.sub },
      select: publicUser,
    });
    if (!user) throw new AppError('Pengguna tidak ditemukan', 404);
    return ok(res, user);
  })
);

const profileSchema = z.object({
  name: z.string().min(3).optional(),
  email: z.string().email().optional(),
  nik: z.string().optional(),
  address: z.string().optional(),
  emergencyName: z.string().optional(),
  emergencyPhone: z.string().optional(),
  avatarUrl: z.string().optional(),
});

router.put(
  '/me',
  authenticate,
  wrap(async (req, res) => {
    const body = profileSchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.user!.sub },
      data: body,
      select: publicUser,
    });
    return ok(res, user, 'Profil diperbarui');
  })
);

router.post(
  '/change-password',
  authenticate,
  wrap(async (req, res) => {
    const { oldPassword, newPassword } = z
      .object({ oldPassword: z.string(), newPassword: z.string().min(6) })
      .parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
    if (!user || !(await bcrypt.compare(oldPassword, user.passwordHash)))
      throw new AppError('Kata sandi lama salah', 400);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(newPassword, 10) },
    });
    return ok(res, null, 'Kata sandi diperbarui');
  })
);

export default router;
