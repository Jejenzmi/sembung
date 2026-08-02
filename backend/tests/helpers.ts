import bcrypt from 'bcryptjs';
import request from 'supertest';
import { Difficulty, PrismaClient, Role, TicketCategory, TrailStatus } from '@prisma/client';
import { createApp } from '../src/app';
import { invalidateSettings } from '../src/services/settings';

export const prisma = new PrismaClient();
export const app = createApp();
export const api = () => request(app);

/** Urutan hapus mengikuti kunci asing supaya tidak melanggar constraint. */
export async function resetDb() {
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.guideReview.deleteMany(),
    prisma.voucherUsage.deleteMany(),
    prisma.voucher.deleteMany(),
    prisma.refund.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.trackPing.deleteMany(),
    prisma.sosAlert.deleteMany(),
    prisma.checkLog.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.bookingItem.deleteMany(),
    prisma.bookingMember.deleteMany(),
    prisma.review.deleteMany(),
    prisma.booking.deleteMany(),
    prisma.gate.deleteMany(),
    prisma.trailPoint.deleteMany(),
    prisma.trail.deleteMany(),
    prisma.guide.deleteMany(),
    prisma.rentalItem.deleteMany(),
    prisma.ticketType.deleteMany(),
    prisma.content.deleteMany(),
    prisma.user.deleteMany(),
    prisma.setting.deleteMany(),
  ]);
  invalidateSettings();
}

const hash = (pw: string) => bcrypt.hashSync(pw, 4); // cepat, khusus uji

export interface Fixtures {
  admin: { id: string; token: string };
  officer: { id: string; token: string };
  visitor: { id: string; token: string };
  visitor2: { id: string; token: string };
  trailId: string;
  gateId: string;
  ticketId: string;
  campId: string;
  rentalId: string;
  guideId: string;
}

async function login(identifier: string, password: string) {
  const res = await api().post('/api/auth/login').send({ identifier, password });
  if (!res.body?.data?.token) {
    throw new Error(`Login ${identifier} gagal: ${JSON.stringify(res.body)}`);
  }
  return { id: res.body.data.user.id as string, token: res.body.data.token as string };
}

/** Data minimum yang cukup untuk seluruh alur: pesan → bayar → gerbang → laporan. */
export async function seedFixtures(): Promise<Fixtures> {
  await prisma.user.createMany({
    data: [
      { name: 'Admin Uji', username: 'admin', phone: '0810000001', passwordHash: hash('uji-admin'), role: Role.ADMIN },
      { name: 'Petugas Uji', username: 'petugas', phone: '0810000002', passwordHash: hash('uji-petugas'), role: Role.OFFICER },
      { name: 'Ranger Uji', username: 'ranger', phone: '0810000003', passwordHash: hash('uji-ranger'), role: Role.RANGER },
      { name: 'Pendaki Satu', email: 'satu@uji.id', phone: '0810000010', passwordHash: hash('uji-pendaki'), role: Role.VISITOR, emergencyPhone: '0810000099' },
      { name: 'Pendaki Dua', email: 'dua@uji.id', phone: '0810000011', passwordHash: hash('uji-pendaki'), role: Role.VISITOR },
    ],
  });

  const trail = await prisma.trail.create({
    data: {
      code: 'TRL-UJI',
      name: 'Jalur Uji',
      slug: 'jalur-uji',
      difficulty: Difficulty.MODERATE,
      status: TrailStatus.OPEN,
      distanceKm: 5,
      elevationGainM: 500,
      summitElevM: 1000,
      estimatedHours: 4,
      dailyQuota: 20,
      points: {
        createMany: {
          data: [
            { name: 'Basecamp', type: 'BASECAMP', lat: -6.53, lng: 107.35, elevationM: 400, sequence: 0 },
            { name: 'Pos 1', type: 'POST', lat: -6.54, lng: 107.36, elevationM: 700, sequence: 1 },
            { name: 'Puncak', type: 'SUMMIT', lat: -6.55, lng: 107.37, elevationM: 1000, sequence: 2 },
          ],
        },
      },
    },
  });

  const gate = await prisma.gate.create({
    data: { code: 'GT-UJI', name: 'Pos Uji', lat: -6.53, lng: 107.35, trailId: trail.id },
  });

  const ticket = await prisma.ticketType.create({
    data: { code: 'TKT-UJI', name: 'Tiket Masuk', category: TicketCategory.ENTRY, price: 10_000 },
  });
  const camp = await prisma.ticketType.create({
    data: { code: 'CMP-UJI', name: 'Izin Berkemah', category: TicketCategory.CAMPING, price: 20_000 },
  });
  const guide = await prisma.guide.create({
    data: { name: 'Pemandu Uji', phone: '0812345678', type: 'GUIDE', ratePerDay: 200_000 },
  });
  const rental = await prisma.rentalItem.create({
    data: { code: 'RNT-UJI', name: 'Tenda Uji', category: 'Tenda', pricePerDay: 50_000, stock: 5 },
  });

  await prisma.setting.createMany({
    data: [
      { key: 'SERVICE_FEE', value: '5000' },
      { key: 'BOOKING_HOLD_MINUTES', value: '120' },
      { key: 'OVERDUE_GRACE_HOURS', value: '12' },
    ],
  });
  invalidateSettings();

  return {
    admin: await login('admin', 'uji-admin'),
    officer: await login('petugas', 'uji-petugas'),
    visitor: await login('satu@uji.id', 'uji-pendaki'),
    visitor2: await login('dua@uji.id', 'uji-pendaki'),
    trailId: trail.id,
    gateId: gate.id,
    ticketId: ticket.id,
    campId: camp.id,
    rentalId: rental.id,
    guideId: guide.id,
  };
}

export const hariKe = (offset: number) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

/** Jalan pintas: pesan → tagih → lunas, mengembalikan booking siap dipakai. */
export async function bookingLunas(f: Fixtures, opts: { start?: string; end?: string; persons?: number } = {}) {
  const start = opts.start ?? hariKe(3);
  const end = opts.end ?? start;
  const persons = opts.persons ?? 2;

  const created = await api()
    .post('/api/bookings')
    .set(bearer(f.visitor.token))
    .send({
      trailId: f.trailId,
      startDate: start,
      endDate: end,
      members: Array.from({ length: persons }, (_, i) => ({ name: `Anggota ${i + 1}` })),
      tickets: [{ id: f.ticketId, qty: persons }],
    });

  const booking = created.body.data;
  await api().post(`/api/bookings/${booking.id}/pay`).set(bearer(f.visitor.token)).send({ method: 'QRIS' });
  await api().post(`/api/bookings/${booking.id}/simulate-payment`).set(bearer(f.visitor.token));

  const epass = await api().get(`/api/bookings/${booking.id}/epass`).set(bearer(f.visitor.token));
  return { id: booking.id as string, code: booking.code as string, qrToken: epass.body.data.qrToken as string };
}

/** Menunggu efek samping asinkron (mis. kipas notifikasi) sampai terpenuhi. */
export async function tunggu<T>(
  ambil: () => Promise<T>,
  cocok: (nilai: T) => boolean,
  batasMs = 5000
): Promise<T> {
  const deadline = Date.now() + batasMs;
  let terakhir = await ambil();
  while (!cocok(terakhir) && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 100));
    terakhir = await ambil();
  }
  return terakhir;
}
