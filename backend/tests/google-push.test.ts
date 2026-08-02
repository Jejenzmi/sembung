import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, bearer, prisma, resetDb, seedFixtures, type Fixtures } from './helpers';

let f: Fixtures;
beforeEach(async () => {
  await resetDb();
  f = await seedFixtures();
});
afterEach(() => {
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.FIREBASE_SERVICE_ACCOUNT;
  vi.unstubAllGlobals();
});
afterAll(() => prisma.$disconnect());

describe('Masuk dengan Google', () => {
  it('menolak bila server belum dikonfigurasi', async () => {
    const res = await api().post('/api/auth/google').send({ idToken: 'x'.repeat(30) });
    expect(res.status).toBe(503);
    expect(res.body.message).toMatch(/belum dikonfigurasi/);
  });

  it('menolak token yang tidak sah', async () => {
    process.env.GOOGLE_CLIENT_ID = 'uji.apps.googleusercontent.com';
    const res = await api().post('/api/auth/google').send({ idToken: 'palsu'.repeat(10) });
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/tidak sah/);
  });

  it('memvalidasi bentuk permintaan', async () => {
    const res = await api().post('/api/auth/google').send({ idToken: 'pendek' });
    expect(res.status).toBe(422);
  });
});

describe('Perangkat untuk push', () => {
  it('melaporkan push belum siap tanpa kredensial', async () => {
    const res = await api().get('/api/notifications/push/status').set(bearer(f.visitor.token));
    expect(res.body.data.siap).toBe(false);
  });

  it('mendaftarkan token perangkat', async () => {
    const token = 'fcm-token-' + 'a'.repeat(30);
    const res = await api()
      .post('/api/notifications/device')
      .set(bearer(f.visitor.token))
      .send({ token, platform: 'android' });
    expect(res.status).toBe(200);
    expect(await prisma.deviceToken.count({ where: { userId: f.visitor.id } })).toBe(1);
  });

  it('memindahkan kepemilikan saat perangkat dipakai akun lain', async () => {
    const token = 'fcm-token-' + 'b'.repeat(30);
    await api().post('/api/notifications/device').set(bearer(f.visitor.token)).send({ token });
    await api().post('/api/notifications/device').set(bearer(f.visitor2.token)).send({ token });

    const rows = await prisma.deviceToken.findMany({ where: { token } });
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe(f.visitor2.id);
  });

  it('melepas perangkat milik sendiri saja', async () => {
    const token = 'fcm-token-' + 'c'.repeat(30);
    await api().post('/api/notifications/device').set(bearer(f.visitor.token)).send({ token });

    await api().delete(`/api/notifications/device/${token}`).set(bearer(f.visitor2.token));
    expect(await prisma.deviceToken.count({ where: { token } })).toBe(1);

    await api().delete(`/api/notifications/device/${token}`).set(bearer(f.visitor.token));
    expect(await prisma.deviceToken.count({ where: { token } })).toBe(0);
  });

  it('menolak token tanpa autentikasi', async () => {
    const res = await api().post('/api/notifications/device').send({ token: 'x'.repeat(30) });
    expect(res.status).toBe(401);
  });

  it('mencatat alasan bila push dilewati, tanpa mengorbankan kotak masuk', async () => {
    // Tanpa kredensial Firebase, pesan tetap harus sampai ke kotak masuk.
    const sos = await api()
      .post('/api/sos')
      .set(bearer(f.visitor.token))
      .send({ lat: -6.54, lng: 107.37, type: 'LOST' });
    await api()
      .put(`/api/sos/${sos.body.data.id}/status`)
      .set(bearer(f.officer.token))
      .send({ status: 'RESCUING' });

    await new Promise((r) => setTimeout(r, 400));
    const inbox = await api().get('/api/notifications').set(bearer(f.visitor.token));
    expect(inbox.body.data.length).toBeGreaterThan(0);
    expect(inbox.body.data[0].error ?? '').toMatch(/Push dilewati|FIREBASE/i);
  });
});
