import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Area,
  AreaChart,
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
import { io, type Socket } from 'socket.io-client'
import { API_URL, api, rupiah, tanggal } from '../lib/api'
import type { Summary } from '../lib/types'
import { Loading, PageHeader, StatCard } from '../components/ui'

interface TrendRow {
  date: string
  persons: number
  bookings: number
  revenue: number
}
interface BreakdownRow {
  type: string
  amount: number
  lines: number
}

const TYPE_LABEL: Record<string, string> = {
  TICKET: 'Tiket & Retribusi',
  RENTAL: 'Sewa Alat',
  GUIDE: 'Guide & Porter',
}
const PIE_COLORS = ['#3a6734', '#f2761b', '#0284c7']

export default function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [trend, setTrend] = useState<TrendRow[]>([])
  const [breakdown, setBreakdown] = useState<BreakdownRow[]>([])

  const load = () => {
    api.get('/dashboard/summary').then((r) => setSummary(r.data.data))
    api.get('/dashboard/trend', { params: { days: 14 } }).then((r) => setTrend(r.data.data))
    api.get('/dashboard/revenue-breakdown').then((r) => setBreakdown(r.data.data))
  }

  useEffect(() => {
    load()
    const socket: Socket = io(API_URL, { transports: ['websocket', 'polling'] })
    socket.on('capacity:changed', load)
    socket.on('booking:paid', load)
    return () => {
      socket.close()
    }
  }, [])

  if (!summary) return <Loading />

  return (
    <>
      <PageHeader
        title="Dashboard Pengelola"
        subtitle={`Kawasan Wisata Gunung Sembung · ${tanggal(new Date())}`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Pendaki di Gunung"
          value={summary.onMountain}
          hint={`${summary.groupsOnMountain} rombongan aktif`}
          icon="🏕️"
        />
        <StatCard
          label="SOS Aktif"
          value={summary.activeSos}
          hint={summary.activeSos ? 'Butuh penanganan segera' : 'Situasi aman'}
          tone={summary.activeSos ? 'rose' : 'slate'}
          icon="🚨"
        />
        <StatCard
          label="Pendapatan Hari Ini"
          value={rupiah(summary.todayRevenue)}
          hint={`Bulan ini ${rupiah(summary.monthRevenue)}`}
          tone="ember"
          icon="💰"
        />
        <StatCard
          label="Kedatangan Hari Ini"
          value={summary.arrivalsToday}
          hint={`${summary.todayBookings} booking dibuat hari ini`}
          tone="sky"
          icon="🎟️"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <h3 className="mb-1 font-bold text-slate-900">Tren Kunjungan 14 Hari</h3>
          <p className="mb-4 text-xs text-slate-500">Jumlah pendaki berdasarkan tanggal mulai pendakian</p>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3a6734" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#3a6734" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} fontSize={11} stroke="#94a3b8" />
              <YAxis fontSize={11} stroke="#94a3b8" allowDecimals={false} />
              <Tooltip
                formatter={(v, n) => (n === 'revenue' ? rupiah(Number(v)) : String(v))}
                labelFormatter={(l) => tanggal(l as string)}
              />
              <Area type="monotone" dataKey="persons" name="Pendaki" stroke="#3a6734" fill="url(#g)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="mb-1 font-bold text-slate-900">Komposisi Pendapatan</h3>
          <p className="mb-4 text-xs text-slate-500">Dari seluruh booking terbayar</p>
          {breakdown.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={breakdown.map((b) => ({ ...b, name: TYPE_LABEL[b.type] ?? b.type }))}
                  dataKey="amount"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                >
                  {breakdown.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => rupiah(Number(v))} />
                <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-16 text-center text-sm text-slate-400">Belum ada transaksi</p>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h3 className="mb-4 font-bold text-slate-900">Okupansi per Jalur</h3>
          <div className="space-y-4">
            {summary.trails.map((t) => (
              <div key={t.trailId}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="font-semibold text-slate-800">{t.trailName}</span>
                  <span className="text-slate-500">
                    {t.persons} / {t.quota} org
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full transition-all ${
                      t.utilization > 85 ? 'bg-rose-500' : t.utilization > 60 ? 'bg-ember-500' : 'bg-moss-500'
                    }`}
                    style={{ width: `${Math.min(100, t.utilization)}%` }}
                  />
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {t.groups} rombongan · okupansi {t.utilization}%
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 className="mb-4 font-bold text-slate-900">Pendapatan Harian</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} fontSize={11} stroke="#94a3b8" />
              <YAxis fontSize={11} stroke="#94a3b8" tickFormatter={(v) => `${v / 1000}k`} />
              <Tooltip formatter={(v) => rupiah(Number(v))} labelFormatter={(l) => tanggal(l as string)} />
              <Bar dataKey="revenue" name="Pendapatan" fill="#f2761b" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 flex gap-2">
            <Link to="/bookings?status=PENDING_PAYMENT" className="btn-ghost flex-1 !text-xs">
              {summary.pendingPayment} menunggu bayar
            </Link>
            <Link to="/on-mountain" className="btn-primary flex-1 !text-xs">
              Lihat pendaki aktif
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
