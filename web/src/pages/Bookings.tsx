import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, rupiah, tanggal } from '../lib/api'
import type { Booking } from '../lib/types'
import { Empty, Loading, Modal, PageHeader, StatusBadge } from '../components/ui'

const STATUSES = [
  ['', 'Semua status'],
  ['PENDING_PAYMENT', 'Menunggu Bayar'],
  ['PAID', 'Lunas'],
  ['CHECKED_IN', 'Di Gunung'],
  ['COMPLETED', 'Selesai'],
  ['CANCELLED', 'Dibatalkan'],
]

export default function Bookings() {
  const [params, setParams] = useSearchParams()
  const [rows, setRows] = useState<Booking[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<Booking | null>(null)
  const status = params.get('status') ?? ''

  useEffect(() => {
    setLoading(true)
    api
      .get('/bookings', { params: { page, limit: 15, ...(status ? { status } : {}), ...(q ? { q } : {}) } })
      .then((r) => {
        setRows(r.data.data)
        setTotal(r.data.meta.total)
      })
      .finally(() => setLoading(false))
  }, [page, status, q])

  const openDetail = async (b: Booking) => {
    const { data } = await api.get(`/bookings/${b.id}`)
    setDetail(data.data)
  }

  const totalPages = Math.max(1, Math.ceil(total / 15))

  return (
    <>
      <PageHeader title="Booking & Tiket" subtitle={`${total} transaksi tercatat`} />

      <div className="card mb-4 flex flex-wrap gap-3">
        <input
          className="input max-w-xs flex-1"
          placeholder="Cari kode booking, nama, atau no. HP…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setPage(1)
          }}
        />
        <select
          className="input max-w-[200px]"
          value={status}
          onChange={(e) => {
            setParams(e.target.value ? { status: e.target.value } : {})
            setPage(1)
          }}
        >
          {STATUSES.map(([v, l]) => (
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
                  <th className="th">Pemesan</th>
                  <th className="th">Jalur</th>
                  <th className="th">Tanggal</th>
                  <th className="th">Orang</th>
                  <th className="th">Total</th>
                  <th className="th">Status</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="td font-mono text-xs">{b.code}</td>
                    <td className="td">
                      <div className="font-semibold">{b.user.name}</div>
                      <div className="text-xs text-slate-500">{b.user.phone}</div>
                    </td>
                    <td className="td">{b.trail.name}</td>
                    <td className="td text-xs">
                      {tanggal(b.startDate)} → {tanggal(b.endDate)}
                    </td>
                    <td className="td">{b.totalPersons}</td>
                    <td className="td font-semibold">{rupiah(b.total)}</td>
                    <td className="td">
                      <StatusBadge status={b.status} />
                    </td>
                    <td className="td">
                      <button className="btn-ghost !px-3 !py-1.5 !text-xs" onClick={() => openDetail(b)}>
                        Detail
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty text="Tidak ada booking yang cocok" />
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
            <span className="text-xs text-slate-500">
              Halaman {page} dari {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                className="btn-ghost !px-3 !py-1.5 !text-xs"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Sebelumnya
              </button>
              <button
                className="btn-ghost !px-3 !py-1.5 !text-xs"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Berikutnya
              </button>
            </div>
          </div>
        )}
      </div>

      <Modal open={!!detail} title={`Booking ${detail?.code ?? ''}`} onClose={() => setDetail(null)} wide>
        {detail && (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <Cell label="Status" value={<StatusBadge status={detail.status} />} />
              <Cell label="Jalur" value={detail.trail.name} />
              <Cell label="Dibuat" value={tanggal(detail.createdAt, true)} />
              <Cell label="Pemesan" value={`${detail.user.name} · ${detail.user.phone}`} />
              <Cell label="Periode" value={`${tanggal(detail.startDate)} → ${tanggal(detail.endDate)}`} />
              <Cell label="Jumlah Orang" value={String(detail.totalPersons)} />
            </div>

            <section>
              <h4 className="mb-2 text-sm font-bold">Rincian Biaya</h4>
              <div className="overflow-hidden rounded-xl ring-1 ring-slate-200">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="th">Item</th>
                      <th className="th">Qty</th>
                      <th className="th">Hari</th>
                      <th className="th">Harga</th>
                      <th className="th">Jumlah</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {detail.items?.map((i) => (
                      <tr key={i.id}>
                        <td className="td">{i.name}</td>
                        <td className="td">{i.qty}</td>
                        <td className="td">{i.days}</td>
                        <td className="td">{rupiah(i.unitPrice)}</td>
                        <td className="td font-semibold">{rupiah(i.amount)}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50">
                      <td className="td font-semibold" colSpan={4}>
                        Subtotal
                      </td>
                      <td className="td font-semibold">{rupiah(detail.subtotal)}</td>
                    </tr>
                    <tr className="bg-slate-50">
                      <td className="td" colSpan={4}>
                        Biaya layanan
                      </td>
                      <td className="td">{rupiah(detail.serviceFee)}</td>
                    </tr>
                    <tr className="bg-moss-50">
                      <td className="td font-bold" colSpan={4}>
                        Total
                      </td>
                      <td className="td font-bold text-moss-700">{rupiah(detail.total)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h4 className="mb-2 text-sm font-bold">Anggota Rombongan</h4>
              <div className="flex flex-wrap gap-2">
                {detail.members?.map((m) => (
                  <span key={m.id} className="rounded-xl bg-slate-100 px-3 py-2 text-sm">
                    {m.name}
                    {m.isLeader && <span className="ml-1 text-xs font-bold text-moss-600">(ketua)</span>}
                  </span>
                ))}
              </div>
            </section>

            {!!detail.payments?.length && (
              <section>
                <h4 className="mb-2 text-sm font-bold">Pembayaran</h4>
                <ul className="space-y-2">
                  {detail.payments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-2.5 text-sm">
                      <span>
                        {p.method} · <span className="font-mono text-xs">{p.reference}</span>
                        {p.vaNumber && <span className="ml-2 font-mono text-xs">VA {p.vaNumber}</span>}
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="font-semibold">{rupiah(p.amount)}</span>
                        <StatusBadge status={p.status === 'PAID' ? 'COMPLETED' : 'PENDING_PAYMENT'} />
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {!!detail.checkLogs?.length && (
              <section>
                <h4 className="mb-2 text-sm font-bold">Riwayat Gerbang</h4>
                <ul className="space-y-2">
                  {detail.checkLogs.map((l) => (
                    <li key={l.id} className="rounded-xl bg-slate-50 px-4 py-2.5 text-sm">
                      {l.type === 'CHECK_IN' ? '⬆️ Check-in' : '⬇️ Check-out'} · {l.personCount} orang ·{' '}
                      {l.gate.name} · {tanggal(l.at, true)}
                      {l.officer && <span className="text-slate-500"> · petugas {l.officer.name}</span>}
                    </li>
                  ))}
                </ul>
              </section>
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
