import { getSetting } from './settings';

/**
 * Prakiraan cuaca resmi BMKG untuk desa terdekat kawasan Gunung Sembung.
 * Data BMKG diperbarui beberapa kali sehari, jadi hasilnya di-cache agar
 * pendaki yang membuka aplikasi bersamaan tidak membanjiri layanan publik.
 */
const TTL_MS = 30 * 60_000;

export interface Prakiraan {
  waktu: string;
  waktuLokal: string;
  suhu: number;
  kelembapan: number;
  cuaca: string;
  ikon: string | null;
  anginKmJam: number;
  arahAngin: string;
  jarakPandangM: number;
  tutupanAwan: number;
  curahHujan: number;
}

export interface CuacaKawasan {
  lokasi: { desa: string; kecamatan: string; kabupaten: string; provinsi: string; lat: number; lon: number };
  diperbaruiPada: string;
  sekarang: Prakiraan | null;
  prakiraan: Prakiraan[];
  peringatan: string[];
  sumber: string;
}

let cache: { data: CuacaKawasan; sampai: number } | null = null;

const bersih = (v: unknown, fallback = 0) => (typeof v === 'number' ? v : fallback);

function petakan(e: Record<string, unknown>): Prakiraan {
  return {
    waktu: String(e.utc_datetime ?? e.datetime ?? ''),
    waktuLokal: String(e.local_datetime ?? ''),
    suhu: bersih(e.t),
    kelembapan: bersih(e.hu),
    cuaca: String(e.weather_desc ?? '-'),
    ikon: (e.image as string) ?? null,
    anginKmJam: bersih(e.ws),
    arahAngin: String(e.wd ?? '-'),
    jarakPandangM: bersih(e.vs),
    tutupanAwan: bersih(e.tcc),
    curahHujan: bersih(e.tp),
  };
}

/**
 * Peringatan yang benar-benar relevan bagi pendaki, bukan sekadar menyalin
 * deskripsi cuaca: hujan, kabut tebal, angin kencang, dan potensi hipotermia.
 */
function susunPeringatan(list: Prakiraan[]): string[] {
  const pesan: string[] = [];
  const dalam24Jam = list.slice(0, 8);

  const hujan = dalam24Jam.filter((p) => /hujan|badai|petir/i.test(p.cuaca));
  if (hujan.length) {
    const jam = hujan[0].waktuLokal.slice(11, 16);
    pesan.push(
      `${hujan[0].cuaca} diperkirakan mulai pukul ${jam} WIB — pastikan flysheet dan jas hujan siap.`
    );
  }
  if (dalam24Jam.some((p) => /petir|badai/i.test(p.cuaca)))
    pesan.push('Potensi petir: hindari punggungan terbuka dan puncak saat cuaca memburuk.');

  const kabut = dalam24Jam.filter((p) => p.jarakPandangM > 0 && p.jarakPandangM < 2000);
  if (kabut.length)
    pesan.push(
      `Jarak pandang turun sampai ${Math.min(...kabut.map((p) => p.jarakPandangM))} m — ` +
        'jalur Tebing Sanggabuana berbahaya saat berkabut.'
    );

  const angin = Math.max(0, ...dalam24Jam.map((p) => p.anginKmJam));
  if (angin >= 25)
    pesan.push(`Angin sampai ${angin} km/jam — pertimbangkan menunda summit attack.`);

  const dingin = Math.min(...dalam24Jam.map((p) => p.suhu));
  if (Number.isFinite(dingin) && dingin <= 20)
    pesan.push(`Suhu terendah ${dingin}°C di desa; di puncak bisa jauh lebih dingin.`);

  if (!pesan.length) pesan.push('Tidak ada peringatan cuaca khusus untuk 24 jam ke depan.');
  return pesan;
}

export async function cuacaKawasan(paksa = false): Promise<CuacaKawasan> {
  if (!paksa && cache && Date.now() < cache.sampai) return cache.data;

  const adm4 = await getSetting('BMKG_ADM4');
  const res = await fetch(`https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=${adm4}`, {
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`BMKG menjawab HTTP ${res.status}`);

  const json = (await res.json()) as {
    lokasi?: Record<string, unknown>;
    data?: { cuaca?: Record<string, unknown>[][] }[];
  };

  const lok = json.lokasi ?? {};
  const blok = json.data?.[0]?.cuaca ?? [];
  const prakiraan = blok.flat().map(petakan);

  // Entri terdekat dengan sekarang, bukan sekadar entri pertama — blok pertama
  // bisa berisi jam yang sudah lewat.
  const kini = Date.now();
  const sekarang =
    prakiraan
      .filter((p) => p.waktu)
      .map((p) => ({ p, selisih: Math.abs(new Date(p.waktu.replace(' ', 'T') + 'Z').getTime() - kini) }))
      .sort((a, b) => a.selisih - b.selisih)[0]?.p ?? null;

  const data: CuacaKawasan = {
    lokasi: {
      desa: String(lok.desa ?? '-'),
      kecamatan: String(lok.kecamatan ?? '-'),
      kabupaten: String(lok.kotkab ?? '-'),
      provinsi: String(lok.provinsi ?? '-'),
      lat: bersih(lok.lat),
      lon: bersih(lok.lon),
    },
    diperbaruiPada: new Date().toISOString(),
    sekarang,
    prakiraan: prakiraan.slice(0, 16),
    peringatan: susunPeringatan(prakiraan),
    sumber: `BMKG · prakiraan desa ${lok.desa ?? adm4}`,
  };

  cache = { data, sampai: Date.now() + TTL_MS };
  return data;
}

/** Dipakai uji agar tidak menembak layanan BMKG sungguhan. */
export const kosongkanCacheCuaca = () => {
  cache = null;
};
