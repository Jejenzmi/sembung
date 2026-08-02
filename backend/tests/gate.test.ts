import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { api, bearer, bookingLunas, hariKe, prisma, resetDb, seedFixtures, type Fixtures } from './helpers';

let f: Fixtures;
beforeEach(async () => {
  await resetDb();
  f = await seedFixtures();
});
afterAll(() => prisma.$disconnect());

describe('Pos gerbang', () => {
  it('menandai E-Pass yang belum berlaku tanpa memblokir petugas', async () => {
    const b = await bookingLunas(f, { start: hariKe(5) });
    const res = await api().post('/api/gate/scan').set(bearer(f.officer.token)).send({ token: b.qrToken });
    expect(res.body.data.valid).toBe(false);
    expect(res.body.data.reasons.join(' ')).toMatch(/Baru berlaku/);
    expect(res.body.data.nextAction).toBe('CHECK_IN');
  });

  it('menolak E-Pass tak dikenal', async () => {
    const res = await api().post('/api/gate/scan').set(bearer(f.officer.token)).send({ token: 'entah' });
    expect(res.status).toBe(404);
  });

  it('mencatat check-in dan menambah okupansi', async () => {
    const b = await bookingLunas(f, { persons: 3 });
    const sebelum = (await api().get('/api/dashboard/capacity')).body.data.totalPersons;
    const res = await api()
      .post('/api/gate/check-in')
      .set(bearer(f.officer.token))
      .send({ token: b.qrToken, gateId: f.gateId, personCount: 3 });
    expect(res.status).toBe(201);
    const sesudah = (await api().get('/api/dashboard/capacity')).body.data.totalPersons;
    expect(sesudah).toBe(sebelum + 3);
  });

  it('menolak check-in ganda', async () => {
    const b = await bookingLunas(f);
    await api().post('/api/gate/check-in').set(bearer(f.officer.token)).send({ token: b.qrToken, gateId: f.gateId });
    const lagi = await api()
      .post('/api/gate/check-in')
      .set(bearer(f.officer.token))
      .send({ token: b.qrToken, gateId: f.gateId });
    expect(lagi.status).toBe(409);
  });

  it('menolak check-out sebelum check-in', async () => {
    const b = await bookingLunas(f);
    const res = await api()
      .post('/api/gate/check-out')
      .set(bearer(f.officer.token))
      .send({ token: b.qrToken, gateId: f.gateId });
    expect(res.status).toBe(400);
  });

  it('mencatat sampah dan mengembalikan alat saat check-out', async () => {
    const created = await api()
      .post('/api/bookings')
      .set(bearer(f.visitor.token))
      .send({
        trailId: f.trailId,
        startDate: hariKe(0),
        endDate: hariKe(0),
        members: [{ name: 'Ketua' }],
        tickets: [{ id: f.ticketId, qty: 1 }],
        rentals: [{ id: f.rentalId, qty: 2 }],
      });
    const id = created.body.data.id;
    await api().post(`/api/bookings/${id}/pay`).set(bearer(f.visitor.token)).send({ method: 'CASH' });
    await api().post(`/api/bookings/${id}/simulate-payment`).set(bearer(f.visitor.token));
    const epass = await api().get(`/api/bookings/${id}/epass`).set(bearer(f.visitor.token));
    const token = epass.body.data.qrToken;

    const stokTerpakai = (await prisma.rentalItem.findUniqueOrThrow({ where: { id: f.rentalId } })).stock;
    await api().post('/api/gate/check-in').set(bearer(f.officer.token)).send({ token, gateId: f.gateId });
    await api()
      .post('/api/gate/check-out')
      .set(bearer(f.officer.token))
      .send({ token, gateId: f.gateId, wasteKg: 3.5 });

    expect((await prisma.rentalItem.findUniqueOrThrow({ where: { id: f.rentalId } })).stock).toBe(stokTerpakai + 2);
    const log = await prisma.checkLog.findFirstOrThrow({ where: { type: 'CHECK_OUT' } });
    expect(log.wasteKg).toBe(3.5);
  });

  it('melaporkan selisih orang yang belum turun', async () => {
    const b = await bookingLunas(f, { persons: 4 });
    await api().post('/api/gate/check-in').set(bearer(f.officer.token)).send({ token: b.qrToken, gateId: f.gateId });
    const res = await api()
      .post('/api/gate/check-out')
      .set(bearer(f.officer.token))
      .send({ token: b.qrToken, gateId: f.gateId, personCount: 3 });
    expect(res.body.data.missing).toBe(1);
    expect(res.body.message).toMatch(/belum turun/);
  });
});
