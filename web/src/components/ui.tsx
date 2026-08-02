import type { ReactNode } from 'react'
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
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onClick={onClose}>
      <div
        className={`max-h-[88vh] w-full overflow-y-auto rounded-2xl bg-white p-6 shadow-xl ${
          wide ? 'max-w-3xl' : 'max-w-lg'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <button className="rounded-lg px-2 text-xl text-slate-400 hover:bg-slate-100" onClick={onClose}>
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
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
