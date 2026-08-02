import { useEffect, useState } from 'react'
import { api, errMsg, rupiah, tanggal } from '../lib/api'
import { useAuth } from '../context/auth'
import { Empty, Loading, Modal, PageHeader } from '../components/ui'

interface Refund {
  id: string
  code: string
  amount: number
  reason: string
  status: 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'PAID'
  method: string | null
  accountName: string | null
  accountNumber: string | null
  note: string | null
  createdAt: string
  processedAt: string | null
  booking: {
    code: string
    total: number
    status: string
    startDate: string
    trail: { name: string }
    user: { name: string; phone: string }
  }
  requestedBy: { name: string; role: string }
  processedBy: { name: string } | null
}

const STATUS_STYLE: Record<string, string> = {
  REQUESTED: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-sky-100 text-sky-700',
  PAID: 'bg-moss-100 text-moss-700',
  REJECTED: 'bg-rose-100 text-rose-700',
}
const STATUS_LABEL: Record<string, string> = {
  REQUESTED: 'Menunggu Persetujuan',
  APPROVED: 'Disetujui',
  PAID: 'Sudah Dibayarkan',
  REJECTED: 'Ditolak',
}

export default function Refunds() {
  const { isAdmin } = useAuth()
  const [rows, setRows] = useState<Refund[]>([])
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<Refund | null>(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [flash, setFlash] = useState('')

  const [creating, setCreating] = useState(false)
  const [bookingCode, setBookingCode] = useState('')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')

  const load = () => {
    setLoading(true)
    api
      .get('/refunds', { params: { limit: 100, ...(status ? { status } : {}) } })
      .then((r) => setRows(r.data.data))
      .finally(() => setLoading(false))
  }

  useEffect(load, [status]) // eslint-disable-line react-hooks/exhaustive-deps

  const decide = async (next: string) => {
    if (!detail) return
    setError('')
    try {
      const { data } = await api.put(`/refunds/${detail.id}/status`, {
        status: next,
        note: note || undefined,
      })
      setFlash(data.message)
      setDetail(null)
      load()
    } catch (e) {
      setError(errMsg(e))
    }
  }

  const submit = async () => {
    setError('')
    try {
      const { data } = await api.post(`/refunds/booking/${bookingCode.trim()}`, {
        ...(amount ? { amount: Number(amount) } : {}),
        reason,
      })
      setFlash(data.message)
      setCreating(false)
      setBookingCode('')
      setAmount('')
      setReason('')
      load()
    } catch (e) {
      setError(errMsg(e))
    }
  }

  return (
    <>
      <PageHeader
        title="Pengembalian Dana"
        subtitle="Pembatalan booking yang sudah dibayar wajib melalui pengajuan refund"
        action={
          <button className="btn-primary" onClick={() => setCreating(true)}>
            + Ajukan Refund
          </button>
        }
      />

      {flash && (
        <div className="mb-4 rounded-xl bg-moss-50 px-4 py-3 text-sm font-medium text-moss-700">{flash}</div>
      )}

      <div className="card mb-4 flex flex-wrap gap-3">
        <select className="input max-w-[240px]" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Semua status</option>
          {Object.entries(STATUS_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>

      <div className="card !p-0">
        {loading ? (
          <Loading />
        ) : rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="th">Kode</th>
                  <th className="th">Booking</th>
                  <th className="th">Pemesan</th>
                  <th className="th">Nominal</th>
                  <th className="th">Alasan</th>
                  <th className="th">Status</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="td font-mono text-xs">{r.code}</td>
                    <td className="td">
                      <div className="font-mono text-xs">{r.booking.code}</div>
                      <div className="text-xs text-slate-500">{r.booking.trail.name}</div>
                    </td>
                    <td className="td">
                      <div className="font-semibold">{r.booking.user.name}</div>
                      <div className="text-xs text-slate-500">{r.booking.user.phone}</div>
                    </td>
                    <td className="td font-semibold">{rupiah(r.amount)}</td>
                    <td className="td max-w-[220px] truncate text-xs">{r.reason}</td>
                    <td className="td">
                      <span className={`badge ${STATUS_STYLE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                    </td>
                    <td className="td">
                      <button
                        className="btn-ghost !px-3 !py-1.5 !text-xs"
                        onClick={() => {
                          setDetail(r)
                          setNote(r.note ?? '')
                          setError('')
                        }}
                      >
                        Detail
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty text="Belum ada pengajuan refund" emoji="💸" />
        )}
      </div>

      <Modal open={creating} title="Ajukan Refund" onClose={() => setCreating(false)}>
        <div className="space-y-4">
          <div>
            <label className="label">Kode Booking</label>
            <input
              className="input font-mono"
              placeholder="BK-20260802-XXXX"
              value={bookingCode}
              onChange={(e) => setBookingCode(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Nominal (kosongkan untuk refund penuh)</label>
            <input
              className="input"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Alasan</label>
            <textarea
              className="input"
              rows={3}
              placeholder="Contoh: jalur ditutup mendadak karena cuaca ekstrem"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setCreating(false)}>
              Batal
            </button>
            <button className="btn-primary" onClick={submit} disabled={reason.length < 4 || !bookingCode}>
              Ajukan
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!detail} title={`Refund ${detail?.code ?? ''}`} onClose={() => setDetail(null)} wide>
        {detail && (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <Cell label="Status" value={<span className={`badge ${STATUS_STYLE[detail.status]}`}>{STATUS_LABEL[detail.status]}</span>} />
              <Cell label="Nominal" value={rupiah(detail.amount)} />
              <Cell label="Total Booking" value={rupiah(detail.booking.total)} />
              <Cell label="Booking" value={`${detail.booking.code} · ${detail.booking.trail.name}`} />
              <Cell label="Pemesan" value={`${detail.booking.user.name} · ${detail.booking.user.phone}`} />
              <Cell label="Diajukan" value={`${detail.requestedBy.name} · ${tanggal(detail.createdAt, true)}`} />
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <div className="label">Alasan</div>
              <p className="text-sm">{detail.reason}</p>
            </div>

            {(detail.accountName || detail.accountNumber) && (
              <div className="rounded-xl bg-slate-50 p-4">
                <div className="label">Rekening Tujuan</div>
                <p className="text-sm">
                  {detail.method ?? '-'} · {detail.accountNumber} a.n. {detail.accountName}
                </p>
              </div>
            )}

            <div>
              <label className="label">Catatan pemroses</label>
              <textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>

            {error && <p className="text-sm font-medium text-rose-600">{error}</p>}

            {isAdmin ? (
              <div className="flex flex-wrap gap-2">
                <button className="btn-primary" onClick={() => decide('APPROVED')}>
                  Setujui (batalkan booking)
                </button>
                <button className="btn-ghost" onClick={() => decide('PAID')}>
                  Tandai Sudah Dibayarkan
                </button>
                <button className="btn-danger" onClick={() => decide('REJECTED')}>
                  Tolak
                </button>
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                Persetujuan refund hanya dapat dilakukan administrator.
              </p>
            )}

            {detail.processedBy && (
              <p className="text-xs text-slate-500">
                Diproses {detail.processedBy.name}
                {detail.processedAt ? ` · ${tanggal(detail.processedAt, true)}` : ''}
              </p>
            )}
          </div>
        )}
      </Modal>
    </>
  )
}

function Cell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="text-sm font-semibold text-slate-800">{value}</div>
    </div>
  )
}
