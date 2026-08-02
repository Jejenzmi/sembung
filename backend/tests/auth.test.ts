import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api, bearer, prisma, resetDb, seedFixtures, type Fixtures } from './helpers';

let f: Fixtures;
beforeAll(async () => {
  await resetDb();
  f = await seedFixtures();
});
afterAll(() => prisma.$disconnect());

describe('Autentikasi & peran', () => {
  it('menolak sandi salah', async () => {
    const res = await api().post('/api/auth/login').send({ identifier: 'admin', password: 'salah' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Kredensial tidak valid');
  });

  it('menolak akun nonaktif', async () => {
    await prisma.user.updateMany({ where: { email: 'dua@uji.id' }, data: { isActive: false } });
    const res = await api().post('/api/auth/login').send({ identifier: 'dua@uji.id', password: 'uji-pendaki' });
    expect(res.status).toBe(403);
    await prisma.user.updateMany({ where: { email: 'dua@uji.id' }, data: { isActive: true } });
  });

  it('menolak pendaftaran nomor ganda', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send({ name: 'Kembar', phone: '0810000010', password: 'rahasia123' });
    expect(res.status).toBe(409);
  });

  it('memvalidasi masukan dengan pesan per kolom', async () => {
    const res = await api().post('/api/auth/register').send({ name: 'X', phone: '1', password: '1' });
    expect(res.status).toBe(422);
    expect(res.body.errors.map((e: { path: string }) => e.path)).toEqual(
      expect.arrayContaining(['name', 'phone', 'password'])
    );
  });

  it('menolak token palsu dan permintaan tanpa token', async () => {
    expect((await api().get('/api/bookings/mine').set(bearer('ngawur'))).status).toBe(401);
    expect((await api().get('/api/bookings/mine')).status).toBe(401);
  });

  it('menutup endpoint petugas dari pendaki', async () => {
    const res = await api().get('/api/gate/on-mountain').set(bearer(f.visitor.token));
    expect(res.status).toBe(403);
  });

  it('menutup master data dari petugas', async () => {
    const res = await api()
      .post('/api/catalog/tickets')
      .set(bearer(f.officer.token))
      .send({ code: 'X', name: 'X', category: 'ENTRY', price: 1 });
    expect(res.status).toBe(403);
  });

  it('tidak menyimpan sandi ke audit log', async () => {
    await api().post('/api/auth/login').send({ identifier: 'admin', password: 'uji-admin' });
    const jejak = await prisma.auditLog.findMany({ where: { path: '/api/auth/login' } });
    expect(jejak.length).toBeGreaterThan(0);
    for (const baris of jejak) expect(baris.payload ?? '').not.toContain('uji-admin');
  });
});
