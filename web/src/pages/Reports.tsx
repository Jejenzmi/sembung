import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { API_URL, api, errMsg, rupiah } from '../lib/api'
import { Empty, Loading, PageHeader, StatCard } from '../components/ui'

type ReportKey = 'revenue-daily' | 'revenue-by-item' | 'visitors-by-trail' | 'gate-recap' | 'bookings'

const REPORTS: { key: ReportKey; icon: string; title: string; hint: string }[] = [
  { key: 'revenue-daily', icon: '💰', title: 'Retribusi Harian', hint: 'Penerimaan kas per tanggal dan metode bayar' },
  { key: 'revenue-by-item', icon: '🎟️', title: 'Penerimaan per Jenis', hint: 'Rincian tiket, sewa alat, dan jasa pemandu' },
  { key: 'visitors-by-trail', icon: '🥾', title: 'Kunjungan per Jalur', hint: 'Jumlah rombongan dan pendaki tiap jalur' },
  { key: 'gate-recap', icon: '🚪', title: 'Rekap Pos Gerbang', hint: 'Kinerja petugas dan sampah yang dibawa turun' },
  { key: 'bookings', icon: '📒', title: 'Buku Booking', hint: 'Daftar lengkap transaksi untuk arsip' },
]

interface Summary {
  periode: { dari: string; sampai: string }
  penerimaan: number
  transaksi: number
  booking: number
  pendaki: number
  sampahKg: number
  refund: number
  refundCount: number
  penerimaanBersih: number
}

const PIE_COLORS = ['#3a6734', '#f2761b', '#0284c7', '#8b5cf6', '#e11d48']

const firstOfMonth = () => {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

export default function Reports() {
  const [report, setReport] = useState<ReportKey>('revenue-daily')
  const [from, setFrom] = useState(firstOfMonth())
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10))
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    setError('')
    Promise.all([
      api.get(`/reports/${report}`, { params: { from, to } }).then((r) => setRows(r.data.data.rows)),
      api.get('/reports/summary', { params: { from, to } }).then((r) => setSummary(r.data.data)),
    ])
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false))
  }

  useEffect(load, [report, from, to]) // eslint-disable-line react-hooks/exhaustive-deps

  /** CSV is fetched as a blob so the Authorization header still applies. */
  const downloadCsv = async () => {
    try {
      const res = await api.get(`/reports/${report}`, {
        params: { from, to, format: 'csv' },
        responseType: 'blob',
      })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv;charset=utf-8' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `${report}_${from}_${to}.csv`
      link.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(errMsg(e, 'Gagal mengunduh CSV'))
    }
  }

  const columns = useMemo(() => (rows.length ? Object.keys(rows[0]) : []), [rows])
  const isMoney = (key: string) => ['nominal', 'total'].includes(key)

  const chart = useMemo(() => {
    if (report === 'revenue-daily') {
      const byDate = new Map<string, number>()
      for (const r of rows) {
        const d = String(r.tanggal)
        byDate.set(d, (byDate.get(d) ?? 0) + Number(r.nominal))
      }
      return Array.from(byDate, ([name, value]) => ({ name, value }))
    }
    if (report === 'revenue-by-item' || report === 'visitors-by-trail') {
      return rows
        .map((r) => ({
          name: String(r.nama ?? r.jalur ?? ''),
          value: Number(r.nominal ?? 0),
        }))
        .slice(0, 8)
    }
    return []
  }, [rows, report])

  return (
    <>
      <PageHeader
        title="Laporan & Pertanggungjawaban"
        subtitle="Rekap retribusi, kunjungan, dan kinerja pos gerbang — siap diekspor"
        action={
          <button className="btn-primary" onClick={downloadCsv} disabled={!rows.length}>
            ⬇ Unduh CSV
          </button>
        }
      />

      <div className="card mb-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="label">Dari Tanggal</label>
          <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="label">Sampai Tanggal</label>
          <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <p className="ml-auto max-w-xs text-xs text-slate-500">
          CSV memakai pemisah titik koma dan BOM UTF-8 agar langsung rapi di Excel
          berbahasa Indonesia.
        </p>
      </div>

      {summary && (
        <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Penerimaan Kotor"
            value={rupiah(summary.penerimaan)}
            hint={`${summary.transaksi} transaksi lunas`}
            icon="💰"
            tone="ember"
          />
          <StatCard
            label="Penerimaan Bersih"
            value={rupiah(summary.penerimaanBersih)}
            hint={`setelah refund ${rupiah(summary.refund)} (${summary.refundCount}×)`}
            icon="🧾"
          />
          <StatCard
            label="Pendaki"
            value={summary.pendaki}
            hint={`${summary.booking} booking dibuat`}
            icon="🥾"
            tone="sky"
          />
          <StatCard
            label="Sampah Turun"
            value={`${summary.sampahKg} kg`}
            hint="Ditimbang petugas saat check-out"
            icon="♻️"
            tone="slate"
          />
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {REPORTS.map((r) => (
          <button
            key={r.key}
            onClick={() => setReport(r.key)}
            title={r.hint}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              report === r.key
                ? 'bg-moss-600 text-white shadow'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {r.icon} {r.title}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>
      )}

      {loading ? (
        <Loading />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className={`card !p-0 ${chart.length ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
            {rows.length ? (
              <div className="max-h-[560px] overflow-auto">
                <table className="w-full">
                  <thead className="sticky top-0 border-b border-slate-200 bg-slate-50">
                    <tr>
                      {columns.map((c) => (
                        <th key={c} className="th capitalize">
                          {c.replace(/([A-Z])/g, ' $1')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        {columns.map((c) => (
                          <td key={c} className={`td ${isMoney(c) ? 'font-semibold' : ''}`}>
                            {isMoney(c) ? rupiah(Number(row[c])) : String(row[c] ?? '—')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty text="Tidak ada data pada rentang tanggal ini" />
            )}
          </div>

          {chart.length > 0 && (
            <div className="card">
              <h3 className="mb-4 font-bold text-slate-900">
                {report === 'revenue-daily' ? 'Penerimaan Harian' : 'Kontribusi Terbesar'}
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                {report === 'revenue-daily' ? (
                  <BarChart data={chart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="name" tickFormatter={(d) => String(d).slice(5)} fontSize={11} stroke="#94a3b8" />
                    <YAxis fontSize={11} stroke="#94a3b8" tickFormatter={(v) => `${Number(v) / 1000}k`} />
                    <Tooltip formatter={(v) => rupiah(Number(v))} />
                    <Bar dataKey="value" name="Penerimaan" fill="#3a6734" radius={[6, 6, 0, 0]} />
                  </BarChart>
                ) : (
                  <PieChart>
                    <Pie data={chart} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                      {chart.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => rupiah(Number(v))} />
                    <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                )}
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      <p className="mt-4 text-xs text-slate-400">Sumber data langsung dari {API_URL}</p>
    </>
  )
}
