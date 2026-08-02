import { useEffect, useState } from 'react'
import { api, errMsg, tanggal } from '../lib/api'
import { Empty, Loading, PageHeader } from '../components/ui'

interface SettingRow {
  key: string
  value: string
  isDefault: boolean
  updatedAt: string | null
}

interface NotificationRow {
  id: string
  channel: string
  target: string
  subject: string | null
  body: string
  status: 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED'
  error: string | null
  refType: string | null
  createdAt: string
}

const LABEL: Record<string, { title: string; hint: string }> = {
  SERVICE_FEE: { title: 'Biaya Layanan', hint: 'Ditambahkan sekali per booking (Rp)' },
  BOOKING_HOLD_MINUTES: {
    title: 'Batas Waktu Pembayaran',
    hint: 'Menit sebelum booking kedaluwarsa dan kuota dilepas',
  },
  OVERDUE_GRACE_HOURS: {
    title: 'Toleransi Belum Turun',
    hint: 'Jam setelah jadwal turun sebelum ranger diberi peringatan',
  },
  PARK_NAME: { title: 'Nama Kawasan', hint: 'Tampil di aplikasi pendaki' },
  PARK_PHONE: { title: 'Telepon Pengelola', hint: 'Kontak basecamp' },
  SAR_PHONE: { title: 'Nomor Darurat SAR', hint: 'Tombol telepon darurat di aplikasi' },
  LAST_ASCENT_HOUR: { title: 'Batas Jam Naik', hint: 'Jam terakhir pendaki boleh naik (0–23)' },
}

const STATUS_STYLE: Record<string, string> = {
  SENT: 'bg-moss-100 text-moss-700',
  PENDING: 'bg-amber-100 text-amber-700',
  FAILED: 'bg-rose-100 text-rose-700',
  SKIPPED: 'bg-slate-200 text-slate-600',
}

export default function Settings() {
  const [rows, setRows] = useState<SettingRow[]>([])
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [notifications, setNotifications] = useState<NotificationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState('')
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    Promise.all([
      api.get('/settings').then((r) => {
        setRows(r.data.data)
        setDraft(Object.fromEntries(r.data.data.map((s: SettingRow) => [s.key, s.value])))
      }),
      api.get('/settings/notifications', { params: { limit: 30 } }).then((r) => setNotifications(r.data.data)),
    ]).finally(() => setLoading(false))
  }

  useEffect(load, [])

  const save = async () => {
    setBusy(true)
    setError('')
    setFlash('')
    try {
      const changed = Object.fromEntries(
        Object.entries(draft).filter(([k, v]) => rows.find((r) => r.key === k)?.value !== v)
      )
      if (!Object.keys(changed).length) {
        setFlash('Tidak ada perubahan')
        return
      }
      const { data } = await api.put('/settings', changed)
      setFlash(data.message)
      load()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  const runSweep = async () => {
    setBusy(true)
    try {
      const { data } = await api.post('/settings/run-sweep')
      setFlash(data.message)
      load()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Loading />

  return (
    <>
      <PageHeader
        title="Pengaturan & Notifikasi"
        subtitle="Parameter operasional kawasan dan jejak pengiriman peringatan darurat"
        action={
          <div className="flex gap-2">
            <button className="btn-ghost" disabled={busy} onClick={runSweep}>
              Jalankan Sapuan
            </button>
            <button className="btn-primary" disabled={busy} onClick={save}>
              Simpan Perubahan
            </button>
          </div>
        }
      />

      {flash && (
        <div className="mb-4 rounded-xl bg-moss-50 px-4 py-3 text-sm font-medium text-moss-700">{flash}</div>
      )}
      {error && (
        <div className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h3 className="mb-1 font-bold text-slate-900">Parameter Operasional</h3>
          <p className="mb-5 text-xs text-slate-500">
            Perubahan langsung dipakai backend tanpa perlu restart.
          </p>
          <div className="space-y-4">
            {rows.map((row) => (
              <div key={row.key}>
                <label className="label flex items-center gap-2">
                  {LABEL[row.key]?.title ?? row.key}
                  {row.isDefault && (
                    <span className="badge bg-slate-200 text-slate-600">bawaan</span>
                  )}
                </label>
                <input
                  className="input"
                  value={draft[row.key] ?? ''}
                  onChange={(e) => setDraft({ ...draft, [row.key]: e.target.value })}
                />
                <p className="mt-1 text-xs text-slate-500">
                  {LABEL[row.key]?.hint ?? row.key}
                  {row.updatedAt ? ` · diubah ${tanggal(row.updatedAt, true)}` : ''}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 className="mb-1 font-bold text-slate-900">Notifikasi Keluar</h3>
          <p className="mb-5 text-xs text-slate-500">
            Peringatan SOS dan rombongan telat turun. Status <b>SKIPPED</b> berarti kanal
            pengiriman (mis. token WhatsApp) belum dikonfigurasi di server.
          </p>
          {notifications.length ? (
            <ul className="space-y-2">
              {notifications.map((n) => (
                <li key={n.id} className="rounded-xl bg-slate-50 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-800">
                        {n.subject ?? '(tanpa judul)'}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {n.channel} → {n.target} · {tanggal(n.createdAt, true)}
                      </div>
                    </div>
                    <span className={`badge ${STATUS_STYLE[n.status]}`}>{n.status}</span>
                  </div>
                  {n.error && <p className="mt-1.5 text-xs text-rose-600">{n.error}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <Empty text="Belum ada notifikasi terkirim" />
          )}
        </div>
      </div>
    </>
  )
}
