import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { BookingStatus } from '../lib/types'

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function StatCard({
  label,
  value,
  hint,
  tone = 'moss',
  icon,
}: {
  label: string
  value: string | number
  hint?: string
  tone?: 'moss' | 'ember' | 'rose' | 'sky' | 'slate'
  icon?: string
}) {
  const tones: Record<string, string> = {
    moss: 'bg-moss-50 text-moss-700 ring-moss-100',
    ember: 'bg-ember-50 text-ember-600 ring-ember-100',
    rose: 'bg-rose-50 text-rose-600 ring-rose-100',
    sky: 'bg-sky-50 text-sky-600 ring-sky-100',
    slate: 'bg-slate-50 text-slate-600 ring-slate-100',
  }
  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
        {icon && (
          <span className={`grid h-9 w-9 place-items-center rounded-xl text-lg ring-1 ${tones[tone]}`}>
            {icon}
          </span>
        )}
      </div>
      <div className="mt-3 text-2xl font-bold text-slate-900">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  )
}

const STATUS_STYLE: Record<string, string> = {
  PENDING_PAYMENT: 'bg-amber-100 text-amber-700',
  PAID: 'bg-sky-100 text-sky-700',
  CHECKED_IN: 'bg-moss-100 text-moss-700',
  COMPLETED: 'bg-slate-200 text-slate-700',
  CANCELLED: 'bg-rose-100 text-rose-700',
  EXPIRED: 'bg-rose-100 text-rose-700',
  OPEN: 'bg-rose-100 text-rose-700',
  ACKNOWLEDGED: 'bg-amber-100 text-amber-700',
  RESCUING: 'bg-ember-100 text-ember-600',
  RESOLVED: 'bg-moss-100 text-moss-700',
  FALSE_ALARM: 'bg-slate-200 text-slate-600',
  LIMITED: 'bg-amber-100 text-amber-700',
  CLOSED: 'bg-rose-100 text-rose-700',
}

const STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: 'Menunggu Bayar',
  PAID: 'Lunas',
  CHECKED_IN: 'Di Gunung',
  COMPLETED: 'Selesai',
  CANCELLED: 'Dibatalkan',
  EXPIRED: 'Kedaluwarsa',
  OPEN: 'Baru',
  ACKNOWLEDGED: 'Ditanggapi',
  RESCUING: 'Evakuasi',
  RESOLVED: 'Selesai',
  FALSE_ALARM: 'Alarm Palsu',
  OPEN_TRAIL: 'Dibuka',
  LIMITED: 'Terbatas',
  CLOSED: 'Ditutup',
}

export function StatusBadge({ status }: { status: BookingStatus | string }) {
  return (
    <span className={`badge ${STATUS_STYLE[status] ?? 'bg-moss-100 text-moss-700'}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

export function Empty({
  text = 'Belum ada data',
  emoji = '🗻',
}: {
  text?: string
  emoji?: string
}) {
  return (
    <div className="grid place-items-center gap-2 py-16 text-slate-400">
      <span className="text-3xl">{emoji}</span>
      <p className="text-sm">{text}</p>
    </div>
  )
}

export function Loading() {
  return (
    <div className="grid place-items-center py-16">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-moss-200 border-t-moss-600" />
    </div>
  )
}

export function Modal({
  open,
  title,
  onClose,
  children,
  wide,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) {
  const [tampil, setTampil] = useState(false)
  const [geser, setGeser] = useState(0)
  const seret = useRef<{ mulai: number; aktif: boolean }>({ mulai: 0, aktif: false })

  // Dipasang setelah satu frame supaya transisi CSS benar-benar berjalan,
  // bukan langsung melompat ke keadaan akhir.
  useEffect(() => {
    if (!open) {
      setTampil(false)
      setGeser(0)
      return
    }
    const id = requestAnimationFrame(() => setTampil(true))
    return () => cancelAnimationFrame(id)
  }, [open])

  // Tutup dengan tombol Escape, dan kunci gulir latar selama modal terbuka.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && tutup()
    document.addEventListener('keydown', onKey)
    const sebelumnya = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = sebelumnya
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const tutup = () => {
    setTampil(false)
    // Beri waktu animasi keluar selesai sebelum melepas dari DOM.
    setTimeout(onClose, 180)
  }

  const mulaiSeret = (y: number) => {
    seret.current = { mulai: y, aktif: true }
  }
  const bergerak = (y: number) => {
    if (!seret.current.aktif) return
    setGeser(Math.max(0, y - seret.current.mulai))
  }
  const selesaiSeret = () => {
    if (!seret.current.aktif) return
    seret.current.aktif = false
    // Ditarik cukup jauh berarti pengguna memang ingin menutup.
    if (geser > 110) tutup()
    else setGeser(0)
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      style={{
        background: `rgba(15,23,42,${tampil ? 0.45 : 0})`,
        transition: 'background 200ms ease',
      }}
      onClick={tutup}
    >
      <div
        className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-2xl ${
          wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'
        }`}
        style={{
          transform: `translateY(${tampil ? geser : 40}px) scale(${tampil ? 1 : 0.98})`,
          opacity: tampil ? 1 : 0,
          transition: seret.current.aktif
            ? 'none'
            : 'transform 220ms cubic-bezier(.22,1,.36,1), opacity 180ms ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Gagang: area tarik untuk menutup, sekaligus penanda bahwa bisa ditarik. */}
        <div
          className="cursor-grab touch-none select-none active:cursor-grabbing"
          onMouseDown={(e) => mulaiSeret(e.clientY)}
          onMouseMove={(e) => bergerak(e.clientY)}
          onMouseUp={selesaiSeret}
          onMouseLeave={selesaiSeret}
          onTouchStart={(e) => mulaiSeret(e.touches[0].clientY)}
          onTouchMove={(e) => bergerak(e.touches[0].clientY)}
          onTouchEnd={selesaiSeret}
        >
          <div className="flex justify-center pt-3">
            <div className="h-1.5 w-11 rounded-full bg-slate-300" />
          </div>
          <div className="flex items-center justify-between px-6 pb-3 pt-3">
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            <button
              className="rounded-lg px-2 text-xl leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              onClick={tutup}
              aria-label="Tutup"
            >
              ×
            </button>
          </div>
        </div>
        <div className="overflow-y-auto px-6 pb-6">{children}</div>
      </div>
    </div>
  )
}

/** Konfirmasi tindakan dengan tampilan dan animasi yang sama seperti Modal. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Ya, lanjutkan',
  danger,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Modal open={open} title={title} onClose={onCancel}>
      <p className="text-sm leading-relaxed text-slate-600">{message}</p>
      <div className="mt-6 flex justify-end gap-2">
        <button className="btn-ghost" onClick={onCancel}>
          Batal
        </button>
        <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <span className="label">{label}</span>
      {children}
    </div>
  )
}
