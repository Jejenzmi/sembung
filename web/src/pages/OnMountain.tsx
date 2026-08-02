import { useEffect, useState } from 'react'
import { MapContainer, Marker, Polyline, Popup, TileLayer } from 'react-leaflet'
import L from 'leaflet'
import { io, type Socket } from 'socket.io-client'
import { API_URL, api, tanggal } from '../lib/api'
import type { Booking, TrackPing, TrailPoint } from '../lib/types'
import { Empty, Loading, PageHeader, StatCard } from '../components/ui'

const hikerPin = (overdue: boolean) =>
  L.divIcon({
    className: '',
    html: `<div style="font-size:22px;filter:drop-shadow(0 2px 3px rgba(0,0,0,.4))">${overdue ? '🔴' : '🥾'}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  })

const POINT_ICON: Record<string, string> = {
  BASECAMP: '🏠',
  POST: '⛺',
  WATER_SOURCE: '💧',
  CAMPING_GROUND: '🏕️',
  PHOTO_SPOT: '📸',
  SUMMIT: '🏔️',
  JUNCTION: '🔀',
  DANGER: '⚠️',
  SHELTER: '🛖',
  CLIFF: '🧗',
}

export default function OnMountain() {
  const [groups, setGroups] = useState<Booking[]>([])
  const [points, setPoints] = useState<TrailPoint[]>([])
  const [track, setTrack] = useState<TrackPing[]>([])
  const [selected, setSelected] = useState<Booking | null>(null)
  const [loading, setLoading] = useState(true)

  const load = () =>
    api
      .get('/gate/on-mountain')
      .then((r) => setGroups(r.data.data))
      .finally(() => setLoading(false))

  useEffect(() => {
    load()
    api.get('/trails/pasanggrahan/offline-bundle').then((r) => setPoints(r.data.data.points))
    const socket: Socket = io(API_URL, { transports: ['websocket', 'polling'] })
    socket.on('capacity:changed', load)
    socket.on('track:ping', load)
    return () => {
      socket.close()
    }
  }, [])

  const openGroup = async (b: Booking) => {
    setSelected(b)
    const { data } = await api.get(`/sos/track/${b.id}`)
    setTrack(data.data)
  }

  if (loading) return <Loading />

  const totalPersons = groups.reduce((s, g) => s + g.totalPersons, 0)
  const overdue = groups.filter((g) => g.overdue).length

  return (
    <>
      <PageHeader
        title="Pendaki di Gunung"
        subtitle="Pemantauan rombongan yang sudah check-in dan belum turun"
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatCard label="Rombongan Aktif" value={groups.length} icon="🏕️" />
        <StatCard label="Total Pendaki" value={totalPersons} icon="🥾" tone="sky" />
        <StatCard
          label="Melewati Jadwal Turun"
          value={overdue}
          hint={overdue ? 'Segera hubungi ketua rombongan' : 'Semua sesuai jadwal'}
          tone={overdue ? 'rose' : 'slate'}
          icon="⏰"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-2">
          {groups.length ? (
            <ul className="space-y-3">
              {groups.map((g) => (
                <li key={g.id}>
                  <button
                    onClick={() => openGroup(g)}
                    className={`w-full rounded-2xl bg-white p-4 text-left shadow-sm ring-1 transition hover:ring-moss-300 ${
                      selected?.id === g.id ? 'ring-2 ring-moss-500' : 'ring-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-slate-500">{g.code}</span>
                      {g.overdue && (
                        <span className="badge bg-rose-100 text-rose-700">Lewat jadwal</span>
                      )}
                    </div>
                    <div className="mt-1 font-bold text-slate-900">{g.user.name}</div>
                    <div className="text-xs text-slate-500">
                      {g.trail.name} · {g.totalPersons} orang · naik {tanggal(g.checkedInAt!, true)}
                    </div>
                    <div className="mt-2 text-xs">
                      {g.lastPing ? (
                        <span className="text-moss-700">
                          📍 Ping terakhir {tanggal(g.lastPing.at, true)}
                          {g.lastPing.elevationM ? ` · ${g.lastPing.elevationM} mdpl` : ''}
                        </span>
                      ) : (
                        <span className="text-slate-400">Belum ada laporan lokasi</span>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="card">
              <Empty text="Tidak ada pendaki di atas gunung saat ini" />
            </div>
          )}
        </div>

        <div className="card lg:col-span-3">
          <h3 className="mb-3 font-bold text-slate-900">
            {selected ? `Jejak Rombongan ${selected.code}` : 'Peta Kawasan Gunung Sembung'}
          </h3>
          <div className="h-[500px] overflow-hidden rounded-2xl ring-1 ring-slate-200">
            <MapContainer center={[-6.541, 107.371]} zoom={13} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
                attribution="&copy; OpenTopoMap"
              />
              {points.map((p) => (
                <Marker
                  key={p.id}
                  position={[p.lat, p.lng]}
                  icon={L.divIcon({
                    className: '',
                    html: `<div style="font-size:16px">${POINT_ICON[p.type] ?? '📍'}</div>`,
                    iconSize: [18, 18],
                    iconAnchor: [9, 9],
                  })}
                >
                  <Popup>
                    <b>{p.name}</b>
                    <br />
                    {p.elevationM} mdpl
                    {p.description ? <><br />{p.description}</> : null}
                  </Popup>
                </Marker>
              ))}
              {points.length > 1 && (
                <Polyline
                  positions={points
                    .filter((p) => p.type !== 'PHOTO_SPOT')
                    .map((p) => [p.lat, p.lng] as [number, number])}
                  color="#94a3b8"
                  weight={3}
                  dashArray="6 6"
                />
              )}
              {selected && track.length > 0 && (
                <>
                  <Polyline
                    positions={track.map((t) => [t.lat, t.lng] as [number, number])}
                    color="#3a6734"
                    weight={5}
                    opacity={0.8}
                  />
                  <Marker
                    position={[track[track.length - 1].lat, track[track.length - 1].lng]}
                    icon={hikerPin(!!selected.overdue)}
                  >
                    <Popup>
                      <b>{selected.user.name}</b>
                      <br />
                      {selected.totalPersons} orang · {selected.code}
                      <br />
                      {tanggal(track[track.length - 1].at, true)}
                      {track[track.length - 1].battery != null && (
                        <>
                          <br />🔋 {track[track.length - 1].battery}%
                        </>
                      )}
                    </Popup>
                  </Marker>
                </>
              )}
            </MapContainer>
          </div>

          {selected && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-4">
                <div className="label">Ketua Rombongan</div>
                <div className="font-semibold">{selected.user.name}</div>
                <div className="text-sm text-slate-600">{selected.user.phone}</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <div className="label">Rencana Turun</div>
                <div className="font-semibold">{tanggal(selected.endDate)}</div>
                <div className="text-sm text-slate-600">{track.length} titik lokasi terekam</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
