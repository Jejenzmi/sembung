import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError } from '../lib/http';

export const notFound = (_req: Request, res: Response) =>
  res.status(404).json({ success: false, message: 'Endpoint tidak ditemukan' });

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (err instanceof ZodError) {
    return res.status(422).json({
      success: false,
      message: 'Validasi gagal',
      errors: err.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
    });
  }
  if (err instanceof AppError) {
    return res.status(err.status).json({ success: false, message: err.message });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = (err.meta?.target as string[] | undefined)?.join(', ') ?? 'data';
      return res.status(409).json({ success: false, message: `${target} sudah digunakan` });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Data tidak ditemukan' });
    }
  }
  console.error(err);
  return res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server' });
};
