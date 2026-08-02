import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { api, bearer, hariKe, prisma, resetDb, seedFixtures, type Fixtures } from './helpers';

let f: Fixtures;
beforeEach(async () => {
  await resetDb();
  f = await seedFixtures();
});
afterAll(() => prisma.$disconnect());

/** Pesan + bayar + naik + turun, memakai jasa pemandu. */
async function pendakianSelesai(pakaiPemandu = true) {
  const created = await api()
    .post('/api/bookings')
    .set(bearer(f.visitor.token))
    .send({
      trailId: f.trailId,
      startDate: hariKe(0),
      endDate: hariKe(0),
      members: [{ name: 'Ketua Rombongan' }],
      tickets: [{ id: f.ticketId, qty: 1 }],
      ...(pakaiPemandu ? { guides: [{ id: f.guideId, qty: 1 }] } : {}),
    });
  const id = created.body.data.id;
  await api().post(`/api/bookings/${id}/pay`).set(bearer(f.visitor.token)).send({ method: 'CASH' });
  await api().post(`/api/bookings/${id}/simulate-payment`).set(bearer(f.visitor.token));
  const epass = await api().get(`/api/bookings/${id}/epass`).set(bearer(f.visitor.token));
  const token = epass.body.data.qrToken;
  await api().post('/api/gate/check-in').set(bearer(f.officer.token)).send({ token, gateId: f.gateId });
  await api().post('/api/gate/check-out').set(bearer(f.officer.token)).send({ token, gateId: f.gateId });
  return id as string;
}

describe('Ulasan pemandu', () => {
  it('menerima ulasan setelah pendakian selesai dan memperbarui rating', async () => {
    const id = await pendakianSelesai();
    const res = await api()
      .post(`/api/guide-reviews/booking/${id}`)
      .set(bearer(f.visitor.token))
      .send({ guideId: f.guideId, rating: 4, comment: 'Sabar dan hafal jalur' });
    expect(res.status).toBe(201);

    // Rating pemandu adalah turunan ulasan, bukan angka yang diketik admin.
    expect((await prisma.guide.findUniqueOrThrow({ where: { id: f.guideId } })).rating).toBe(4);

    const publik = await api().get(`/api/guide-reviews/${f.guideId}`);
    expect(publik.body.data.count).toBe(1);
    expect(publik.body.data.rating).toBe(4);
  });

  it('menolak ulasan sebelum pendakian selesai', async () => {
    const created = await api()
      .post('/api/bookings')
      .set(bearer(f.visitor.token))
      .send({
        trailId: f.trailId,
        startDate: hariKe(3),
        endDate: hariKe(3),
        members: [{ name: 'Ketua Rombongan' }],
        tickets: [{ id: f.ticketId, qty: 1 }],
        guides: [{ id: f.guideId, qty: 1 }],
      });
    const res = await api()
      .post(`/api/guide-reviews/booking/${created.body.data.id}`)
      .set(bearer(f.visitor.token))
      .send({ guideId: f.guideId, rating: 5 });
    expect(res.status).toBe(400);
  });

  it('menolak ulasan untuk pemandu yang tidak dipakai', async () => {
    const id = await pendakianSelesai(false);
    const res = await api()
      .post(`/api/guide-reviews/booking/${id}`)
      .set(bearer(f.visitor.token))
      .send({ guideId: f.guideId, rating: 5 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/tidak ada pada booking/);
  });

  it('menolak ulasan atas booking orang lain', async () => {
    const id = await pendakianSelesai();
    const res = await api()
      .post(`/api/guide-reviews/booking/${id}`)
      .set(bearer(f.visitor2.token))
      .send({ guideId: f.guideId, rating: 1 });
    expect(res.status).toBe(403);
  });

  it('memperbarui ulasan lama alih-alih menggandakan', async () => {
    const id = await pendakianSelesai();
    await api()
      .post(`/api/guide-reviews/booking/${id}`)
      .set(bearer(f.visitor.token))
      .send({ guideId: f.guideId, rating: 2 });
    await api()
      .post(`/api/guide-reviews/booking/${id}`)
      .set(bearer(f.visitor.token))
      .send({ guideId: f.guideId, rating: 5, comment: 'Revisi penilaian' });

    expect(await prisma.guideReview.count()).toBe(1);
    expect((await prisma.guide.findUniqueOrThrow({ where: { id: f.guideId } })).rating).toBe(5);
  });
});
