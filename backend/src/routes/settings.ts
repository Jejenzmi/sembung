import { Router } from 'express';
import { z } from 'zod';
import { NotifStatus, Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { meta, ok, paginate, wrap } from '../lib/http';
import { authenticate, authorize, staffOnly } from '../middleware/auth';
import { allSettings, setSetting } from '../services/settings';
import { runSweep } from '../services/scheduler';

const router = Router();

router.get(
  '/',
  authenticate,
  authorize(Role.ADMIN),
  wrap(async (_req, res) => ok(res, await allSettings()))
);

router.put(
  '/',
  authenticate,
  authorize(Role.ADMIN),
  wrap(async (req, res) => {
    const body = z.record(z.string()).parse(req.body);
    const saved = [];
    for (const [key, value] of Object.entries(body)) {
      saved.push(await setSetting(key, value));
    }
    return ok(res, saved, `${saved.length} pengaturan disimpan`);
  })
);

/** Outbound notification trail — proves whether an SOS actually went out. */
router.get(
  '/notifications',
  authenticate,
  staffOnly,
  wrap(async (req, res) => {
    const { page, limit, skip } = paginate(req.query);
    const where = {
      ...(req.query.status ? { status: req.query.status as NotifStatus } : {}),
      ...(req.query.refType ? { refType: req.query.refType as string } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notification.count({ where }),
    ]);
    return res.json({ success: true, data: rows, meta: meta(total, page, limit) });
  })
);

/** Audit trail of every state-changing request by staff. */
router.get(
  '/audit',
  authenticate,
  authorize(Role.ADMIN),
  wrap(async (req, res) => {
    const { page, limit, skip } = paginate(req.query);
    const q = (req.query.q as string) || '';
    const where = {
      ...(req.query.userId ? { userId: req.query.userId as string } : {}),
      ...(q ? { path: { contains: q, mode: 'insensitive' as const } } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.auditLog.findMany({ where, skip, take: limit, orderBy: { at: 'desc' } }),
      prisma.auditLog.count({ where }),
    ]);
    return res.json({ success: true, data: rows, meta: meta(total, page, limit) });
  })
);

/** Lets an admin run the expiry/overdue sweep on demand instead of waiting. */
router.post(
  '/run-sweep',
  authenticate,
  authorize(Role.ADMIN),
  wrap(async (_req, res) => {
    await runSweep();
    return ok(res, null, 'Sapuan kedaluwarsa & rombongan telat dijalankan');
  })
);

export default router;
