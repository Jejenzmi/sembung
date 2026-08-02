import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';

const SENSITIVE = ['password', 'oldPassword', 'newPassword', 'passwordHash', 'token'];

/** Never persist credentials, even in an audit trail. */
function scrub(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrub);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        SENSITIVE.includes(k) ? '***' : scrub(v),
      ])
    );
  }
  return value;
}

/**
 * Records every state-changing request. Attached once at the app level so a new
 * route cannot forget to be audited.
 */
export function audit(req: Request, res: Response, next: NextFunction) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();

  res.on('finish', () => {
    // Failed auth attempts are worth keeping; noisy 404s are not.
    if (res.statusCode === 404) return;

    let payload: string | undefined;
    try {
      payload = JSON.stringify(scrub(req.body)).slice(0, 4000);
    } catch {
      payload = undefined;
    }

    prisma.auditLog
      .create({
        data: {
          userId: req.user?.sub,
          userName: req.user?.name,
          role: req.user?.role,
          method: req.method,
          path: req.originalUrl.split('?')[0],
          status: res.statusCode,
          payload,
          ip: req.ip,
        },
      })
      .catch(() => undefined);
  });

  next();
}
