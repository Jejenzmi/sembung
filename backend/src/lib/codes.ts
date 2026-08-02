import crypto from 'crypto';

const pad = (n: number, len = 4) => String(n).padStart(len, '0');

const stamp = (d = new Date()) =>
  `${d.getFullYear()}${pad(d.getMonth() + 1, 2)}${pad(d.getDate(), 2)}`;

/** Human-friendly sequential-ish document code, e.g. BK-20260801-8FA2 */
export const docCode = (prefix: string) =>
  `${prefix}-${stamp()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

/** Opaque token embedded in the visitor e-pass QR. */
export const qrToken = () => crypto.randomBytes(24).toString('base64url');

export const paymentRef = (method: string) =>
  `${method}-${Date.now().toString(36).toUpperCase()}-${crypto
    .randomBytes(2)
    .toString('hex')
    .toUpperCase()}`;

/**
 * Static QRIS-like payload. Real deployment swaps this for a Midtrans/Xendit
 * response; the shape (merchant + amount + ref) stays the same.
 */
export const qrisPayload = (ref: string, amount: number) =>
  `00020101021226680014ID.SEMBUNG.WWW0118${ref}5204553933360362${
    'ID'
  }5405${amount}5802ID5915SEMBUNG EXPLORER6010PURWAKARTA6304`;

export const vaNumber = (bankPrefix: string) =>
  `${bankPrefix}${Date.now().toString().slice(-10)}`;
