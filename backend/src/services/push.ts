import crypto from 'crypto';
import { prisma } from '../lib/prisma';

/**
 * Pengiriman push lewat FCM HTTP v1. Kredensial diambil dari akun layanan
 * Firebase (JSON) yang ditaruh di env FIREBASE_SERVICE_ACCOUNT.
 *
 * Bila kredensial belum diisi, seluruh fungsi berhenti dengan tenang dan
 * mengembalikan alasannya — notifikasi tetap tercatat di kotak masuk aplikasi,
 * jadi tidak ada informasi yang hilang.
 */
interface AkunLayanan {
  client_email: string;
  private_key: string;
  project_id: string;
}

let akun: AkunLayanan | null | undefined;

function kredensial(): AkunLayanan | null {
  if (akun !== undefined) return akun;
  const mentah = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!mentah) return (akun = null);
  try {
    const parsed = JSON.parse(
      mentah.trim().startsWith('{') ? mentah : Buffer.from(mentah, 'base64').toString('utf8')
    ) as AkunLayanan;
    return (akun = parsed.client_email && parsed.private_key ? parsed : null);
  } catch {
    console.error('FIREBASE_SERVICE_ACCOUNT bukan JSON yang sah');
    return (akun = null);
  }
}

export const pushSiap = () => kredensial() !== null;

let tokenAkses: { nilai: string; sampai: number } | null = null;

/** Menukar JWT akun layanan dengan access token Google, tanpa SDK tambahan. */
async function ambilTokenAkses(k: AkunLayanan): Promise<string> {
  if (tokenAkses && Date.now() < tokenAkses.sampai) return tokenAkses.nilai;

  const kini = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const klaim = {
    iss: k.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    exp: kini + 3600,
    iat: kini,
  };
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString('base64url');
  const isi = `${b64(header)}.${b64(klaim)}`;
  const tandaTangan = crypto
    .createSign('RSA-SHA256')
    .update(isi)
    .sign(k.private_key.replace(/\\n/g, '\n'), 'base64url');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${isi}.${tandaTangan}`,
    }),
  });
  if (!res.ok) throw new Error(`Gagal menukar token: HTTP ${res.status}`);

  const json = (await res.json()) as { access_token: string; expires_in: number };
  tokenAkses = { nilai: json.access_token, sampai: Date.now() + (json.expires_in - 60) * 1000 };
  return tokenAkses.nilai;
}

export interface IsiPush {
  judul: string;
  pesan: string;
  data?: Record<string, string>;
}

/**
 * Mengirim ke seluruh perangkat milik pengguna. Token yang ditolak FCM
 * (perangkat dicopot / aplikasi dihapus) langsung dibersihkan.
 */
export async function kirimPush(userId: string, isi: IsiPush): Promise<{ terkirim: number; alasan?: string }> {
  const k = kredensial();
  if (!k) return { terkirim: 0, alasan: 'FIREBASE_SERVICE_ACCOUNT belum diset' };

  const perangkat = await prisma.deviceToken.findMany({ where: { userId } });
  if (!perangkat.length) return { terkirim: 0, alasan: 'Pengguna belum mendaftarkan perangkat' };

  const akses = await ambilTokenAkses(k);
  let terkirim = 0;

  for (const d of perangkat) {
    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${k.project_id}/messages:send`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${akses}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            token: d.token,
            notification: { title: isi.judul, body: isi.pesan },
            data: isi.data ?? {},
            android: { priority: 'HIGH', notification: { channel_id: 'sembung_penting' } },
          },
        }),
      }
    );

    if (res.ok) {
      terkirim++;
    } else if (res.status === 404 || res.status === 400) {
      await prisma.deviceToken.delete({ where: { id: d.id } }).catch(() => undefined);
    }
  }

  return { terkirim };
}
