import { BookingStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';

/** Bookings that occupy a quota slot: paid, or awaiting payment but not yet expired. */
const OCCUPYING: BookingStatus[] = [
  BookingStatus.PENDING_PAYMENT,
  BookingStatus.PAID,
  BookingStatus.CHECKED_IN,
];

export const startOfDay = (value: string | Date) => {
  const d = new Date(value);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

export async function quotaForDate(trailId: string, date: string | Date) {
  const trail = await prisma.trail.findUnique({ where: { id: trailId } });
  if (!trail) return null;

  const day = startOfDay(date);
  // A group on a two-night trip occupies the mountain on every day of its stay,
  // so the slot is counted across the whole range, not only the departure date.
  const agg = await prisma.booking.aggregate({
    where: {
      trailId,
      startDate: { lte: day },
      endDate: { gte: day },
      status: { in: OCCUPYING },
    },
    _sum: { totalPersons: true },
  });

  const booked = agg._sum.totalPersons ?? 0;
  const quota = trail.status === 'CLOSED' ? 0 : trail.dailyQuota;
  return {
    trailId,
    trailName: trail.name,
    date: day.toISOString().slice(0, 10),
    quota,
    booked,
    remaining: Math.max(0, quota - booked),
    status: trail.status,
  };
}

/** Quota outlook for the next `days` days, used by the mobile date picker. */
export async function quotaCalendar(trailId: string, days = 30) {
  const today = startOfDay(new Date());
  const until = new Date(today);
  until.setUTCDate(until.getUTCDate() + days);

  const trail = await prisma.trail.findUnique({ where: { id: trailId } });
  if (!trail) return [];

  // Fetch every stay overlapping the window, then spread each group across the
  // days it actually occupies.
  const stays = await prisma.booking.findMany({
    where: {
      trailId,
      startDate: { lt: until },
      endDate: { gte: today },
      status: { in: OCCUPYING },
    },
    select: { startDate: true, endDate: true, totalPersons: true },
  });

  const bookedBy = new Map<string, number>();
  for (const stay of stays) {
    const cursor = new Date(stay.startDate);
    while (cursor <= stay.endDate) {
      const key = cursor.toISOString().slice(0, 10);
      bookedBy.set(key, (bookedBy.get(key) ?? 0) + stay.totalPersons);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  const quota = trail.status === 'CLOSED' ? 0 : trail.dailyQuota;
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    const booked = bookedBy.get(key) ?? 0;
    return { date: key, quota, booked, remaining: Math.max(0, quota - booked) };
  });
}

/** People physically on the mountain right now. */
export async function liveOccupancy() {
  const byTrail = await prisma.booking.groupBy({
    by: ['trailId'],
    where: { status: BookingStatus.CHECKED_IN },
    _sum: { totalPersons: true },
    _count: { _all: true },
  });

  const trails = await prisma.trail.findMany({
    select: { id: true, name: true, dailyQuota: true, status: true },
  });

  const detail = trails.map((t) => {
    const row = byTrail.find((b) => b.trailId === t.id);
    const persons = row?._sum.totalPersons ?? 0;
    return {
      trailId: t.id,
      trailName: t.name,
      status: t.status,
      quota: t.dailyQuota,
      groups: row?._count._all ?? 0,
      persons,
      utilization: t.dailyQuota ? Math.round((persons / t.dailyQuota) * 100) : 0,
    };
  });

  return {
    totalPersons: detail.reduce((s, d) => s + d.persons, 0),
    totalGroups: detail.reduce((s, d) => s + d.groups, 0),
    trails: detail,
  };
}
