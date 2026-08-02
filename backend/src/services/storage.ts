import crypto from 'crypto';
import path from 'path';
import { Client } from 'minio';
import { AppError } from '../lib/http';

const BUCKET = process.env.MINIO_MEDIA_BUCKET || 'sembung-media';

let client: Client | null = null;
function minio() {
  if (client) return client;
  const endPoint = process.env.MINIO_ENDPOINT;
  if (!endPoint) throw new AppError('Penyimpanan berkas belum dikonfigurasi', 503);
  client = new Client({
    endPoint,
    port: Number(process.env.MINIO_PORT || 9000),
    useSSL: (process.env.MINIO_USE_SSL || 'false') === 'true',
    accessKey: process.env.MINIO_USER || '',
    secretKey: process.env.MINIO_PASSWORD || '',
  });
  return client;
}

export const storageReady = () => Boolean(process.env.MINIO_ENDPOINT);

const IZIN = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

/**
 * Menyimpan berkas ke MinIO dan mengembalikan URL publik lewat domain sendiri,
 * bukan alamat MinIO — supaya penyimpanan bisa diganti tanpa mengubah data.
 */
export async function simpanBerkas(
  folder: string,
  berkas: { originalname: string; buffer: Buffer; mimetype: string; size: number }
) {
  const ext = path.extname(berkas.originalname).toLowerCase();
  if (!IZIN.has(ext)) throw new AppError(`Format ${ext || 'tanpa ekstensi'} tidak didukung`, 415);
  if (!berkas.mimetype.startsWith('image/')) throw new AppError('Hanya berkas gambar yang diterima', 415);

  const key = `${folder}/${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
  await minio().putObject(BUCKET, key, berkas.buffer, berkas.size, {
    'Content-Type': berkas.mimetype,
  });

  const base = process.env.PUBLIC_URL || '';
  return { key, url: `${base}/media/${key}`, size: berkas.size };
}

export async function hapusBerkas(key: string) {
  await minio().removeObject(BUCKET, key);
}
