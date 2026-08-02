import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { api, bearer, hariKe, prisma, resetDb, seedFixtures, type Fixtures } from './helpers';

let f: Fixtures;
beforeEach(async () => {
  await resetDb();
  f = await seedFixtures();
});
afterAll(() => prisma.$disconnect());

const buat = (over: Record<string, unknown> = {}, token?: string) =>
  api()
    .post('/api/bookings')
    .set(bearer(token ?? f.visitor.token))
    .send({
      trailId: f.trailId,
      startDate: hariKe(3),
      endDate: hariKe(3),
      members: [{ name: 'Ketua' }, { name: 'Anggota' }],
      tickets: [{ id: f.ticketId, qty: 2 }],
      ...over,
    });

describe('Pemesanan & kuota', () => {
  it('menghitung harga sebelum pesanan dibuat', async () => {
    const res = await api()
      .post('/api/bookings/quote')
      .set(bearer(f.visitor.token))
      .send({
        trailId: f.trailId,
        startDate: hariKe(3),
        endDate: hariKe(4),
        members: [{ name: 'Ani' }, { name: 'Budi' }],
        tickets: [{ id: f.ticketId, qty: 2 }, { id: f.campId, qty: 2 }],
      });
    expect(res.status).toBe(200);
    // Tiket masuk sekali bayar; berkemah per orang per malam (2 hari).
    expect(res.body.data.subtotal).toBe(2 * 10_000 + 2 * 2 * 20_000);
    expect(res.body.data.total).toBe(res.body.data.subtotal + 5_000);
  });

  it('memakai biaya layanan dari pengaturan, bukan nilai tetap', async () => {
    await api().put('/api/settings').set(bearer(f.admin.token)).send({ SERVICE_FEE: '9000' });
    const res = await api()
      .post('/api/bookings/quote')
      .set(bearer(f.visitor.token))
      .send({
        trailId: f.trailId,
        startDate: hariKe(3),
        endDate: hariKe(3),
        members: [{ name: 'Ani' }],
        tickets: [{ id: f.ticketId, qty: 1 }],
      });
    expect(res.body.data.serviceFee).toBe(9000);
  });

  it('menolak bila kuota harian tidak cukup', async () => {
    const res = await buat({
      members: Array.from({ length: 25 }, (_, i) => ({ name: `Orang ${i}` })),
      tickets: [{ id: f.ticketId, qty: 25 }],
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Kuota/);
  });

  it('memakai slot pada SETIAP hari menginap, bukan hanya tanggal berangkat', async () => {
    await buat({ startDate: hariKe(3), endDate: hariKe(5) });
    const akhir = await api().get(`/api/trails/${f.trailId}/quota?date=${hariKe(5)}`);
    expect(akhir.body.data.booked).toBe(2);

    const kalender = await api().get(`/api/trails/${f.trailId}/quota-calendar?days=10`);
    const terpakai = kalender.body.data.filter((d: { booked: number }) => d.booked > 0);
    expect(terpakai).toHaveLength(3);
  });

  it('mengurangi stok saat pesan dan mengembalikannya saat batal', async () => {
    const awal = (await prisma.rentalItem.findUniqueOrThrow({ where: { id: f.rentalId } })).stock;
    const res = await buat({ rentals: [{ id: f.rentalId, qty: 2 }] });
    expect((await prisma.rentalItem.findUniqueOrThrow({ where: { id: f.rentalId } })).stock).toBe(awal - 2);

    await api().post(`/api/bookings/${res.body.data.id}/cancel`).set(bearer(f.visitor.token));
    expect((await prisma.rentalItem.findUniqueOrThrow({ where: { id: f.rentalId } })).stock).toBe(awal);
  });

  it('menolak sewa melebihi stok', async () => {
    const res = await buat({ rentals: [{ id: f.rentalId, qty: 99 }] });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/[Ss]tok/);
  });

  it('menahan E-Pass sampai lunas', async () => {
    const res = await buat();
    const epass = await api().get(`/api/bookings/${res.body.data.id}/epass`).set(bearer(f.visitor.token));
    expect(epass.status).toBe(400);
    expect(epass.body.message).toMatch(/lunas/);
  });

  it('menyembunyikan booking milik pendaki lain', async () => {
    const res = await buat();
    const curi = await api().get(`/api/bookings/${res.body.data.id}`).set(bearer(f.visitor2.token));
    expect(curi.status).toBe(403);
  });

  it('menetapkan batas waktu pembayaran', async () => {
    const res = await buat();
    expect(res.body.data.expiresAt).toBeTruthy();
  });
});
