import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { api, bearer, hariKe, prisma, resetDb, seedFixtures, type Fixtures } from './helpers';

let f: Fixtures;
beforeEach(async () => {
  await resetDb();
  f = await seedFixtures();
});
afterAll(() => prisma.$disconnect());

const buatVoucher = (over: Record<string, unknown> = {}) =>
  api()
    .post('/api/vouchers')
    .set(bearer(f.admin.token))
    .send({
      code: 'HEMAT20',
      name: 'Potongan Festival',
      type: 'PERCENT',
      value: 20,
      minSpend: 10_000,
      quota: 2,
      validFrom: hariKe(-1),
      validUntil: hariKe(30),
      ...over,
    });

const draft = (voucherCode?: string) => ({
  trailId: f.trailId,
  startDate: hariKe(3),
  endDate: hariKe(3),
  members: [{ name: 'Ani' }, { name: 'Budi' }],
  tickets: [{ id: f.ticketId, qty: 2 }], // subtotal 20.000
  ...(voucherCode ? { voucherCode } : {}),
});

describe('Voucher & potongan', () => {
  it('menerapkan potongan persentase pada subtotal', async () => {
    await buatVoucher();
    const res = await api().post('/api/bookings/quote').set(bearer(f.visitor.token)).send(draft('HEMAT20'));
    expect(res.body.data.subtotal).toBe(20_000);
    expect(res.body.data.discount).toBe(4_000);
    // Biaya layanan tetap ditagih penuh di atas subtotal yang sudah dipotong.
    expect(res.body.data.total).toBe(20_000 - 4_000 + 5_000);
  });

  it('menghormati batas potongan maksimum', async () => {
    await buatVoucher({ value: 90, maxDiscount: 5_000 });
    const res = await api().post('/api/bookings/quote').set(bearer(f.visitor.token)).send(draft('HEMAT20'));
    expect(res.body.data.discount).toBe(5_000);
  });

  it('menolak bila belanja belum mencapai minimum', async () => {
    await buatVoucher({ minSpend: 999_999 });
    const res = await api().post('/api/bookings/quote').set(bearer(f.visitor.token)).send(draft('HEMAT20'));
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/[Mm]inimal transaksi/);
  });

  it('menolak voucher kedaluwarsa dan yang belum berlaku', async () => {
    await buatVoucher({ code: 'LAMA', validFrom: hariKe(-30), validUntil: hariKe(-1) });
    await buatVoucher({ code: 'NANTI', validFrom: hariKe(10), validUntil: hariKe(30) });
    expect(
      (await api().post('/api/bookings/quote').set(bearer(f.visitor.token)).send(draft('LAMA'))).body.message
    ).toMatch(/berakhir/);
    expect(
      (await api().post('/api/bookings/quote').set(bearer(f.visitor.token)).send(draft('NANTI'))).body.message
    ).toMatch(/berlaku mulai/);
  });

  it('menolak voucher jalur lain', async () => {
    const lain = await prisma.trail.create({
      data: {
        code: 'TRL-B', name: 'Jalur B', slug: 'jalur-b', distanceKm: 3,
        elevationGainM: 200, summitElevM: 700, estimatedHours: 2, dailyQuota: 5,
      },
    });
    await buatVoucher({ trailId: lain.id });
    const res = await api().post('/api/bookings/quote').set(bearer(f.visitor.token)).send(draft('HEMAT20'));
    expect(res.body.message).toMatch(/jalur tertentu/);
  });

  it('memakai kuota saat dipesan dan mengembalikannya saat batal', async () => {
    await buatVoucher();
    const b = await api().post('/api/bookings').set(bearer(f.visitor.token)).send(draft('HEMAT20'));
    expect(b.body.data.discount).toBe(4_000);
    expect((await prisma.voucher.findUniqueOrThrow({ where: { code: 'HEMAT20' } })).used).toBe(1);

    await api().post(`/api/bookings/${b.body.data.id}/cancel`).set(bearer(f.visitor.token));
    expect((await prisma.voucher.findUniqueOrThrow({ where: { code: 'HEMAT20' } })).used).toBe(0);
    expect(await prisma.voucherUsage.count()).toBe(0);
  });

  it('menolak setelah kuota habis', async () => {
    await buatVoucher({ quota: 1 });
    await api().post('/api/bookings').set(bearer(f.visitor.token)).send(draft('HEMAT20'));
    const kedua = await api().post('/api/bookings').set(bearer(f.visitor2.token)).send(draft('HEMAT20'));
    expect(kedua.status).toBe(400);
    expect(kedua.body.message).toMatch(/[Kk]uota voucher/);
  });

  it('menyembunyikan voucher yang kuotanya habis dari daftar publik', async () => {
    await buatVoucher({ quota: 1 });
    await api().post('/api/bookings').set(bearer(f.visitor.token)).send(draft('HEMAT20'));
    const res = await api().get('/api/vouchers/active');
    expect(res.body.data).toHaveLength(0);
  });

  it('menonaktifkan alih-alih menghapus voucher yang pernah dipakai', async () => {
    await buatVoucher();
    await api().post('/api/bookings').set(bearer(f.visitor.token)).send(draft('HEMAT20'));
    const res = await api().delete('/api/vouchers/HEMAT20').set(bearer(f.admin.token));
    expect(res.body.message).toMatch(/dinonaktifkan/);
    expect((await prisma.voucher.findUniqueOrThrow({ where: { code: 'HEMAT20' } })).isActive).toBe(false);
  });

  it('hanya administrator yang boleh mengelola voucher', async () => {
    expect((await buatVoucher()).status).toBe(201);
    const olehPetugas = await api()
      .post('/api/vouchers')
      .set(bearer(f.officer.token))
      .send({ code: 'X1', name: 'Uji', value: 5, validFrom: hariKe(0), validUntil: hariKe(1) });
    expect(olehPetugas.status).toBe(403);
  });
});
