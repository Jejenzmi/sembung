import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { api, bearer, prisma, resetDb, seedFixtures, tunggu, type Fixtures } from './helpers';

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
    .send({ lat: -6.545, lng: 107.375, type: 'LOST', message: 'Tersesat di kabut' });

describe('Kotak masuk pendaki', () => {
  it('kosong sebelum ada penanganan', async () => {
    await kirimSos();
    const res = await api().get('/api/notifications').set(bearer(f.visitor.token));
    expect(res.body.data).toHaveLength(0);
  });

  it('memberi tahu pendaki setiap kali status daruratnya berubah', async () => {
    const id = (await kirimSos()).body.data.id;

    await api().put(`/api/sos/${id}/status`).set(bearer(f.officer.token)).send({ status: 'ACKNOWLEDGED' });
    await tunggu(
      () => prisma.notification.count({ where: { userId: f.visitor.id, channel: 'INAPP' } }),
      (n) => n >= 1
    );

    await api()
      .put(`/api/sos/${id}/status`)
      .set(bearer(f.officer.token))
      .send({ status: 'RESOLVED', resolutionNote: 'Ditemukan di camping ground' });
    await tunggu(
      () => prisma.notification.count({ where: { userId: f.visitor.id, channel: 'INAPP' } }),
      (n) => n >= 2
    );

    const res = await api().get('/api/notifications').set(bearer(f.visitor.token));
    expect(res.body.data.length).toBe(2);
    expect(res.body.meta.unread).toBe(2);
    // Catatan petugas ikut sampai ke pendaki, bukan berhenti di dasbor.
    expect(res.body.data[0].body).toContain('Ditemukan di camping ground');
  });

  it('menandai satu pesan dan seluruh pesan sebagai dibaca', async () => {
    const id = (await kirimSos()).body.data.id;
    await api().put(`/api/sos/${id}/status`).set(bearer(f.officer.token)).send({ status: 'RESCUING' });
    await tunggu(
      () => prisma.notification.count({ where: { userId: f.visitor.id, channel: 'INAPP' } }),
      (n) => n >= 1
    );

    const inbox = await api().get('/api/notifications').set(bearer(f.visitor.token));
    await api().post(`/api/notifications/${inbox.body.data[0].id}/read`).set(bearer(f.visitor.token));
    const sesudah = await api().get('/api/notifications?unread=1').set(bearer(f.visitor.token));
    expect(sesudah.body.meta.unread).toBe(0);

    const semua = await api().post('/api/notifications/read-all').set(bearer(f.visitor.token));
    expect(semua.body.data.count).toBe(0);
  });

  it('tidak membocorkan kotak masuk pendaki lain', async () => {
    const id = (await kirimSos()).body.data.id;
    await api().put(`/api/sos/${id}/status`).set(bearer(f.officer.token)).send({ status: 'RESCUING' });
    await tunggu(
      () => prisma.notification.count({ where: { userId: f.visitor.id, channel: 'INAPP' } }),
      (n) => n >= 1
    );

    const lain = await api().get('/api/notifications').set(bearer(f.visitor2.token));
    expect(lain.body.data).toHaveLength(0);

    // Menandai pesan milik orang lain tidak boleh berpengaruh.
    const punyaSaya = await api().get('/api/notifications').set(bearer(f.visitor.token));
    await api().post(`/api/notifications/${punyaSaya.body.data[0].id}/read`).set(bearer(f.visitor2.token));
    const cek = await api().get('/api/notifications?unread=1').set(bearer(f.visitor.token));
    expect(cek.body.meta.unread).toBe(1);
  });

  it('memisahkan notifikasi staf dari kotak masuk pendaki', async () => {
    await kirimSos();
    // Kipas notifikasi staf berjalan setelah respons dikirim, jadi ditunggu
    // alih-alih diperiksa seketika.
    const jumlahWa = await tunggu(
      () => prisma.notification.count({ where: { channel: 'WHATSAPP' } }),
      (n) => n > 0
    );
    expect(jumlahWa).toBeGreaterThan(0);

    // Peringatan staf memakai kanal WhatsApp/webhook, bukan kotak masuk INAPP.
    const res = await api().get('/api/notifications').set(bearer(f.admin.token));
    expect(res.body.data).toHaveLength(0);
  });
});
