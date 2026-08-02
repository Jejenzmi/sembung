import { Response } from 'express';

/** Escapes a value for CSV: quotes, commas and newlines all need wrapping. */
const cell = (value: unknown) => {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export interface Column<T> {
  key: keyof T & string;
  label: string;
}

export function toCsv<T extends Record<string, unknown>>(rows: T[], columns: Column<T>[]) {
  const header = columns.map((c) => cell(c.label)).join(';');
  const body = rows.map((row) => columns.map((c) => cell(row[c.key])).join(';'));
  // Semicolons + BOM so Excel in an Indonesian locale opens it correctly.
  return '﻿' + [header, ...body].join('\r\n');
}

export function sendCsv<T extends Record<string, unknown>>(
  res: Response,
  filename: string,
  rows: T[],
  columns: Column<T>[]
) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(toCsv(rows, columns));
}
