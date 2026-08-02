import { useEffect, useState } from 'react'
import { api, errMsg, rupiah, tanggal } from '../lib/api'
import type { Trail } from '../lib/types'
import { Empty, Loading, Modal, PageHeader } from '../components/ui'

interface Voucher {
  code: string
  name: string
  type: 'PERCENT' | 'FIXED'
  value: number
  maxDiscount: number | null
  minSpend: number
  quota: number
  used: number
  validFrom: string
  validUntil: string
  trailId: string | null
  trail: { name: string } | null
  isActive: boolean
  description: string | null
  _count?: { usages: number }
}

const kosong = {
  code: '',
  name: '',
  type: 'PERCENT',
  value: 10,
  maxDiscount: '',
  minSpend: 0,
  quota: 0,
  validFrom: new Date().toISOString().slice(0, 10),
  validUntil: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10),
  trailId: '',
  isActive: true,
  description: '',
}

export default function Vouchers() {
  const [rows, setRows] = useState<Voucher[]>([])
  const [trails, setTrails] = useState<Trail[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState('')
  const [flash, setFlash] = useState('')

  const load = () => {
    setLoading(true)
    api
      .get('/vouchers')
      .then((r) => setRows(r.data.data))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    api.get('/trails').then((r) => setTrails(r.data.data)).catch(() => undefined)
  }, [])

  const simpan = async () => {
    if (!form) return
    setError('')
    const payload = {
      ...form,
      value: Number(form.value),
      minSpend: Number(form.minSpend),
      quota: Number(form.quota),
      maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : null,
      trailId: form.trailId || null,
    }
    try {
      const { data } = form.code && rows.some((r) => r.code === form.code)
        ? await api.put(`/vouchers/${form.code}`, payload)
        : await api.post('/vouchers', payload)
      setFlash(data.message)
      setForm(null)
      load()
    } catch (e) {
      setError(errMsg(e))
    }
  }

  const hapus = async (v: Voucher) => {
    if (!confirm(`Hapus voucher ${v.code}?`)) return
    const { data } = await api.delete(`/vouchers/${v.code}`)
    setFlash(data.message)
    load()
  }

  const potongan = (v: Voucher) =>
    v.type === 'PERCENT'
      ? `${v.value}%${v.maxDiscount ? ` (maks ${rupiah(v.maxDiscount)})` : ''}`
      : rupiah(v.value)

  if (loading) return <Loading />

  return (
    <>
      <PageHeader
        title="Voucher & Potongan"
        subtitle="Potongan retribusi untuk event, komunitas, atau promosi musiman"
        action={
          <button className="btn-primary" onClick={() => setForm({ ...kosong })}>
            + Voucher Baru
          </button>
        }
      />

      {flash && (
        <div className="mb-4 rounded-xl bg-moss-50 px-4 py-3 text-sm font-medium text-moss-700">{flash}</div>
      )}

      <div className="card !p-0">
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="th">Kode</th>
                  <th className="th">Nama</th>
                  <th className="th">Potongan</th>
                  <th className="th">Min. Belanja</th>
                  <th className="th">Kuota</th>
                  <th className="th">Berlaku</th>
                  <th className="th">Status</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((v) => {
                  const habis = v.quota > 0 && v.used >= v.quota
                  return (
                    <tr key={v.code} className="hover:bg-slate-50">
                      <td className="td font-mono text-xs font-bold">{v.code}</td>
                      <td className="td">
                        <div className="font-semibold">{v.name}</div>
                        <div className="text-xs text-slate-500">{v.trail?.name ?? 'Semua jalur'}</div>
                      </td>
                      <td className="td font-semibold">{potongan(v)}</td>
                      <td className="td">{v.minSpend ? rupiah(v.minSpend) : '—'}</td>
                      <td className="td">
                        {v.quota ? `${v.used}/${v.quota}` : `${v.used} (tanpa batas)`}
                      </td>
                      <td className="td text-xs">
                        {tanggal(v.validFrom)} → {tanggal(v.validUntil)}
                      </td>
                      <td className="td">
                        <span
                          className={`badge ${
                            !v.isActive
                              ? 'bg-slate-200 text-slate-600'
                              : habis
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-moss-100 text-moss-700'
                          }`}
                        >
                          {!v.isActive ? 'Nonaktif' : habis ? 'Kuota habis' : 'Aktif'}
                        </span>
                      </td>
                      <td className="td">
                        <div className="flex gap-1">
                          <button
                            className="btn-ghost !px-2 !py-1 !text-xs"
                            onClick={() =>
                              setForm({
                                ...v,
                                maxDiscount: v.maxDiscount ?? '',
                                trailId: v.trailId ?? '',
                                description: v.description ?? '',
                                validFrom: v.validFrom.slice(0, 10),
                                validUntil: v.validUntil.slice(0, 10),
                              })
                            }
                          >
                            Ubah
                          </button>
                          <button
                            className="btn-ghost !px-2 !py-1 !text-xs !text-rose-600"
                            onClick={() => hapus(v)}
                          >
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty text="Belum ada voucher" emoji="🎫" />
        )}
      </div>

      <Modal open={!!form} title="Voucher" onClose={() => setForm(null)} wide>
        {form && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Kode</label>
              <input
                className="input font-mono uppercase"
                value={String(form.code ?? '')}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              />
            </div>
            <div>
              <label className="label">Nama</label>
              <input
                className="input"
                value={String(form.name ?? '')}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Jenis Potongan</label>
              <select
                className="input"
                value={String(form.type)}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                <option value="PERCENT">Persentase (%)</option>
                <option value="FIXED">Nominal tetap (Rp)</option>
              </select>
            </div>
            <div>
              <label className="label">{form.type === 'PERCENT' ? 'Persentase' : 'Nominal (Rp)'}</label>
              <input
                type="number"
                className="input"
                value={String(form.value ?? '')}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Potongan Maksimum (Rp, opsional)</label>
              <input
                type="number"
                className="input"
                value={String(form.maxDiscount ?? '')}
                onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Minimal Belanja (Rp)</label>
              <input
                type="number"
                className="input"
                value={String(form.minSpend ?? 0)}
                onChange={(e) => setForm({ ...form, minSpend: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Kuota (0 = tanpa batas)</label>
              <input
                type="number"
                className="input"
                value={String(form.quota ?? 0)}
                onChange={(e) => setForm({ ...form, quota: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Khusus Jalur</label>
              <select
                className="input"
                value={String(form.trailId ?? '')}
                onChange={(e) => setForm({ ...form, trailId: e.target.value })}
              >
                <option value="">Semua jalur</option>
                {trails.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Berlaku Dari</label>
              <input
                type="date"
                className="input"
                value={String(form.validFrom)}
                onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Berlaku Sampai</label>
              <input
                type="date"
                className="input"
                value={String(form.validUntil)}
                onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Keterangan</label>
              <textarea
                className="input"
                rows={2}
                value={String(form.description ?? '')}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                className="h-4 w-4 accent-moss-600"
                checked={!!form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              />
              Voucher aktif
            </label>
            {error && <p className="text-sm font-medium text-rose-600 sm:col-span-2">{error}</p>}
            <div className="flex justify-end gap-2 sm:col-span-2">
              <button className="btn-ghost" onClick={() => setForm(null)}>
                Batal
              </button>
              <button className="btn-primary" onClick={simpan}>
                Simpan
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
