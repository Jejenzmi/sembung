// Pagar pengaman: uji WAJIB memakai database terpisah. Tanpa ini satu kesalahan
// env bisa menghapus seluruh data produksi.
const url = process.env.DATABASE_URL ?? '';
if (!/sembung_test/.test(url)) {
  throw new Error(
    `DATABASE_URL harus menunjuk database uji (mengandung "sembung_test"), diterima: ${url || '(kosong)'}`
  );
}
process.env.NODE_ENV = 'test';
process.env.PAYMENT_MODE = 'simulation';
process.env.PAYMENT_WEBHOOK_SECRET = 'rahasia-uji-webhook';
process.env.JWT_SECRET = 'rahasia-uji-jwt';
