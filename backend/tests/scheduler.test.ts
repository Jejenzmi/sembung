import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { api, bearer, bookingLunas, hariKe, prisma, resetDb, seedFixtures, type Fixtures } from './helpers';
import { alertOverdueGroups, expireStaleBookings } from '../src/services/scheduler';

let f: Fixtures;
beforeEach(async () => {
  await resetDb();
  f = await seedFixtures();
});
afterAll(() => prisma.$disconnect());

describe('Penjadwal kedaluwarsa & rombongan telat', () => {
  it('melepas kuota dan stok dari booking yang tak dibayar', async () => {
    const awal = (await prisma.rentalItem.findUniqueOrThrow({ where: { id: f.rentalId } })).stock;
    const b = await api()
      .post('/api/bookings')
      .set(bearer(f.visitor.token))
      .send({
        trailId: f.trailId,
        startDate: hariKe(3),
        endDate: hariKe(3),
        members: [{ name: 'Ani' }, { name: 'Budi' }],
        tickets: [{ id: f.ticketId, qty: 2 }],
        rentals: [{ id: f.rentalId, qty: 2 }],
      });
    const id = b.body.data.id;

    const terpakai = (await api().get(`/api/trails/${f.trailId}/quota?date=${hariKe(3)}`)).body.data.booked;
    expect(terpakai).toBe(2);

    await prisma.booking.update({ where: { id }, data: { expiresAt: new Date(Date.now() - 3600_000) } });
    expect(await expireStaleBookings()).toBe(1);

    expect((await prisma.booking.findUniqueOrThrow({ where: { id } })).status).toBe('EXPIRED');
    expect((await prisma.rentalItem.findUniqueOrThrow({ where: { id: f.rentalId } })).stock).toBe(awal);
    expect((await api().get(`/api/trails/${f.trailId}/quota?date=${hariKe(3)}`)).body.data.booked).toBe(0);
  });

  it('tidak menyentuh booking yang masih dalam tenggat', async () => {
    await api()
      .post('/api/bookings')
      .set(bearer(f.visitor.token))
      .send({
        trailId: f.trailId,
        startDate: hariKe(3),
        endDate: hariKe(3),
        members: [{ name: 'Ani' }],
        tickets: [{ id: f.ticketId, qty: 1 }],
      });
    expect(await expireStaleBookings()).toBe(0);
  });

  it('memperingatkan rombongan yang belum turun, tepat sekali', async () => {
    const b = await bookingLunas(f, { start: hariKe(-5), end: hariKe(-4) });
    await api().post('/api/gate/check-in').set(bearer(f.officer.token)).send({ token: b.qrToken, gateId: f.gateId });

    expect(await alertOverdueGroups()).toBe(1);
    const pertama = await prisma.notification.count({ where: { refType: 'BOOKING_OVERDUE' } });
    expect(pertama).toBeGreaterThan(0);

    // Sapuan kedua tidak boleh membanjiri petugas dengan peringatan yang sama.
    expect(await alertOverdueGroups()).toBe(0);
    expect(await prisma.notification.count({ where: { refType: 'BOOKING_OVERDUE' } })).toBe(pertama);
  });

  it('tidak memperingatkan rombongan yang masih dalam jadwal', async () => {
    const b = await bookingLunas(f, { start: hariKe(0), end: hariKe(1) });
    await api().post('/api/gate/check-in').set(bearer(f.officer.token)).send({ token: b.qrToken, gateId: f.gateId });
    expect(await alertOverdueGroups()).toBe(0);
  });
});
