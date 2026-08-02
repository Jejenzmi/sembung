import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { AppError } from '../lib/http';

export interface AuthPayload {
  sub: string;
  role: Role;
  name: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

const secret = () => process.env.JWT_SECRET || 'sembung-dev-secret';

export const signToken = (payload: AuthPayload) =>
  jwt.sign(payload, secret(), { expiresIn: process.env.JWT_EXPIRES_IN || '30d' } as jwt.SignOptions);

export const verifyToken = (token: string) => jwt.verify(token, secret()) as AuthPayload;

export const authenticate = (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next(new AppError('Token tidak ditemukan', 401));
  try {
    req.user = verifyToken(header.slice(7));
    next();
  } catch {
    next(new AppError('Token tidak valid atau kedaluwarsa', 401));
  }
};

export const authorize =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Belum terautentikasi', 401));
    if (roles.length && !roles.includes(req.user.role))
      return next(new AppError('Akses ditolak untuk peran ini', 403));
    next();
  };

/** Staff = anyone who operates the park, as opposed to a visitor. */
export const staffOnly = authorize(Role.ADMIN, Role.OFFICER, Role.RANGER);
