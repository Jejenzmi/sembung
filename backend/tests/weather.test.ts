import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, prisma, resetDb, seedFixtures } from './helpers';
import { kosongkanCacheCuaca } from '../src/services/weather';

/** Cuplikan struktur asli BMKG untuk Desa Sukajaya, dipangkas seperlunya. */
const jamKe = (offsetJam: number) => {
  const d = new Date(Date.now() + offsetJam * 3600_000);
  return {
    utc: d.toISOString().slice(0, 19).replace('T', ' '),
    lokal: new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 19).replace('T', ' '),
  };
};

const entri = (over: Record<string, unknown> = {}, offsetJam = 0) => {
  const w = jamKe(offsetJam);
  return {
    datetime: w.utc, utc_datetime: w.utc, local_datetime: w.lokal,
    t: 24, hu: 80, weather_desc: 'Cerah Berawan', ws: 8, wd: 'NE',
    vs: 9993, tcc: 40, tp: 0,
    image: 'https://api-apps.bmkg.go.id/storage/icon/cuaca/cerah-berawan-am.svg',
    ...over,
  };
};

const balasan = (cuaca: Record<string, unknown>[][]) => ({
  ok: true,
  status: 200,
  json: async () => ({
    lokasi: {
      desa: 'Sukajaya', kecamatan: 'Sukatani', kotkab: 'Purwakarta',
      provinsi: 'Jawa Barat', lat: -6.5998, lon: 107.4253,
    },
    data: [{ cuaca }],
  }),
});

beforeEach(async () => {
  await resetDb();
  await seedFixtures();
  kosongkanCacheCuaca();
});
afterEach(() => vi.unstubAllGlobals());
afterAll(() => prisma.$disconnect());

describe('Prakiraan cuaca BMKG', () => {
  it('memetakan lokasi dan prakiraan dari balasan BMKG', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => balasan([[entri(), entri({}, 3)]])));
    const res = await api().get('/api/weather');

    expect(res.status).toBe(200);
    expect(res.body.data.lokasi.desa).toBe('Sukajaya');
    expect(res.body.data.lokasi.kabupaten).toBe('Purwakarta');
    expect(res.body.data.prakiraan.length).toBe(2);
    expect(res.body.data.sekarang.suhu).toBe(24);
  });

  it('memakai kode wilayah dari pengaturan', async () => {
    const palsu = vi.fn(async () => balasan([[entri()]]));
    vi.stubGlobal('fetch', palsu);
    await api().get('/api/weather');
    expect(String(palsu.mock.calls[0][0])).toContain('adm4=32.14.05.2012');
  });

  it('memperingatkan hujan beserta jamnya', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => balasan([[entri(), entri({ weather_desc: 'Hujan Petir' }, 4)]]))
    );
    const res = await api().get('/api/weather');
    const gabung = res.body.data.peringatan.join(' ');
    expect(gabung).toMatch(/Hujan Petir/);
    expect(gabung).toMatch(/petir/i);
  });

  it('memperingatkan kabut tebal dan angin kencang', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => balasan([[entri({ vs: 800, ws: 31 })]]))
    );
    const res = await api().get('/api/weather');
    const gabung = res.body.data.peringatan.join(' ');
    expect(gabung).toMatch(/Jarak pandang/);
    expect(gabung).toMatch(/31 km\/jam/);
  });

  it('menyatakan aman bila tidak ada ancaman', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => balasan([[entri({ t: 28, vs: 9993, ws: 5 })]])));
    const res = await api().get('/api/weather');
    expect(res.body.data.peringatan).toEqual([
      'Tidak ada peringatan cuaca khusus untuk 24 jam ke depan.',
    ]);
  });

  it('menyatakan kegagalan terus terang, bukan menyajikan data basi', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })));
    const res = await api().get('/api/weather');
    expect(res.status).toBe(503);
    expect(res.body.message).toMatch(/tidak dapat diambil/);
  });

  it('menyimpan hasil di cache agar BMKG tidak dibanjiri permintaan', async () => {
    const palsu = vi.fn(async () => balasan([[entri()]]));
    vi.stubGlobal('fetch', palsu);
    await api().get('/api/weather');
    await api().get('/api/weather');
    await api().get('/api/weather');
    expect(palsu).toHaveBeenCalledTimes(1);
  });
});
