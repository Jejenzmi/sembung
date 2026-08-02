import crypto from 'crypto';
import { Request } from 'express';

/** Raw body kept by the JSON parser so webhook signatures can be verified. */
declare module 'express-serve-static-core' {
  interface Request {
    rawBody?: Buffer;
  }
}

export const webhookSecret = () => process.env.PAYMENT_WEBHOOK_SECRET || '';

/**
 * Timing-safe comparison of an `sha256=<hex>` HMAC over the exact bytes the
 * gateway sent. Any mismatch — including a missing secret — is a rejection.
 */
export function verifyWebhookSignature(req: Request, header?: string): boolean {
  const secret = webhookSecret();
  if (!secret) return false;

  const provided = (header ?? '').replace(/^sha256=/i, '').trim();
  if (!provided) return false;

  const payload = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(provided.toLowerCase(), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Simulation mode keeps the demo end-to-end flow usable outside production. */
export const simulationEnabled = () =>
  (process.env.PAYMENT_MODE || 'simulation').toLowerCase() === 'simulation';
