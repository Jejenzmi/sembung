import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { io, type Socket } from 'socket.io-client'
import { API_URL, api } from '../lib/api'
import { useAuth } from '../context/auth'

interface NavItem {
  to: string
  label: string
  icon: string
  roles?: string[]
}

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: 'Operasional',
    items: [
      { to: '/', label: 'Dashboard', icon: '📊' },
      { to: '/gate', label: 'Scanner Pos Gerbang', icon: '📷' },
      { to: '/on-mountain', label: 'Pendaki di Gunung', icon: '🏕️' },
      { to: '/sos', label: 'Pusat Darurat SOS', icon: '🚨' },
      { to: '/bookings', label: 'Booking & Tiket', icon: '🎟️' },
    ],
  },
  {
    section: 'Keuangan & Laporan',
    items: [
      { to: '/reports', label: 'Laporan & Ekspor', icon: '📈' },
      { to: '/refunds', label: 'Pengembalian Dana', icon: '💸' },
      { to: '/vouchers', label: 'Voucher & Potongan', icon: '🎫', roles: ['ADMIN'] },
    ],
  },
  {
    section: 'Master Data',
    items: [
      { to: '/trails', label: 'Jalur & Titik Peta', icon: '🗺️', roles: ['ADMIN'] },
      { to: '/catalog', label: 'Tiket, Sewa & Guide', icon: '🎒', roles: ['ADMIN'] },
      { to: '/content', label: 'Konten & Informasi', icon: '📰', roles: ['ADMIN'] },
      { to: '/users', label: 'Pengguna', icon: '👥', roles: ['ADMIN'] },
      { to: '/settings', label: 'Pengaturan & Notifikasi', icon: '⚙️', roles: ['ADMIN'] },
    ],
  },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [sosCount, setSosCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [pilot, setPilot] = useState(false)

  useEffect(() => {
    // Selama mode simulasi, pemesan bisa menandai lunas sendiri — operator
    // harus melihat itu, bukan menemukannya lewat selisih kas.
    fetch(API_URL + '/health')
      .then((r) => r.json())
      .then((d) => setPilot(d?.data?.paymentMode === 'simulation'))
      .catch(() => undefined)

    const load = () =>
      api
        .get('/sos', { params: { active: 1, limit: 1 } })
        .then((r) => setSosCount(r.data.meta?.total ?? 0))
        .catch(() => undefined)
    load()

    // Live desk: a new SOS must surface without the operator refreshing.
    const socket: Socket = io(API_URL, { transports: ['websocket', 'polling'] })
    socket.on('sos:new', (a: { code: string }) => {
      setToast(`🚨 Sinyal darurat baru: ${a.code}`)
      load()
    })
    socket.on('sos:updated', load)
    socket.on('gate:check-in', (d: { code: string; persons: number }) =>
      setToast(`✅ Check-in ${d.code} — ${d.persons} orang`)
    )
    socket.on('booking:paid', (d: { code: string }) => setToast(`💰 Pembayaran lunas: ${d.code}`))
    return () => {
      socket.close()
    }
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(t)
  }, [toast])

  const visible = NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => !i.roles || i.roles.includes(user?.role ?? '')),
  })).filter((g) => g.items.length)

  return (
    <div className="flex h-full">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 shrink-0 overflow-y-auto bg-moss-800 px-4 py-6 text-moss-100 transition-transform lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-8 flex items-center gap-3 px-2">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-moss-600 text-2xl">🏔️</span>
          <div>
            <div className="text-base font-extrabold text-white">Sembung Explorer</div>
            <div className="text-[11px] uppercase tracking-wider text-moss-300">Back Office Pengelola</div>
          </div>
        </div>

        {visible.map((group) => (
          <div key={group.section} className="mb-6">
            <div className="mb-2 px-3 text-[11px] font-bold uppercase tracking-wider text-moss-400">
              {group.section}
            </div>
            <nav className="space-y-1">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                      isActive ? 'bg-moss-600 text-white shadow' : 'hover:bg-moss-700/60'
                    }`
                  }
                >
                  <span className="text-base">{item.icon}</span>
                  <span className="flex-1">{item.label}</span>
                  {item.to === '/sos' && sosCount > 0 && (
                    <span className="sos-pulse rounded-full bg-rose-500 px-2 py-0.5 text-[11px] font-bold text-white">
                      {sosCount}
                    </span>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>
        ))}

        <div className="mt-auto rounded-2xl bg-moss-900/60 p-4">
          <div className="text-sm font-semibold text-white">{user?.name}</div>
          <div className="mb-3 text-[11px] uppercase tracking-wide text-moss-400">{user?.role}</div>
          <button
            className="w-full rounded-xl bg-moss-700 px-3 py-2 text-xs font-semibold text-white hover:bg-moss-600"
            onClick={() => {
              logout()
              navigate('/login')
            }}
          >
            Keluar
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-5 py-3 lg:hidden">
          <button className="btn-ghost !px-3 !py-1.5" onClick={() => setOpen((v) => !v)}>
            ☰
          </button>
          <span className="font-bold">Sembung Explorer</span>
        </header>
        {pilot && (
          <div className="flex items-center gap-2 bg-amber-100 px-5 py-2 text-xs font-semibold text-amber-800">
            <span>⚠️</span>
            <span>
              Mode pembayaran <b>SIMULASI</b> — pemesan dapat menandai pesanannya lunas
              tanpa membayar. Ubah PAYMENT_MODE ke live sebelum transaksi sungguhan.
            </span>
          </div>
        )}
        <main className="flex-1 overflow-y-auto p-5 lg:p-8">
          <Outlet />
        </main>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-xl">
          {toast}
        </div>
      )}
    </div>
  )
}
