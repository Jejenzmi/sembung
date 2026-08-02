import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, prisma, resetDb, seedFixtures } from './helpers';
import { kosongkanCacheShalat } from '../src/services/shalat';

const hariMyQuran = (tanggal: string) => ({
  tanggal: 'Minggu, ' + tanggal,
  imsak: '04:33', subuh: '04:43', terbit: '05:58', dhuha: '06:27',
  dzuhur: '12:00', ashar: '15:21', maghrib: '17:55', isya: '19:06',
  date: tanggal,
});

const balasanMyQuran = (tanggalList: string[]) => ({
  ok: true,
  status: 200,
  json: async () => ({
    status: true,
    data: {
      id: 1214, lokasi: 'KAB. PURWAKARTA', daerah: 'JAWA BARAT',
      jadwal: tanggalList.map(hariMyQuran),
    },
  }),
});

const balasanAladhan = (tanggalList: string[]) => ({
  ok: true,
  status: 200,
  json: async () => ({
    data: tanggalList.map((t) => {
      const [y, m, d] = t.split('-');
      return {
        timings: {
          Imsak: '04:31 (WIB)', Fajr: '04:41 (WIB)', Sunrise: '06:02 (WIB)',
          Dhuhr: '11:57 (WIB)', Asr: '15:18 (WIB)', Maghrib: '17:52 (WIB)',
          Isha: '19:04 (WIB)',
        },
        date: { gregorian: { date: `${d}-${m}-${y}` } },
      };
    }),
  }),
});

const bulanIni = () => {
  const n = new Date();
  return { tahun: n.getFullYear(), bulan: n.getMonth() + 1, hariIni: n.toISOString().slice(0, 10) };
};

beforeEach(async () => {
  await resetDb();
  await seedFixtures();
  kosongkanCacheShalat();
});
afterEach(() => vi.unstubAllGlobals());
afterAll(() => prisma.$disconnect());

describe('Jadwal salat dari sumber resmi', () => {
  it('mengambil sebulan penuh dari Kemenag untuk bekal offline', async () => {
    const { tahun, bulan, hariIni } = bulanIni();
    vi.stubGlobal('fetch', vi.fn(async () => balasanMyQuran([hariIni])));

    const res = await api().get(`/api/shalat?tahun=${tahun}&bulan=${bulan}`);
    expect(res.status).toBe(200);
    expect(res.body.data.lokasi).toBe('KAB. PURWAKARTA');
    expect(res.body.data.sumber).toMatch(/Kemenag/);
    expect(res.body.data.jadwal[0]).toMatchObject({
      subuh: '04:43', zuhur: '12:00', magrib: '17:55', isya: '19:06',
    });
  });

  it('memakai kode kota Purwakarta dari pengaturan', async () => {
    const palsu = vi.fn(async () => balasanMyQuran([bulanIni().hariIni]));
    vi.stubGlobal('fetch', palsu);
    await api().get('/api/shalat');
    expect(String(palsu.mock.calls[0][0])).toContain('/jadwal/1214/');
  });

  it('beralih ke Aladhan metode 20 ketika sumber utama padam', async () => {
    const { hariIni } = bulanIni();
    let panggilan = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        panggilan++;
        if (panggilan === 1) return { ok: false, status: 500, json: async () => ({}) };
        return balasanAladhan([hariIni]);
      })
    );

    const res = await api().get('/api/shalat');
    expect(res.status).toBe(200);
    expect(res.body.data.sumber).toMatch(/Aladhan/);
    // Zona waktu di belakang jam harus dibuang, bukan ikut tersimpan.
    expect(res.body.data.jadwal[0].subuh).toBe('04:41');
  });

  it('menyajikan jadwal satu hari beserta sumbernya', async () => {
    const { hariIni } = bulanIni();
    vi.stubGlobal('fetch', vi.fn(async () => balasanMyQuran([hariIni])));
    const res = await api().get(`/api/shalat/hari-ini?tanggal=${hariIni}`);
    expect(res.body.data.subuh).toBe('04:43');
    expect(res.body.data.lokasi).toBe('KAB. PURWAKARTA');
    expect(res.body.data.sumber).toMatch(/Kemenag/);
  });

  it('menyimpan hasil agar layanan Kemenag tidak dibanjiri', async () => {
    const palsu = vi.fn(async () => balasanMyQuran([bulanIni().hariIni]));
    vi.stubGlobal('fetch', palsu);
    await api().get('/api/shalat');
    await api().get('/api/shalat');
    await api().get('/api/shalat');
    expect(palsu).toHaveBeenCalledTimes(1);
  });

  it('menyatakan kegagalan terus terang bila kedua sumber padam', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })));
    const res = await api().get('/api/shalat');
    expect(res.status).toBe(503);
    expect(res.body.message).toMatch(/tidak dapat diambil/);
  });

  it('menolak bulan yang tidak masuk akal', async () => {
    const res = await api().get('/api/shalat?bulan=13');
    expect(res.status).toBe(422);
  });
});
