import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { api, bearer, bookingLunas, hariKe, prisma, resetDb, seedFixtures, type Fixtures } from './helpers';

let f: Fixtures;
beforeEach(async () => {
  await resetDb();
  f = await seedFixtures();
});
afterAll(() => prisma.$disconnect());

const rentang = () => `?from=${hariKe(-1)}&to=${hariKe(1)}`;

describe('Laporan & ekspor', () => {
  it('laporan harian cocok dengan ringkasan pada instans yang sama', async () => {
    // Regresi: query SQL mentah membandingkan kolom timestamp tanpa zona dengan
    // parameter bertimezone, sehingga laporan kosong padahal ringkasan berisi.
    await bookingLunas(f, { start: hariKe(0), persons: 2 });

    const harian = await api().get(`/api/reports/revenue-daily${rentang()}`).set(bearer(f.admin.token));
    const ringkas = await api().get(`/api/reports/summary${rentang()}`).set(bearer(f.admin.token));

    const totalHarian = harian.body.data.rows.reduce(
      (s: number, r: { nominal: number }) => s + r.nominal,
      0
    );
    expect(harian.body.data.rows.length).toBeGreaterThan(0);
    expect(totalHarian).toBe(ringkas.body.data.penerimaan);
  });

  it('merinci penerimaan per jenis', async () => {
    await bookingLunas(f, { start: hariKe(0), persons: 2 });
    const res = await api().get(`/api/reports/revenue-by-item${rentang()}`).set(bearer(f.admin.token));
    expect(res.body.data.rows.length).toBeGreaterThan(0);
    expect(res.body.data.rows[0]).toHaveProperty('nominal');
  });

  it('merekap sampah turun per petugas', async () => {
    const b = await bookingLunas(f, { start: hariKe(0) });
    await api().post('/api/gate/check-in').set(bearer(f.officer.token)).send({ token: b.qrToken, gateId: f.gateId });
    await api()
      .post('/api/gate/check-out')
      .set(bearer(f.officer.token))
      .send({ token: b.qrToken, gateId: f.gateId, wasteKg: 2.5 });

    const res = await api().get(`/api/reports/gate-recap${rentang()}`).set(bearer(f.admin.token));
    expect(res.body.data.rows[0].sampahKg).toBe(2.5);
    expect(res.body.data.totalSampahKg).toBe(2.5);
  });

  it('mengekspor CSV yang siap dibuka Excel Indonesia', async () => {
    await bookingLunas(f, { start: hariKe(0) });
    const res = await api()
      .get(`/api/reports/revenue-daily${rentang()}&format=csv`)
      .set(bearer(f.admin.token));

    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/attachment; filename=/);
    expect(res.text.startsWith('﻿')).toBe(true); // BOM
    expect(res.text.split('\r\n')[0]).toContain(';');
  });

  it('menyertakan refund pada penerimaan bersih', async () => {
    const b = await bookingLunas(f, { start: hariKe(0), persons: 2 });
    await api()
      .post(`/api/refunds/booking/${b.code}`)
      .set(bearer(f.admin.token))
      .send({ amount: 5000, reason: 'Uji potongan' });

    const res = await api().get(`/api/reports/summary${rentang()}`).set(bearer(f.admin.token));
    expect(res.body.data.refund).toBe(0); // masih REQUESTED, belum disetujui
    const refund = await prisma.refund.findFirstOrThrow();
    await api().put(`/api/refunds/${refund.id}/status`).set(bearer(f.admin.token)).send({ status: 'APPROVED' });

    const sesudah = await api().get(`/api/reports/summary${rentang()}`).set(bearer(f.admin.token));
    expect(sesudah.body.data.refund).toBe(5000);
    expect(sesudah.body.data.penerimaanBersih).toBe(sesudah.body.data.penerimaan - 5000);
  });

  it('menutup laporan dari pendaki, membuka untuk petugas', async () => {
    expect((await api().get('/api/reports/revenue-daily').set(bearer(f.visitor.token))).status).toBe(403);
    expect((await api().get('/api/reports/visitors-by-trail').set(bearer(f.officer.token))).status).toBe(200);
  });
});
