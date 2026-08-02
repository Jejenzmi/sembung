import { Router } from 'express';
import { z } from 'zod';
import { Role, VoucherType } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { created, ok, wrap } from '../lib/http';
import { authenticate, authorize } from '../middleware/auth';
import { hitungVoucher } from '../services/voucher';

const router = Router();

/** Pendaki mengecek voucher sebelum melanjutkan pembayaran. */
router.post(
  '/check',
  authenticate,
  wrap(async (req, res) => {
    const body = z
      .object({
        code: z.string().min(3),
        subtotal: z.number().int().nonnegative(),
        trailId: z.string().uuid(),
        startDate: z.string(),
      })
      .parse(req.body);

    const hasil = await hitungVoucher(
      body.code,
      body.subtotal,
      body.trailId,
      new Date(body.startDate)
    );
    return ok(res, {
      code: hasil.voucher.code,
      name: hasil.voucher.name,
      discount: hasil.discount,
      total: Math.max(0, body.subtotal - hasil.discount),
    }, `Voucher ${hasil.voucher.code} dipakai`);
  })
);

/** Voucher yang sedang berjalan, untuk dipajang di aplikasi. */
router.get(
  '/active',
  wrap(async (_req, res) => {
    const hari = new Date();
    hari.setUTCHours(0, 0, 0, 0);
    const rows = await prisma.voucher.findMany({
      where: {
        isActive: true,
        validFrom: { lte: hari },
        validUntil: { gte: hari },
      },
      orderBy: { validUntil: 'asc' },
      select: {
        code: true, name: true, type: true, value: true, maxDiscount: true,
        minSpend: true, validUntil: true, description: true, quota: true, used: true,
      },
    });
    // Voucher yang kuotanya habis tidak perlu dipajang.
    return ok(res, rows.filter((v) => v.quota === 0 || v.used < v.quota));
  })
);

const adminOnly = [authenticate, authorize(Role.ADMIN)];

router.get(
  '/',
  adminOnly,
  wrap(async (_req, res) =>
    ok(
      res,
      await prisma.voucher.findMany({
        orderBy: { createdAt: 'desc' },
        include: { trail: { select: { name: true } }, _count: { select: { usages: true } } },
      })
    )
  )
);

const schema = z.object({
  code: z.string().min(3).transform((v) => v.trim().toUpperCase()),
  name: z.string().min(3),
  type: z.nativeEnum(VoucherType).default(VoucherType.PERCENT),
  value: z.number().int().positive(),
  maxDiscount: z.number().int().positive().nullable().optional(),
  minSpend: z.number().int().nonnegative().default(0),
  quota: z.number().int().nonnegative().default(0),
  validFrom: z.string(),
  validUntil: z.string(),
  trailId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().default(true),
  description: z.string().optional(),
});

const siapkan = (b: z.infer<typeof schema>) => ({
  ...b,
  validFrom: new Date(b.validFrom),
  validUntil: new Date(b.validUntil),
  trailId: b.trailId || null,
  maxDiscount: b.maxDiscount ?? null,
});

router.post(
  '/',
  adminOnly,
  wrap(async (req, res) => {
    const body = schema.parse(req.body);
    if (body.type === VoucherType.PERCENT && body.value > 100)
      return created(res, null, 'Persentase tidak boleh lebih dari 100');
    return created(res, await prisma.voucher.create({ data: siapkan(body) }), 'Voucher dibuat');
  })
);

router.put(
  '/:code',
  adminOnly,
  wrap(async (req, res) => {
    const body = schema.partial().parse(req.body);
    const data: Record<string, unknown> = { ...body };
    if (body.validFrom) data.validFrom = new Date(body.validFrom);
    if (body.validUntil) data.validUntil = new Date(body.validUntil);
    return ok(
      res,
      await prisma.voucher.update({ where: { code: req.params.code.toUpperCase() }, data }),
      'Voucher diperbarui'
    );
  })
);

router.delete(
  '/:code',
  adminOnly,
  wrap(async (req, res) => {
    // Voucher yang pernah dipakai hanya dinonaktifkan agar jejak diskon tetap utuh.
    const dipakai = await prisma.voucherUsage.count({
      where: { voucherCode: req.params.code.toUpperCase() },
    });
    if (dipakai > 0) {
      await prisma.voucher.update({
        where: { code: req.params.code.toUpperCase() },
        data: { isActive: false },
      });
      return ok(res, null, `Voucher sudah dipakai ${dipakai}×, dinonaktifkan alih-alih dihapus`);
    }
    await prisma.voucher.delete({ where: { code: req.params.code.toUpperCase() } });
    return ok(res, null, 'Voucher dihapus');
  })
);

export default router;
