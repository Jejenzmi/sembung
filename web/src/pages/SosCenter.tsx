import { useEffect, useMemo, useState } from 'react'
import { MapContainer, Marker, Polyline, Popup, TileLayer } from 'react-leaflet'
import L from 'leaflet'
import { io, type Socket } from 'socket.io-client'
import { API_URL, api, errMsg, tanggal } from '../lib/api'
import type { SosAlert } from '../lib/types'
import { Empty, Loading, PageHeader, StatusBadge } from '../components/ui'

const TYPE_LABEL: Record<string, string> = {
  INJURY: 'Cedera',
  LOST: 'Tersesat',
  MEDICAL: 'Medis',
  WEATHER: 'Cuaca Ekstrem',
  FIRE: 'Kebakaran',
  OTHER: 'Lainnya',
}

const pin = (color: string) =>
  L.divIcon({
    className: '',
    html: `<div style="width:22px;height:22px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  })

export default function SosCenter() {
  const [alerts, setAlerts] = useState<SosAlert[]>([])
  const [selected, setSelected] = useState<SosAlert | null>(null)
  const [onlyActive, setOnlyActive] = useState(true)
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const load = () => {
    api
      .get('/sos', { params: { ...(onlyActive ? { active: 1 } : {}), limit: 100 } })
      .then((r) => setAlerts(r.data.data))
      .finally(() => setLoading(false))
  }

  useEffect(load, [onlyActive]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const socket: Socket = io(API_URL, { transports: ['websocket', 'polling'] })
    socket.on('sos:new', load)
    socket.on('sos:updated', load)
    return () => {
      socket.close()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const open = async (a: SosAlert) => {
    const { data } = await api.get(`/sos/${a.id}`)
    setSelected(data.data)
    setNote(data.data.resolutionNote ?? '')
    setError('')
  }

  const setStatus = async (status: string) => {
    if (!selected) return
    try {
      const { data } = await api.put(`/sos/${selected.id}/status`, {
        status,
        resolutionNote: note || undefined,
      })
      setSelected({ ...selected, ...data.data })
      load()
    } catch (e) {
      setError(errMsg(e))
    }
  }

  const center = useMemo<[number, number]>(
    () => (selected ? [selected.lat, selected.lng] : [-6.5431, 107.3728]),
    [selected]
  )

  return (
    <>
      <PageHeader
        title="Pusat Penanganan Darurat"
        subtitle="Sinyal SOS pendaki, posisi terakhir, dan koordinasi tim SAR"
        action={
          <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
            <input
              type="checkbox"
              checked={onlyActive}
              onChange={(e) => setOnlyActive(e.target.checked)}
              className="h-4 w-4 rounded accent-moss-600"
            />
            Hanya yang aktif
          </label>
        }
      />

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-2">
          {loading ? (
            <Loading />
          ) : alerts.length ? (
            <ul className="space-y-3">
              {alerts.map((a) => {
                const active = ['OPEN', 'ACKNOWLEDGED', 'RESCUING'].includes(a.status)
                return (
                  <li key={a.id}>
                    <button
                      onClick={() => open(a)}
                      className={`w-full rounded-2xl bg-white p-4 text-left shadow-sm ring-1 transition hover:ring-moss-300 ${
                        selected?.id === a.id ? 'ring-2 ring-moss-500' : 'ring-slate-200'
                      } ${a.status === 'OPEN' ? 'sos-pulse' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{active ? '🚨' : '✅'}</span>
                            <span className="font-mono text-xs text-slate-500">{a.code}</span>
                          </div>
                          <div className="mt-1 truncate font-bold text-slate-900">
                            {TYPE_LABEL[a.type]} · {a.user.name}
                          </div>
                          <div className="mt-0.5 truncate text-xs text-slate-500">
                            {a.booking?.trail.name ?? 'Tanpa booking aktif'} · {tanggal(a.createdAt, true)}
                          </div>
                        </div>
                        <StatusBadge status={a.status} />
                      </div>
                      {a.message && <p className="mt-2 line-clamp-2 text-sm text-slate-600">{a.message}</p>}
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="card">
              <Empty text={onlyActive ? 'Tidak ada sinyal darurat aktif. Situasi aman.' : 'Belum ada riwayat SOS'} />
            </div>
          )}
        </div>

        <div className="lg:col-span-3">
          {selected ? (
            <div className="card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-mono text-xs text-slate-500">{selected.code}</div>
                  <h2 className="text-xl font-bold text-slate-900">
                    {TYPE_LABEL[selected.type]} — {selected.user.name}
                  </h2>
                  <p className="text-sm text-slate-500">
                    {tanggal(selected.createdAt, true)} · {selected.lat.toFixed(5)},{' '}
                    {selected.lng.toFixed(5)}
                    {selected.elevationM ? ` · ${selected.elevationM} mdpl` : ''}
                  </p>
                </div>
                <StatusBadge status={selected.status} />
              </div>

              {selected.message && (
                <div className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">
                  “{selected.message}”
                </div>
              )}

              <div className="mt-4 h-72 overflow-hidden rounded-2xl ring-1 ring-slate-200">
                <MapContainer center={center} zoom={14} style={{ height: '100%', width: '100%' }}>
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution="&copy; OpenStreetMap"
                  />
                  {!!selected.track?.length && (
                    <Polyline
                      positions={selected.track.map((t) => [t.lat, t.lng] as [number, number])}
                      color="#3a6734"
                      weight={4}
                      opacity={0.7}
                    />
                  )}
                  <Marker position={[selected.lat, selected.lng]} icon={pin('#e11d48')}>
                    <Popup>
                      <b>Titik SOS</b>
                      <br />
                      {selected.user.name} · {selected.user.phone}
                    </Popup>
                  </Marker>
                  {selected.track?.slice(0, 1).map((t) => (
                    <Marker key={t.id} position={[t.lat, t.lng]} icon={pin('#0284c7')}>
                      <Popup>Ping terakhir {tanggal(t.at, true)}</Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-4">
                  <div className="label">Pelapor</div>
                  <div className="font-semibold">{selected.user.name}</div>
                  <div className="text-sm text-slate-600">{selected.user.phone}</div>
                  {selected.user.emergencyName && (
                    <div className="mt-2 text-xs text-slate-500">
                      Kontak darurat: {selected.user.emergencyName} ({selected.user.emergencyPhone})
                    </div>
                  )}
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <div className="label">Rombongan</div>
                  {selected.booking ? (
                    <>
                      <div className="font-semibold">{selected.booking.code}</div>
                      <div className="text-sm text-slate-600">
                        {selected.booking.trail.name} · {selected.booking.totalPersons} orang
                      </div>
                      <div className="mt-2 text-xs text-slate-500">
                        {selected.booking.members.map((m) => m.name).join(', ')}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-slate-500">Tidak terkait booking aktif</p>
                  )}
                </div>
              </div>

              {!!selected.notifications?.length && (
                <div className="mt-4 rounded-xl bg-slate-50 p-4">
                  <div className="label">Penyebaran Peringatan</div>
                  <ul className="mt-1 space-y-1.5">
                    {selected.notifications.map((n) => (
                      <li key={n.id} className="flex items-center justify-between gap-3 text-xs">
                        <span className="truncate text-slate-600">
                          {n.channel} → {n.target}
                          {n.error ? ` · ${n.error}` : ''}
                        </span>
                        <span
                          className={`badge ${
                            n.status === 'SENT'
                              ? 'bg-moss-100 text-moss-700'
                              : n.status === 'FAILED'
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {n.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-5">
                <label className="label">Catatan penanganan</label>
                <textarea
                  className="input"
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Tindakan tim, kondisi korban, titik penjemputan…"
                />
              </div>

              {error && <p className="mt-2 text-sm font-medium text-rose-600">{error}</p>}

              <div className="mt-4 flex flex-wrap gap-2">
                <button className="btn-ghost" onClick={() => setStatus('ACKNOWLEDGED')}>
                  Tanggapi
                </button>
                <button className="btn-primary" onClick={() => setStatus('RESCUING')}>
                  Kirim Tim Evakuasi
                </button>
                <button className="btn-danger" onClick={() => setStatus('RESOLVED')}>
                  Tandai Selesai
                </button>
                <button className="btn-ghost" onClick={() => setStatus('FALSE_ALARM')}>
                  Alarm Palsu
                </button>
              </div>

              {selected.handler && (
                <p className="mt-3 text-xs text-slate-500">
                  Ditangani oleh {selected.handler.name}
                  {selected.resolvedAt ? ` · selesai ${tanggal(selected.resolvedAt, true)}` : ''}
                </p>
              )}
            </div>
          ) : (
            <div className="card grid h-full place-items-center">
              <Empty text="Pilih sinyal darurat untuk melihat detail dan peta" />
            </div>
          )}
        </div>
      </div>
    </>
  )
}
