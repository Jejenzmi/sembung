import { useEffect, useState } from 'react'
import { api, errMsg, rupiah } from '../lib/api'
import type { Gate, Guide, RentalItem, TicketType, Trail } from '../lib/types'
import { Loading, Modal, PageHeader } from '../components/ui'

type Tab = 'tickets' | 'rentals' | 'guides' | 'gates'

const TABS: [Tab, string, string][] = [
  ['tickets', '🎟️', 'Tiket & Retribusi'],
  ['rentals', '🎒', 'Sewa Alat'],
  ['guides', '🧭', 'Guide & Porter'],
  ['gates', '🚪', 'Pos Gerbang'],
]

const TICKET_CATEGORY = [
  ['ENTRY', 'Tiket Masuk'],
  ['CAMPING', 'Izin Berkemah'],
  ['PARKING_MOTOR', 'Parkir Motor'],
  ['PARKING_CAR', 'Parkir Mobil'],
  ['INSURANCE', 'Asuransi'],
]

/** Field descriptors keep the four CRUD tabs on one generic form renderer. */
const FORMS: Record<Tab, { key: string; label: string; type?: string; options?: string[][] }[]> = {
  tickets: [
    { key: 'code', label: 'Kode' },
    { key: 'name', label: 'Nama' },
    { key: 'category', label: 'Kategori', type: 'select', options: TICKET_CATEGORY },
    { key: 'price', label: 'Harga (Rp)', type: 'number' },
    { key: 'description', label: 'Deskripsi', type: 'textarea' },
    { key: 'isActive', label: 'Aktif', type: 'bool' },
  ],
  rentals: [
    { key: 'code', label: 'Kode' },
    { key: 'name', label: 'Nama Alat' },
    { key: 'category', label: 'Kategori' },
    { key: 'pricePerDay', label: 'Sewa / Hari (Rp)', type: 'number' },
    { key: 'stock', label: 'Stok', type: 'number' },
    { key: 'description', label: 'Deskripsi', type: 'textarea' },
    { key: 'isActive', label: 'Aktif', type: 'bool' },
  ],
  guides: [
    { key: 'name', label: 'Nama' },
    { key: 'phone', label: 'No. HP' },
    {
      key: 'type',
      label: 'Jenis',
      type: 'select',
      options: [
        ['GUIDE', 'Guide'],
        ['PORTER', 'Porter'],
      ],
    },
    { key: 'ratePerDay', label: 'Tarif / Hari (Rp)', type: 'number' },
    { key: 'experienceYears', label: 'Pengalaman (tahun)', type: 'number' },
    { key: 'rating', label: 'Rating', type: 'number' },
    { key: 'bio', label: 'Bio', type: 'textarea' },
    { key: 'isAvailable', label: 'Tersedia', type: 'bool' },
  ],
  gates: [
    { key: 'code', label: 'Kode' },
    { key: 'name', label: 'Nama Pos' },
    { key: 'lat', label: 'Latitude', type: 'number' },
    { key: 'lng', label: 'Longitude', type: 'number' },
    // Options are filled at runtime from /trails.
    { key: 'trailId', label: 'Jalur', type: 'select', options: [] },
    { key: 'isActive', label: 'Aktif', type: 'bool' },
  ],
}

const BLANK: Record<Tab, Record<string, unknown>> = {
  tickets: { code: '', name: '', category: 'ENTRY', price: 0, description: '', isActive: true },
  rentals: { code: '', name: '', category: 'Tenda', pricePerDay: 0, stock: 0, description: '', isActive: true },
  guides: { name: '', phone: '', type: 'GUIDE', ratePerDay: 0, experienceYears: 0, rating: 5, bio: '', isAvailable: true },
  gates: { code: '', name: '', lat: -6.53, lng: 107.36, trailId: '', isActive: true },
}

const NUMERIC = ['price', 'pricePerDay', 'stock', 'ratePerDay', 'experienceYears', 'rating', 'lat', 'lng']

export default function Catalog() {
  const [tab, setTab] = useState<Tab>('tickets')
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [trails, setTrails] = useState<string[][]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    api
      .get(`/catalog/${tab}`, { params: { all: 1 } })
      .then((r) => setRows(r.data.data))
      .finally(() => setLoading(false))
  }

  useEffect(load, [tab]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    api
      .get('/trails')
      .then((r) =>
        setTrails([['', '— tanpa jalur —'], ...r.data.data.map((t: Trail) => [t.id, t.name])])
      )
      .catch(() => undefined)
  }, [])

  const fields = FORMS[tab].map((f) =>
    f.key === 'trailId' ? { ...f, options: trails } : f
  )

  const save = async () => {
    if (!form) return
    setError('')
    const payload: Record<string, unknown> = {}
    for (const f of fields) {
      const v = form[f.key]
      if (f.key === 'trailId' && !v) continue // biarkan kosong, bukan string ''
      payload[f.key] = NUMERIC.includes(f.key) ? Number(v) : v
    }
    try {
      if (form.id) await api.put(`/catalog/${tab}/${form.id}`, payload)
      else await api.post(`/catalog/${tab}`, payload)
      setForm(null)
      load()
    } catch (e) {
      setError(errMsg(e))
    }
  }

  const remove = async (row: Record<string, unknown>) => {
    if (!confirm(`Hapus "${row.name}"?`)) return
    try {
      await api.delete(`/catalog/${tab}/${row.id}`)
      load()
    } catch (e) {
      alert(errMsg(e))
    }
  }

  return (
    <>
      <PageHeader
        title="Katalog Layanan"
        subtitle="Tiket, retribusi, penyewaan alat, guide/porter, dan pos gerbang"
        action={
          <button className="btn-primary" onClick={() => setForm({ ...BLANK[tab] })}>
            + Tambah
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map(([key, icon, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              tab === key ? 'bg-moss-600 text-white shadow' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      <div className="card !p-0">
        {loading ? (
          <Loading />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  {fields.slice(0, 5).map((f) => (
                    <th key={f.key} className="th">
                      {f.label}
                    </th>
                  ))}
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={String(row.id)} className="hover:bg-slate-50">
                    {fields.slice(0, 5).map((f) => (
                      <td key={f.key} className="td">
                        {f.type === 'bool' ? (
                          <span className={`badge ${row[f.key] ? 'bg-moss-100 text-moss-700' : 'bg-slate-200 text-slate-600'}`}>
                            {row[f.key] ? 'Aktif' : 'Nonaktif'}
                          </span>
                        ) : NUMERIC.includes(f.key) && f.key.toLowerCase().includes('price') ? (
                          rupiah(Number(row[f.key]))
                        ) : f.key === 'ratePerDay' ? (
                          rupiah(Number(row[f.key]))
                        ) : (
                          String(row[f.key] ?? '—').slice(0, 60)
                        )}
                      </td>
                    ))}
                    <td className="td">
                      <div className="flex gap-1">
                        <button
                          className="btn-ghost !px-2 !py-1 !text-xs"
                          onClick={() => {
                            const next: Record<string, unknown> = { id: row.id }
                            for (const f of fields) next[f.key] = row[f.key] ?? BLANK[tab][f.key]
                            setForm(next)
                          }}
                        >
                          Ubah
                        </button>
                        <button className="btn-ghost !px-2 !py-1 !text-xs !text-rose-600" onClick={() => remove(row)}>
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={!!form} title={form?.id ? 'Ubah Data' : 'Tambah Data'} onClose={() => setForm(null)}>
        {form && (
          <div className="space-y-4">
            {fields.map((f) => (
              <div key={f.key}>
                <label className="label">{f.label}</label>
                {f.type === 'select' ? (
                  <select
                    className="input"
                    value={String(form[f.key] ?? '')}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  >
                    {f.options!.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                ) : f.type === 'textarea' ? (
                  <textarea
                    className="input"
                    rows={2}
                    value={String(form[f.key] ?? '')}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  />
                ) : f.type === 'bool' ? (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-moss-600"
                      checked={!!form[f.key]}
                      onChange={(e) => setForm({ ...form, [f.key]: e.target.checked })}
                    />
                    {f.label}
                  </label>
                ) : (
                  <input
                    className="input"
                    type={f.type === 'number' ? 'number' : 'text'}
                    value={String(form[f.key] ?? '')}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  />
                )}
              </div>
            ))}
            {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setForm(null)}>
                Batal
              </button>
              <button className="btn-primary" onClick={save}>
                Simpan
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

export type { Gate, Guide, RentalItem, TicketType }
