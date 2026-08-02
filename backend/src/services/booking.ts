import { ItemRef, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/http';
import { docCode, qrToken } from '../lib/codes';
import { quotaForDate, startOfDay } from './quota';
import { getNumber } from './settings';
import { hitungVoucher, lepasVoucher, pakaiVoucher } from './voucher';

export interface DraftLine {
  id: string;
  qty: number;
}

export interface DraftMember {
  name: string;
  nik?: string;
  phone?: string;
  age?: number;
  gender?: string;
  emergencyName?: string;
  emergencyPhone?: string;
  isLeader?: boolean;
}

export interface DraftBooking {
  trailId: string;
  startDate: string;
  endDate: string;
  members: DraftMember[];
  tickets: DraftLine[];
  rentals?: DraftLine[];
  guides?: DraftLine[];
  homestays?: DraftLine[];
  voucherCode?: string;
  notes?: string;
}

export const nightsBetween = (start: Date, end: Date) =>
  Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);

/**
 * Prices a draft without persisting it — the mobile checkout screen calls this
 * to show a live total before the visitor commits.
 */
export async function priceDraft(draft: DraftBooking) {
  const start = startOfDay(draft.startDate);
  const end = startOfDay(draft.endDate);
  if (end < start) throw new AppError('Tanggal selesai tidak boleh sebelum tanggal mulai');

  const days = nightsBetween(start, end);
  const persons = draft.members.length;
  if (persons < 1) throw new AppError('Minimal 1 anggota pendakian');

  const lines: Prisma.BookingItemCreateManyBookingInput[] = [];

  const ticketIds = (draft.tickets ?? []).map((t) => t.id);
  const tickets = ticketIds.length
    ? await prisma.ticketType.findMany({ where: { id: { in: ticketIds }, isActive: true } })
    : [];
  for (const line of draft.tickets ?? []) {
    const t = tickets.find((x) => x.id === line.id);
    if (!t) throw new AppError('Jenis tiket tidak ditemukan atau nonaktif');
    if (line.qty < 1) continue;
    // Camping is charged per person per night; other tickets are one-off.
    const chargedDays = t.category === 'CAMPING' ? days : 1;
    lines.push({
      refType: ItemRef.TICKET,
      refId: t.id,
      name: t.name,
      qty: line.qty,
      days: chargedDays,
      unitPrice: t.price,
      amount: t.price * line.qty * chargedDays,
    });
  }
  if (!lines.length) throw new AppError('Pilih minimal satu tiket masuk');

  const rentalIds = (draft.rentals ?? []).map((r) => r.id);
  const rentals = rentalIds.length
    ? await prisma.rentalItem.findMany({ where: { id: { in: rentalIds }, isActive: true } })
    : [];
  for (const line of draft.rentals ?? []) {
    const item = rentals.find((x) => x.id === line.id);
    if (!item) throw new AppError('Alat sewa tidak ditemukan atau nonaktif');
    if (line.qty < 1) continue;
    if (item.stock < line.qty)
      throw new AppError(`Stok ${item.name} tersisa ${item.stock}`);
    lines.push({
      refType: ItemRef.RENTAL,
      refId: item.id,
      name: `Sewa ${item.name}`,
      qty: line.qty,
      days,
      unitPrice: item.pricePerDay,
      amount: item.pricePerDay * line.qty * days,
    });
  }

  const guideIds = (draft.guides ?? []).map((g) => g.id);
  const guides = guideIds.length
    ? await prisma.guide.findMany({ where: { id: { in: guideIds }, isAvailable: true } })
    : [];
  for (const line of draft.guides ?? []) {
    const g = guides.find((x) => x.id === line.id);
    if (!g) throw new AppError('Guide/porter tidak tersedia');
    lines.push({
      refType: ItemRef.GUIDE,
      refId: g.id,
      name: `${g.type === 'PORTER' ? 'Porter' : 'Guide'} ${g.name}`,
      qty: Math.max(1, line.qty),
      days,
      unitPrice: g.ratePerDay,
      amount: g.ratePerDay * Math.max(1, line.qty) * days,
    });
  }

  const homestayIds = (draft.homestays ?? []).map((h) => h.id);
  const homestays = homestayIds.length
    ? await prisma.homestay.findMany({ where: { id: { in: homestayIds }, isActive: true } })
    : [];
  for (const line of draft.homestays ?? []) {
    const h = homestays.find((x) => x.id === line.id);
    if (!h) throw new AppError('Penginapan tidak ditemukan atau nonaktif');
    if (line.qty < 1) continue;
    if (line.qty > h.units)
      throw new AppError(`${h.name} hanya tersedia ${h.units} unit`);
    // Menginap dihitung per MALAM: perjalanan 3 hari berarti 2 malam.
    const malam = Math.max(1, days - 1);
    lines.push({
      refType: ItemRef.HOMESTAY,
      refId: h.id,
      name: `Menginap ${h.name}`,
      qty: line.qty,
      days: malam,
      unitPrice: h.pricePerNight,
      amount: h.pricePerNight * line.qty * malam,
    });
  }

  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const serviceFee = await getNumber('SERVICE_FEE');

  // Potongan dihitung dari subtotal layanan; biaya layanan tetap ditagih penuh.
  let discount = 0;
  let voucherCode: string | null = null;
  if (draft.voucherCode) {
    const hasil = await hitungVoucher(draft.voucherCode, subtotal, draft.trailId, start);
    discount = hasil.discount;
    voucherCode = hasil.voucher.code;
  }

  return {
    start,
    end,
    days,
    persons,
    lines,
    subtotal,
    discount,
    voucherCode,
    serviceFee,
    total: Math.max(0, subtotal - discount) + serviceFee,
  };
}

export async function createBooking(userId: string, draft: DraftBooking) {
  const priced = await priceDraft(draft);

  // Every day of the stay must have room, not just the departure date.
  for (let i = 0; i < priced.days; i++) {
    const day = new Date(priced.start);
    day.setUTCDate(day.getUTCDate() + i);
    const availability = await quotaForDate(draft.trailId, day);
    if (!availability) throw new AppError('Jalur pendakian tidak ditemukan', 404);
    if (availability.status === 'CLOSED') throw new AppError('Jalur sedang ditutup');
    if (availability.remaining < priced.persons)
      throw new AppError(
        `Kuota ${availability.date} tersisa ${availability.remaining} orang, dibutuhkan ${priced.persons}`
      );
  }

  const holdMinutes = await getNumber('BOOKING_HOLD_MINUTES');

  const booking = await prisma.$transaction(async (tx) => {
    // Reserve rental stock at booking time so two groups can't take the last tent.
    for (const line of priced.lines.filter((l) => l.refType === ItemRef.RENTAL)) {
      const updated = await tx.rentalItem.updateMany({
        where: { id: line.refId, stock: { gte: line.qty } },
        data: { stock: { decrement: line.qty } },
      });
      if (updated.count === 0) throw new AppError(`Stok ${line.name} tidak mencukupi`);
    }

    return tx.booking.create({
      data: {
        code: docCode('BK'),
        userId,
        trailId: draft.trailId,
        startDate: priced.start,
        endDate: priced.end,
        totalPersons: priced.persons,
        subtotal: priced.subtotal,
        discount: priced.discount,
        serviceFee: priced.serviceFee,
        total: priced.total,
        qrToken: qrToken(),
        expiresAt: new Date(Date.now() + holdMinutes * 60_000),
        notes: draft.notes,
        items: { createMany: { data: priced.lines } },
        members: {
          createMany: {
            data: draft.members.map((m, i) => ({
              name: m.name,
              nik: m.nik,
              phone: m.phone,
              age: m.age,
              gender: m.gender,
              emergencyName: m.emergencyName,
              emergencyPhone: m.emergencyPhone,
              isLeader: m.isLeader ?? i === 0,
            })),
          },
        },
      },
      include: { items: true, members: true, trail: true },
    });
  });

  if (priced.voucherCode && priced.discount > 0) {
    // Di luar transaksi utama supaya kegagalan kuota voucher tidak menggantung
    // stok alat; bila gagal, booking dibatalkan agar tidak ada potongan hantu.
    try {
      await pakaiVoucher(priced.voucherCode, booking.id, userId, priced.discount);
    } catch (e) {
      await releaseRentals(booking.id);
      await prisma.booking.delete({ where: { id: booking.id } });
      throw e;
    }
  }

  return booking;
}

/** Dipakai saat batal/kedaluwarsa: kembalikan stok DAN kuota voucher. */
export async function releaseBooking(bookingId: string) {
  await releaseRentals(bookingId);
  await lepasVoucher(bookingId);
}

/** Returning rental stock on cancellation keeps the catalogue honest. */
export async function releaseRentals(bookingId: string) {
  const items = await prisma.bookingItem.findMany({
    where: { bookingId, refType: ItemRef.RENTAL },
  });
  await Promise.all(
    items.map((i) =>
      prisma.rentalItem.updateMany({ where: { id: i.refId }, data: { stock: { increment: i.qty } } })
    )
  );
}
