import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { api, bearer, bookingLunas, prisma, resetDb, seedFixtures, type Fixtures } from './helpers';

let f: Fixtures;
beforeEach(async () => {
  await resetDb();
  f = await seedFixtures();
});
afterAll(() => prisma.$disconnect());

describe('Pengembalian dana', () => {
  it('menolak refund untuk booking yang belum pernah dibayar', async () => {
    const b = await api()
      .post('/api/bookings')
      .set(bearer(f.visitor.token))
      .send({
        trailId: f.trailId,
        startDate: new Date().toISOString().slice(0, 10),
        endDate: new Date().toISOString().slice(0, 10),
        members: [{ name: 'Ani' }],
        tickets: [{ id: f.ticketId, qty: 1 }],
      });
    const res = await api()
      .post(`/api/refunds/booking/${b.body.data.id}`)
      .set(bearer(f.visitor.token))
      .send({ reason: 'Berubah pikiran' });
    expect(res.status).toBe(400);
  });

  it('membatasi refund pada jumlah yang benar-benar dibayar', async () => {
    const b = await bookingLunas(f, { persons: 1 });
    const res = await api()
      .post(`/api/refunds/booking/${b.code}`)
      .set(bearer(f.admin.token))
      .send({ amount: 99_999_999, reason: 'Uji batas maksimum' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Maksimal/);
  });

  it('mencegah refund berganda melebihi pembayaran', async () => {
    const b = await bookingLunas(f, { persons: 1 });
    await api().post(`/api/refunds/booking/${b.code}`).set(bearer(f.admin.token)).send({ reason: 'Penuh' });
    const kedua = await api()
      .post(`/api/refunds/booking/${b.code}`)
      .set(bearer(f.admin.token))
      .send({ reason: 'Lagi' });
    expect(kedua.status).toBe(409);
  });

  it('hanya administrator yang boleh memutuskan', async () => {
    const b = await bookingLunas(f, { persons: 1 });
    const r = await api().post(`/api/refunds/booking/${b.code}`).set(bearer(f.admin.token)).send({ reason: 'Uji pengembalian' });
    const res = await api()
      .put(`/api/refunds/${r.body.data.id}/status`)
      .set(bearer(f.officer.token))
      .send({ status: 'APPROVED' });
    expect(res.status).toBe(403);
  });

  it('persetujuan membatalkan booking dan mengembalikan alat', async () => {
    const b = await bookingLunas(f, { persons: 1 });
    const r = await api().post(`/api/refunds/booking/${b.code}`).set(bearer(f.admin.token)).send({ reason: 'Uji pengembalian' });
    await api().put(`/api/refunds/${r.body.data.id}/status`).set(bearer(f.admin.token)).send({ status: 'APPROVED' });
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).status).toBe('CANCELLED');
  });

  it('pembatalan booking lunas otomatis membuka pengajuan refund', async () => {
    const b = await bookingLunas(f, { persons: 2 });
    const res = await api().post(`/api/bookings/${b.id}/cancel`).set(bearer(f.visitor.token));
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/refund/i);

    const refund = await prisma.refund.findFirstOrThrow({ where: { bookingId: b.id } });
    expect(refund.reason).toBe('Dibatalkan oleh pemesan');
    expect(refund.amount).toBeGreaterThan(0);
  });

  it('pembatalan booking belum lunas tidak membuat refund', async () => {
    const b = await api()
      .post('/api/bookings')
      .set(bearer(f.visitor.token))
      .send({
        trailId: f.trailId,
        startDate: new Date().toISOString().slice(0, 10),
        endDate: new Date().toISOString().slice(0, 10),
        members: [{ name: 'Ani' }],
        tickets: [{ id: f.ticketId, qty: 1 }],
      });
    await api().post(`/api/bookings/${b.body.data.id}/cancel`).set(bearer(f.visitor.token));
    expect(await prisma.refund.count()).toBe(0);
  });

  it('pendaki melihat refund miliknya sendiri', async () => {
    const b = await bookingLunas(f, { persons: 1 });
    await api().post(`/api/bookings/${b.id}/cancel`).set(bearer(f.visitor.token));
    const punyaSaya = await api().get('/api/refunds/mine').set(bearer(f.visitor.token));
    const punyaOrangLain = await api().get('/api/refunds/mine').set(bearer(f.visitor2.token));
    expect(punyaSaya.body.data.length).toBe(1);
    expect(punyaOrangLain.body.data.length).toBe(0);
  });
});
