import { useEffect, useState } from 'react'
import { MapContainer, Marker, Polyline, Popup, TileLayer } from 'react-leaflet'
import L from 'leaflet'
import { api, errMsg } from '../lib/api'
import type { Trail, TrailPoint } from '../lib/types'
import { Empty, Loading, Modal, PageHeader, StatusBadge , ConfirmDialog } from '../components/ui'
import ImageUpload from '../components/ImageUpload'

const POINT_TYPES = [
  ['BASECAMP', '🏠 Basecamp'],
  ['POST', '⛺ Pos'],
  ['WATER_SOURCE', '💧 Sumber Air'],
  ['CAMPING_GROUND', '🏕️ Camping Ground'],
  ['PHOTO_SPOT', '📸 Spot Foto'],
  ['SUMMIT', '🏔️ Puncak'],
  ['JUNCTION', '🔀 Persimpangan'],
  ['DANGER', '⚠️ Titik Bahaya'],
  ['SHELTER', '🛖 Shelter'],
  ['CLIFF', '🧗 Tebing'],
]
const ICON: Record<string, string> = Object.fromEntries(
  POINT_TYPES.map(([v, l]) => [v, l.split(' ')[0]])
)

const DIFFICULTY = [
  ['EASY', 'Mudah'],
  ['MODERATE', 'Sedang'],
  ['HARD', 'Sulit'],
  ['EXTREME', 'Ekstrem'],
]

const emptyTrail = {
  code: '',
  name: '',
  slug: '',
  difficulty: 'MODERATE',
  status: 'OPEN',
  distanceKm: 5,
  elevationGainM: 500,
  summitElevM: 1180,
  estimatedHours: 4,
  dailyQuota: 100,
  description: '',
  imageUrl: '',
}

export default function Trails() {
  const [trails, setTrails] = useState<Trail[]>([])
  const [selected, setSelected] = useState<Trail | null>(null)
  const [points, setPoints] = useState<TrailPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [trailForm, setTrailForm] = useState<Record<string, unknown> | null>(null)
  const [pointForm, setPointForm] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState('')
  const [titikDihapus, setTitikDihapus] = useState<TrailPoint | null>(null)

  const loadTrails = () =>
    api
      .get('/trails')
      .then((r) => setTrails(r.data.data))
      .finally(() => setLoading(false))

  useEffect(() => {
    loadTrails()
  }, [])

  const openTrail = async (t: Trail) => {
    const { data } = await api.get(`/trails/${t.slug}`)
    setSelected(data.data)
    setPoints(data.data.points ?? [])
  }

  useEffect(() => {
    if (!selected && trails.length) openTrail(trails[0])
  }, [trails]) // eslint-disable-line react-hooks/exhaustive-deps

  const saveTrail = async () => {
    if (!trailForm) return
    setError('')
    const payload = {
      ...trailForm,
      distanceKm: Number(trailForm.distanceKm),
      elevationGainM: Number(trailForm.elevationGainM),
      summitElevM: Number(trailForm.summitElevM),
      estimatedHours: Number(trailForm.estimatedHours),
      dailyQuota: Number(trailForm.dailyQuota),
    }
    try {
      if (trailForm.id) await api.put(`/trails/${trailForm.id}`, payload)
      else await api.post('/trails', payload)
      setTrailForm(null)
      await loadTrails()
    } catch (e) {
      setError(errMsg(e))
    }
  }

  const savePoint = async () => {
    if (!pointForm || !selected) return
    setError('')
    const payload = {
      ...pointForm,
      lat: Number(pointForm.lat),
      lng: Number(pointForm.lng),
      elevationM: Number(pointForm.elevationM),
      sequence: Number(pointForm.sequence),
    }
    try {
      if (pointForm.id) await api.put(`/trails/points/${pointForm.id}`, payload)
      else await api.post(`/trails/${selected.id}/points`, payload)
      setPointForm(null)
      await openTrail(selected)
    } catch (e) {
      setError(errMsg(e))
    }
  }

  const removePoint = async () => {
    if (!titikDihapus) return
    await api.delete(`/trails/points/${titikDihapus.id}`)
    setTitikDihapus(null)
    if (selected) openTrail(selected)
  }

  if (loading) return <Loading />

  return (
    <>
      <PageHeader
        title="Jalur & Titik Peta"
        subtitle="Kelola jalur pendakian, kuota harian, dan titik penting untuk peta offline"
        action={
          <button className="btn-primary" onClick={() => setTrailForm({ ...emptyTrail })}>
            + Jalur Baru
          </button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <div className="space-y-3">
          {trails.map((t) => (
            <button
              key={t.id}
              onClick={() => openTrail(t)}
              className={`w-full rounded-2xl bg-white p-4 text-left shadow-sm ring-1 transition hover:ring-moss-300 ${
                selected?.id === t.id ? 'ring-2 ring-moss-500' : 'ring-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-slate-500">{t.code}</span>
                <StatusBadge status={t.status === 'OPEN' ? 'COMPLETED' : t.status} />
              </div>
              <div className="mt-1 font-bold text-slate-900">{t.name}</div>
              <div className="text-xs text-slate-500">
                {t.distanceKm} km · {t.summitElevM} mdpl · kuota {t.dailyQuota}/hari
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {t._count?.points ?? t.points?.length ?? 0} titik · ⭐ {t.rating ?? 0}
              </div>
            </button>
          ))}
        </div>

        <div className="lg:col-span-3">
          {selected ? (
            <div className="card">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{selected.name}</h2>
                  <p className="mt-1 max-w-2xl text-sm text-slate-500">{selected.description}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    className="btn-ghost !text-xs"
                    onClick={() => setTrailForm({ ...selected, description: selected.description ?? '', imageUrl: selected.imageUrl ?? '' })}
                  >
                    Ubah Jalur
                  </button>
                  <button
                    className="btn-primary !text-xs"
                    onClick={() =>
                      setPointForm({
                        name: '',
                        type: 'POST',
                        lat: -6.54,
                        lng: 107.37,
                        elevationM: 800,
                        sequence: points.length,
                        description: '',
                      })
                    }
                  >
                    + Titik
                  </button>
                </div>
              </div>

              <div className="mb-4 grid gap-3 sm:grid-cols-4">
                <Metric label="Jarak" value={`${selected.distanceKm} km`} />
                <Metric label="Elevation gain" value={`${selected.elevationGainM} m`} />
                <Metric label="Estimasi" value={`${selected.estimatedHours} jam`} />
                <Metric label="Kuota harian" value={`${selected.dailyQuota} org`} />
              </div>

              <div className="h-80 overflow-hidden rounded-2xl ring-1 ring-slate-200">
                <MapContainer
                  key={selected.id}
                  center={points.length ? [points[0].lat, points[0].lng] : [-6.541, 107.371]}
                  zoom={13}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
                    attribution="&copy; OpenTopoMap"
                  />
                  <Polyline
                    positions={points
                      .filter((p) => p.type !== 'PHOTO_SPOT')
                      .map((p) => [p.lat, p.lng] as [number, number])}
                    color="#3a6734"
                    weight={4}
                  />
                  {points.map((p) => (
                    <Marker
                      key={p.id}
                      position={[p.lat, p.lng]}
                      icon={L.divIcon({
                        className: '',
                        html: `<div style="font-size:18px">${ICON[p.type] ?? '📍'}</div>`,
                        iconSize: [20, 20],
                        iconAnchor: [10, 10],
                      })}
                    >
                      <Popup>
                        <b>{p.name}</b>
                        <br />
                        {p.elevationM} mdpl
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>

              <div className="mt-5 overflow-hidden rounded-xl ring-1 ring-slate-200">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="th">#</th>
                      <th className="th">Titik</th>
                      <th className="th">Jenis</th>
                      <th className="th">Koordinat</th>
                      <th className="th">Elevasi</th>
                      <th className="th"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {points.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="td">{p.sequence}</td>
                        <td className="td font-medium">{p.name}</td>
                        <td className="td text-xs">
                          {ICON[p.type]} {p.type}
                        </td>
                        <td className="td font-mono text-xs">
                          {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
                        </td>
                        <td className="td">{p.elevationM} m</td>
                        <td className="td">
                          <div className="flex gap-1">
                            <button
                              className="btn-ghost !px-2 !py-1 !text-xs"
                              onClick={() => setPointForm({ ...p, description: p.description ?? '' })}
                            >
                              Ubah
                            </button>
                            <button
                              className="btn-ghost !px-2 !py-1 !text-xs !text-rose-600"
                              onClick={() => setTitikDihapus(p)}
                            >
                              Hapus
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="card">
              <Empty text="Pilih jalur pendakian" />
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!titikDihapus}
        title="Hapus titik peta?"
        message={`"${titikDihapus?.name ?? ''}" akan hilang dari peta jalur dan dari paket peta offline pendaki.`}
        confirmLabel="Ya, hapus"
        danger
        onConfirm={removePoint}
        onCancel={() => setTitikDihapus(null)}
      />

      <Modal
        open={!!trailForm}
        title={trailForm?.id ? 'Ubah Jalur' : 'Jalur Baru'}
        onClose={() => setTrailForm(null)}
        wide
      >
        {trailForm && (
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ['code', 'Kode'],
              ['name', 'Nama Jalur'],
              ['slug', 'Slug'],
              ['distanceKm', 'Jarak (km)'],
              ['elevationGainM', 'Elevation Gain (m)'],
              ['summitElevM', 'Ketinggian Puncak (mdpl)'],
              ['estimatedHours', 'Estimasi (jam)'],
              ['dailyQuota', 'Kuota Harian'],
            ].map(([key, label]) => (
              <div key={key}>
                <label className="label">{label}</label>
                <input
                  className="input"
                  value={String(trailForm[key] ?? '')}
                  onChange={(e) => setTrailForm({ ...trailForm, [key]: e.target.value })}
                />
              </div>
            ))}
            <div>
              <label className="label">Tingkat Kesulitan</label>
              <select
                className="input"
                value={String(trailForm.difficulty)}
                onChange={(e) => setTrailForm({ ...trailForm, difficulty: e.target.value })}
              >
                {DIFFICULTY.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Status Jalur</label>
              <select
                className="input"
                value={String(trailForm.status)}
                onChange={(e) => setTrailForm({ ...trailForm, status: e.target.value })}
              >
                <option value="OPEN">Dibuka</option>
                <option value="LIMITED">Terbatas</option>
                <option value="CLOSED">Ditutup</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label">Gambar Jalur</label>
              <ImageUpload
                folder="jalur"
                value={String(trailForm.imageUrl ?? '')}
                onChange={(url) => setTrailForm({ ...trailForm, imageUrl: url })}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Deskripsi</label>
              <textarea
                className="input"
                rows={3}
                value={String(trailForm.description ?? '')}
                onChange={(e) => setTrailForm({ ...trailForm, description: e.target.value })}
              />
            </div>
            {error && <p className="text-sm font-medium text-rose-600 sm:col-span-2">{error}</p>}
            <div className="flex justify-end gap-2 sm:col-span-2">
              <button className="btn-ghost" onClick={() => setTrailForm(null)}>
                Batal
              </button>
              <button className="btn-primary" onClick={saveTrail}>
                Simpan
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={!!pointForm}
        title={pointForm?.id ? 'Ubah Titik' : 'Titik Baru'}
        onClose={() => setPointForm(null)}
      >
        {pointForm && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label">Nama Titik</label>
              <input
                className="input"
                value={String(pointForm.name ?? '')}
                onChange={(e) => setPointForm({ ...pointForm, name: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Jenis</label>
              <select
                className="input"
                value={String(pointForm.type)}
                onChange={(e) => setPointForm({ ...pointForm, type: e.target.value })}
              >
                {POINT_TYPES.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            {[
              ['lat', 'Latitude'],
              ['lng', 'Longitude'],
              ['elevationM', 'Elevasi (mdpl)'],
              ['sequence', 'Urutan'],
            ].map(([key, label]) => (
              <div key={key}>
                <label className="label">{label}</label>
                <input
                  className="input"
                  value={String(pointForm[key] ?? '')}
                  onChange={(e) => setPointForm({ ...pointForm, [key]: e.target.value })}
                />
              </div>
            ))}
            <div className="sm:col-span-2">
              <label className="label">Deskripsi</label>
              <textarea
                className="input"
                rows={2}
                value={String(pointForm.description ?? '')}
                onChange={(e) => setPointForm({ ...pointForm, description: e.target.value })}
              />
            </div>
            {error && <p className="text-sm font-medium text-rose-600 sm:col-span-2">{error}</p>}
            <div className="flex justify-end gap-2 sm:col-span-2">
              <button className="btn-ghost" onClick={() => setPointForm(null)}>
                Batal
              </button>
              <button className="btn-primary" onClick={savePoint}>
                Simpan
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="label">{label}</div>
      <div className="text-sm font-bold text-slate-800">{value}</div>
    </div>
  )
}
