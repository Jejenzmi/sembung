// Mengganti sandi akun staf dengan sandi acak kuat dan menonaktifkan akun demo.
// Dijalankan di dalam kontainer backend agar memakai Prisma & DATABASE_URL yang sama.
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Tanpa karakter yang mudah tertukar saat dibacakan di lapangan (O/0, l/1/I).
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
const strongPassword = (len = 16) =>
  Array.from(crypto.randomFillSync(new Uint32Array(len)))
    .map((n) => ALPHABET[n % ALPHABET.length])
    .join('');

const STAFF = ['admin', 'petugas', 'ranger'];
const DEMO_VISITORS = ['demo@sembung.id', 'dewi@sembung.id'];

(async () => {
  const hasil = [];

  for (const username of STAFF) {
    const user = await prisma.user.findFirst({ where: { username } });
    if (!user) { hasil.push([username, 'TIDAK DITEMUKAN', '']); continue; }
    const pw = strongPassword();
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: bcrypt.hashSync(pw, 12) },
    });
    hasil.push([username, user.role, pw]);
  }

  const off = await prisma.user.updateMany({
    where: { email: { in: DEMO_VISITORS } },
    data: { isActive: false },
  });

  console.log('');
  console.log('=================== SANDI BARU — SIMPAN SEKARANG ===================');
  for (const [u, role, pw] of hasil) {
    console.log('  ' + u.padEnd(10) + ' ' + String(role).padEnd(8) + ' ' + pw);
  }
  console.log('===================================================================');
  console.log('Akun demo pengunjung dinonaktifkan: ' + off.count);
  await prisma.$disconnect();
})();
