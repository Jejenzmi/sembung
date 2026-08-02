import { Voucher, VoucherType } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/http';

export interface HasilVoucher {
  voucher: Voucher;
  discount: number;
}

/**
 * Memvalidasi voucher terhadap satu draf pemesanan dan menghitung potongannya.
 * Semua penolakan memberi alasan spesifik supaya pendaki tahu apa yang salah.
 */
export async function hitungVoucher(
  code: string,
  subtotal: number,
  trailId: string,
  startDate: Date
): Promise<HasilVoucher> {
  const voucher = await prisma.voucher.findUnique({
    where: { code: code.trim().toUpperCase() },
  });
  if (!voucher) throw new AppError('Kode voucher tidak ditemukan', 404);
  if (!voucher.isActive) throw new AppError('Voucher sudah tidak aktif');

  const hari = new Date(
    Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate())
  );
  if (hari < voucher.validFrom)
    throw new AppError(`Voucher berlaku mulai ${voucher.validFrom.toISOString().slice(0, 10)}`);
  if (hari > voucher.validUntil)
    throw new AppError(`Voucher berakhir ${voucher.validUntil.toISOString().slice(0, 10)}`);

  if (voucher.trailId && voucher.trailId !== trailId)
    throw new AppError('Voucher ini hanya berlaku untuk jalur tertentu');

  if (subtotal < voucher.minSpend)
    throw new AppError(`Minimal transaksi ${voucher.minSpend} untuk memakai voucher ini`);

  if (voucher.quota > 0 && voucher.used >= voucher.quota)
    throw new AppError('Kuota voucher sudah habis');

  const kotor =
    voucher.type === VoucherType.PERCENT
      ? Math.floor((subtotal * voucher.value) / 100)
      : voucher.value;

  // Potongan tidak boleh melebihi batas maksimum maupun nilai transaksinya.
  const discount = Math.min(kotor, voucher.maxDiscount ?? kotor, subtotal);
  return { voucher, discount };
}

/** Dipanggil dalam transaksi pembuatan booking agar kuota tidak jebol saat serentak. */
export async function pakaiVoucher(code: string, bookingId: string, userId: string, discount: number) {
  const naik = await prisma.voucher.updateMany({
    where: {
      code,
      isActive: true,
      OR: [{ quota: 0 }, { used: { lt: prisma.voucher.fields.quota } }],
    },
    data: { used: { increment: 1 } },
  });
  if (naik.count === 0) throw new AppError('Kuota voucher sudah habis');

  return prisma.voucherUsage.create({
    data: { voucherCode: code, bookingId, userId, discount },
  });
}

/** Mengembalikan kuota saat booking batal/kedaluwarsa. */
export async function lepasVoucher(bookingId: string) {
  const pemakaian = await prisma.voucherUsage.findUnique({ where: { bookingId } });
  if (!pemakaian) return;
  await prisma.$transaction([
    prisma.voucher.updateMany({
      where: { code: pemakaian.voucherCode, used: { gt: 0 } },
      data: { used: { decrement: 1 } },
    }),
    prisma.voucherUsage.delete({ where: { bookingId } }),
  ]);
}
