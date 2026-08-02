import crypto from 'crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { api, bearer, hariKe, prisma, resetDb, seedFixtures, type Fixtures } from './helpers';

let f: Fixtures;
beforeEach(async () => {
  await resetDb();
  f = await seedFixtures();
});
afterAll(() => prisma.$disconnect());

async function tagihan() {
  const b = await api()
    .post('/api/bookings')
    .set(bearer(f.visitor.token))
    .send({
      trailId: f.trailId,
      startDate: hariKe(3),
      endDate: hariKe(3),
      members: [{ name: 'Ketua' }],
      tickets: [{ id: f.ticketId, qty: 1 }],
    });
  const bayar = await api()
    .post(`/api/bookings/${b.body.data.id}/pay`)
    .set(bearer(f.visitor.token))
    .send({ method: 'QRIS' });
  return { id: b.body.data.id as string, reference: bayar.body.data.reference as string };
}

const tandatangan = (body: string) =>
  crypto.createHmac('sha256', process.env.PAYMENT_WEBHOOK_SECRET!).update(body).digest('hex');

describe('Keamanan pembayaran', () => {
  it('endpoint konfirmasi lama sudah tidak ada', async () => {
    const { reference } = await tagihan();
    const res = await api().post(`/api/bookings/payments/${reference}/confirm`);
    expect(res.status).toBe(404);
  });

  it('menolak webhook tanpa signature', async () => {
    const { reference } = await tagihan();
    const res = await api().post('/api/bookings/payments/webhook').send({ reference, status: 'PAID' });
    expect(res.status).toBe(401);
  });

  it('menolak webhook dengan signature keliru', async () => {
    const { reference } = await tagihan();
    const res = await api()
      .post('/api/bookings/payments/webhook')
      .set('X-Signature', 'sha256=deadbeef')
      .send({ reference, status: 'PAID' });
    expect(res.status).toBe(401);
  });

  it('menerima webhook dengan signature sah', async () => {
    const { id, reference } = await tagihan();
    const body = JSON.stringify({ reference, status: 'PAID' });
    const res = await api()
      .post('/api/bookings/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('X-Signature', `sha256=${tandatangan(body)}`)
      .send(body);
    expect(res.status).toBe(200);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id } })).status).toBe('PAID');
  });

  it('signature dihitung atas byte asli, bukan objek yang sudah diurai', async () => {
    const { reference } = await tagihan();
    // Signature sah untuk susunan kunci berbeda tidak boleh diterima.
    const lain = JSON.stringify({ status: 'PAID', reference });
    const dikirim = JSON.stringify({ reference, status: 'PAID' });
    const res = await api()
      .post('/api/bookings/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('X-Signature', `sha256=${tandatangan(lain)}`)
      .send(dikirim);
    expect(res.status).toBe(401);
  });

  it('simulasi hanya untuk pemilik booking', async () => {
    const { id } = await tagihan();
    expect((await api().post(`/api/bookings/${id}/simulate-payment`)).status).toBe(401);
    expect(
      (await api().post(`/api/bookings/${id}/simulate-payment`).set(bearer(f.visitor2.token))).status
    ).toBe(403);
    expect(
      (await api().post(`/api/bookings/${id}/simulate-payment`).set(bearer(f.visitor.token))).status
    ).toBe(200);
  });

  it('menolak pelunasan booking yang sudah kedaluwarsa', async () => {
    const { id } = await tagihan();
    await prisma.booking.update({ where: { id }, data: { status: 'EXPIRED' } });
    const res = await api().post(`/api/bookings/${id}/simulate-payment`).set(bearer(f.visitor.token));
    expect(res.status).toBe(409);
  });

  it('membebaskan booking lunas dari sapuan kedaluwarsa', async () => {
    const { id } = await tagihan();
    await api().post(`/api/bookings/${id}/simulate-payment`).set(bearer(f.visitor.token));
    expect((await prisma.booking.findUniqueOrThrow({ where: { id } })).expiresAt).toBeNull();
  });
});
