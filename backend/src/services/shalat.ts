import { getSetting } from './settings';

/**
 * Jadwal salat resmi Kemenag melalui api.myquran.com (v2), dengan Aladhan
 * metode 20 (juga parameter Kemenag) sebagai cadangan bila layanan utama padam.
 *
 * Diambil per bulan, bukan per hari, supaya aplikasi pendaki bisa menyimpannya
 * dan tetap punya jadwal lengkap saat berada di jalur tanpa sinyal.
 */
const TTL_MS = 12 * 60 * 60_000;

export interface JadwalHarian {
  tanggal: string; // YYYY-MM-DD
  imsak: string;
  subuh: string;
  terbit: string;
  dhuha: string;
  zuhur: string;
  asar: string;
  magrib: string;
  isya: string;
}

export interface JadwalBulanan {
  lokasi: string;
  daerah: string;
  tahun: number;
  bulan: number;
  sumber: string;
  jadwal: JadwalHarian[];
}

const cache = new Map<string, { data: JadwalBulanan; sampai: number }>();

const dua = (n: number) => String(n).padStart(2, '0');

async function dariMyQuran(kotaId: string, tahun: number, bulan: number): Promise<JadwalBulanan> {
  const res = await fetch(
    `https://api.myquran.com/v2/sholat/jadwal/${kotaId}/${tahun}/${dua(bulan)}`,
    { signal: AbortSignal.timeout(12_000) }
  );
  if (!res.ok) throw new Error(`myQuran HTTP ${res.status}`);

  const json = (await res.json()) as {
    status?: boolean;
    data?: { lokasi?: string; daerah?: string; jadwal?: Record<string, string>[] };
  };
  if (json.status !== true || !json.data?.jadwal?.length)
    throw new Error('myQuran tidak mengembalikan jadwal');

  return {
    lokasi: json.data.lokasi ?? '-',
    daerah: json.data.daerah ?? '-',
    tahun,
    bulan,
    sumber: 'Kemenag RI · api.myquran.com',
    jadwal: json.data.jadwal.map((h) => ({
      tanggal: h.date,
      imsak: h.imsak,
      subuh: h.subuh,
      terbit: h.terbit,
      dhuha: h.dhuha,
      zuhur: h.dzuhur,
      asar: h.ashar,
      magrib: h.maghrib,
      isya: h.isya,
    })),
  };
}

/** Cadangan: Aladhan metode 20 memakai parameter Kemenag yang sama. */
async function dariAladhan(
  lat: number,
  lon: number,
  tahun: number,
  bulan: number
): Promise<JadwalBulanan> {
  const res = await fetch(
    `https://api.aladhan.com/v1/calendar/${tahun}/${bulan}?latitude=${lat}&longitude=${lon}&method=20`,
    { signal: AbortSignal.timeout(12_000) }
  );
  if (!res.ok) throw new Error(`Aladhan HTTP ${res.status}`);

  const json = (await res.json()) as {
    data?: { timings: Record<string, string>; date: { gregorian: { date: string } } }[];
  };
  if (!json.data?.length) throw new Error('Aladhan tidak mengembalikan jadwal');

  // Aladhan menambahkan zona waktu di belakang jam, mis. "04:41 (WIB)".
  const jam = (v: string) => v.split(' ')[0];

  return {
    lokasi: 'Sekitar Gunung Sembung',
    daerah: 'JAWA BARAT',
    tahun,
    bulan,
    sumber: 'Aladhan · metode 20 (Kemenag)',
    jadwal: json.data.map((h) => {
      const [d, m, y] = h.date.gregorian.date.split('-');
      return {
        tanggal: `${y}-${m}-${d}`,
        imsak: jam(h.timings.Imsak),
        subuh: jam(h.timings.Fajr),
        terbit: jam(h.timings.Sunrise),
        dhuha: jam(h.timings.Sunrise),
        zuhur: jam(h.timings.Dhuhr),
        asar: jam(h.timings.Asr),
        magrib: jam(h.timings.Maghrib),
        isya: jam(h.timings.Isha),
      };
    }),
  };
}

export async function jadwalBulanan(tahun: number, bulan: number): Promise<JadwalBulanan> {
  const kunci = `${tahun}-${dua(bulan)}`;
  const tersimpan = cache.get(kunci);
  if (tersimpan && Date.now() < tersimpan.sampai) return tersimpan.data;

  const kotaId = await getSetting('KEMENAG_KOTA_ID');
  const lat = Number(await getSetting('PARK_LAT'));
  const lon = Number(await getSetting('PARK_LON'));

  let data: JadwalBulanan;
  try {
    data = await dariMyQuran(kotaId, tahun, bulan);
  } catch (utama) {
    try {
      data = await dariAladhan(lat, lon, tahun, bulan);
    } catch (cadangan) {
      // Sajikan cache lama bila ada — lebih berguna daripada tidak sama sekali,
      // dan penandanya tetap jujur lewat properti sumber.
      if (tersimpan) return { ...tersimpan.data, sumber: `${tersimpan.data.sumber} (tersimpan)` };
      throw new Error(
        `Gagal mengambil jadwal salat. Utama: ${(utama as Error).message}; ` +
          `cadangan: ${(cadangan as Error).message}`
      );
    }
  }

  cache.set(kunci, { data, sampai: Date.now() + TTL_MS });
  return data;
}

export async function jadwalHarian(tanggal: string): Promise<{ hari: JadwalHarian; bulanan: JadwalBulanan }> {
  const [y, m] = tanggal.split('-').map(Number);
  const bulanan = await jadwalBulanan(y, m);
  const hari = bulanan.jadwal.find((j) => j.tanggal === tanggal);
  if (!hari) throw new Error(`Jadwal ${tanggal} tidak tersedia`);
  return { hari, bulanan };
}

export const kosongkanCacheShalat = () => cache.clear();
