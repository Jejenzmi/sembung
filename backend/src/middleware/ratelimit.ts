import { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/http';

interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();

/**
 * Sliding-window limiter kept in process memory. Enough for a single-node park
 * deployment; swap for Redis if the API is ever scaled horizontally.
 */
export function rateLimit({
  windowMs,
  max,
  keyBy = (req: Request) => req.ip ?? 'unknown',
  message = 'Terlalu banyak percobaan, coba lagi nanti',
}: {
  windowMs: number;
  max: number;
  keyBy?: (req: Request) => string;
  message?: string;
}) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = keyBy(req);
    const bucket = buckets.get(key) ?? { hits: [] };

    bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
    if (bucket.hits.length >= max) {
      const retryIn = Math.ceil((windowMs - (now - bucket.hits[0])) / 1000);
      buckets.set(key, bucket);
      return next(new AppError(`${message} (${retryIn} detik lagi)`, 429));
    }

    bucket.hits.push(now);
    buckets.set(key, bucket);
    next();
  };
}

/** Clears the counter after a successful login so honest users aren't punished. */
export function resetLimit(key: string) {
  buckets.delete(key);
}

// Housekeeping so an idle process does not grow the map forever.
const cleaner = setInterval(() => {
  const cutoff = Date.now() - 3_600_000;
  for (const [key, bucket] of buckets) {
    if (!bucket.hits.some((t) => t > cutoff)) buckets.delete(key);
  }
}, 600_000);
cleaner.unref();
