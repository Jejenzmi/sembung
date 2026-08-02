import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { api, bearer, bookingLunas, prisma, resetDb, seedFixtures, tunggu, type Fixtures } from './helpers';

let f: Fixtures;
beforeEach(async () => {
  await resetDb();
  f = await seedFixtures();
});
afterAll(() => prisma.$disconnect());

const kirimSos = () =>
  api()
    .post('/api/sos')
    .set(bearer(f.visitor.token))
    .send({ lat: -6.545, lng: 107.375, elevationM: 900, type: 'INJURY', message: 'Kaki terkilir' });

describe('Sinyal darurat', () => {
  it('menyebarkan peringatan ke seluruh staf dan kontak darurat', async () => {
    const res = await kirimSos();
    expect(res.status).toBe(201);

    const notif = await tunggu(
      () => prisma.notification.findMany({ where: { refType: 'SOS' } }),
      (rows) => rows.length >= 4
    );
    // 3 staf + 1 kontak darurat pendaki.
    expect(notif.length).toBe(4);
    expect(notif.map((n) => n.target)).toContain('0810000099');
    // Tanpa token WhatsApp, kegagalan harus tercatat jelas, bukan hilang diam-diam.
    for (const n of notif) {
      expect(n.status).toBe('SKIPPED');
      expect(n.error).toMatch(/FONNTE_TOKEN/);
    }
  });

  it('menautkan SOS ke rombongan yang sedang mendaki', async () => {
    const b = await bookingLunas(f);
    await api().post('/api/gate/check-in').set(bearer(f.officer.token)).send({ token: b.qrToken, gateId: f.gateId });
    const res = await kirimSos();
    expect(res.body.data.booking.code).toBe(b.code);
  });

  it('menampilkan jejak notifikasi ke staf saja', async () => {
    const res = await kirimSos();
    const id = res.body.data.id;
    await tunggu(
      () => prisma.notification.count({ where: { refType: 'SOS' } }),
      (n) => n >= 4
    );
    const staf = await api().get(`/api/sos/${id}`).set(bearer(f.admin.token));
    const pendaki = await api().get(`/api/sos/${id}`).set(bearer(f.visitor.token));
    expect(staf.body.data.notifications.length).toBe(4);
    expect(pendaki.body.data.notifications.length).toBe(0);
  });

  it('menyembunyikan SOS pendaki lain', async () => {
    const res = await kirimSos();
    const curi = await api().get(`/api/sos/${res.body.data.id}`).set(bearer(f.visitor2.token));
    expect(curi.status).toBe(403);
  });

  it('mengikuti alur penanganan sampai selesai', async () => {
    const id = (await kirimSos()).body.data.id;
    for (const status of ['ACKNOWLEDGED', 'RESCUING', 'RESOLVED']) {
      const res = await api().put(`/api/sos/${id}/status`).set(bearer(f.officer.token)).send({ status });
      expect(res.body.data.status).toBe(status);
    }
    expect((await prisma.sosAlert.findUniqueOrThrow({ where: { id } })).resolvedAt).not.toBeNull();
  });

  it('menyimpan ping lokasi untuk tim pencari', async () => {
    await api().post('/api/sos/track').set(bearer(f.visitor.token)).send({ lat: -6.54, lng: 107.36, battery: 80 });
    const id = (await kirimSos()).body.data.id;
    const detail = await api().get(`/api/sos/${id}`).set(bearer(f.admin.token));
    expect(detail.body.data.track.length).toBe(1);
  });
});
