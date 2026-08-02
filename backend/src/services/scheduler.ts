import { BookingStatus, PaymentStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { emit } from '../lib/realtime';
import { releaseRentals } from './booking';
import { notifyStaff } from './notify';
import { getNumber } from './settings';

/**
 * Releases the quota and rental stock held by bookings that were never paid.
 * Without this an abandoned checkout blocks a slot forever.
 */
export async function expireStaleBookings() {
  const stale = await prisma.booking.findMany({
    where: {
      status: BookingStatus.PENDING_PAYMENT,
      expiresAt: { not: null, lt: new Date() },
    },
    select: { id: true, code: true },
  });
  if (!stale.length) return 0;

  for (const booking of stale) {
    await releaseRentals(booking.id);
    await prisma.$transaction([
      prisma.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.EXPIRED },
      }),
      prisma.payment.updateMany({
        where: { bookingId: booking.id, status: PaymentStatus.PENDING },
        data: { status: PaymentStatus.FAILED },
      }),
    ]);
    emit('booking:expired', { id: booking.id, code: booking.code });
  }

  console.log(`⏳ ${stale.length} booking kedaluwarsa dilepas`);
  return stale.length;
}

/**
 * Flags groups that are still checked in well past their planned descent, and
 * alerts the rangers once per group.
 */
export async function alertOverdueGroups() {
  const graceHours = await getNumber('OVERDUE_GRACE_HOURS');
  const cutoff = new Date(Date.now() - graceHours * 3_600_000);

  const overdue = await prisma.booking.findMany({
    where: {
      status: BookingStatus.CHECKED_IN,
      overdueAlertedAt: null,
      endDate: { lt: cutoff },
    },
    include: {
      trail: { select: { name: true } },
      user: { select: { name: true, phone: true, emergencyPhone: true } },
      trackPings: { orderBy: { at: 'desc' }, take: 1 },
    },
  });
  if (!overdue.length) return 0;

  for (const b of overdue) {
    const ping = b.trackPings[0];
    await notifyStaff({
      subject: `Rombongan belum turun — ${b.code}`,
      body:
        `${b.user.name} (${b.user.phone}) bersama ${b.totalPersons} orang di ${b.trail.name} ` +
        `belum check-out. Rencana turun ${b.endDate.toISOString().slice(0, 10)}.\n` +
        (ping
          ? `Lokasi terakhir ${ping.lat.toFixed(5)}, ${ping.lng.toFixed(5)} pada ${ping.at.toISOString()}.`
          : 'Belum ada laporan lokasi dari aplikasi.'),
      refType: 'BOOKING_OVERDUE',
      refId: b.id,
      extraPhones: b.user.emergencyPhone ? [b.user.emergencyPhone] : [],
    });

    await prisma.booking.update({
      where: { id: b.id },
      data: { overdueAlertedAt: new Date() },
    });
    emit('booking:overdue', { id: b.id, code: b.code, persons: b.totalPersons });
  }

  console.log(`🚨 ${overdue.length} rombongan telat turun dilaporkan`);
  return overdue.length;
}

export async function runSweep() {
  try {
    await expireStaleBookings();
    await alertOverdueGroups();
  } catch (e) {
    console.error('Sweep gagal:', e);
  }
}

/** Started from index.ts; one in-process timer is enough at this scale. */
export function startScheduler(intervalMs = 60_000) {
  runSweep();
  const timer = setInterval(runSweep, intervalMs);
  timer.unref();
  return timer;
}
