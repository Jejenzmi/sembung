import { prisma } from '../lib/prisma';

/**
 * Operational settings live in the database so the park manager can change the
 * service fee or the payment window without a redeploy. Values are cached for a
 * short while because the booking hot path reads them on every quote.
 */
export const DEFAULTS: Record<string, string> = {
  SERVICE_FEE: '5000',
  BOOKING_HOLD_MINUTES: '120',
  OVERDUE_GRACE_HOURS: '12',
  PARK_NAME: 'Kawasan Wisata Gunung Sembung',
  PARK_PHONE: '0264-000111',
  SAR_PHONE: '115',
  LAST_ASCENT_HOUR: '16',
};

const TTL_MS = 30_000;
let cache: Record<string, string> = {};
let loadedAt = 0;

async function load() {
  if (Date.now() - loadedAt < TTL_MS && Object.keys(cache).length) return cache;
  const rows = await prisma.setting.findMany();
  cache = { ...DEFAULTS };
  for (const row of rows) cache[row.key] = row.value;
  loadedAt = Date.now();
  return cache;
}

export const invalidateSettings = () => {
  loadedAt = 0;
};

export async function getSetting(key: string): Promise<string> {
  const all = await load();
  return all[key] ?? DEFAULTS[key] ?? '';
}

export async function getNumber(key: string): Promise<number> {
  const value = Number(await getSetting(key));
  return Number.isFinite(value) ? value : Number(DEFAULTS[key] ?? 0);
}

export async function allSettings() {
  const rows = await prisma.setting.findMany({ orderBy: { key: 'asc' } });
  const stored = new Map(rows.map((r) => [r.key, r]));
  // Surface defaults that were never persisted so the admin UI can show them.
  return Object.keys(DEFAULTS).map((key) => ({
    key,
    value: stored.get(key)?.value ?? DEFAULTS[key],
    isDefault: !stored.has(key),
    updatedAt: stored.get(key)?.updatedAt ?? null,
  }));
}

export async function setSetting(key: string, value: string) {
  const row = await prisma.setting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
  invalidateSettings();
  return row;
}
