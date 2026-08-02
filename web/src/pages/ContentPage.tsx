import { useEffect, useState } from 'react'
import { api, errMsg, tanggal } from '../lib/api'
import type { Content } from '../lib/types'
import { Empty, Loading, Modal, PageHeader , ConfirmDialog } from '../components/ui'
import ImageUpload from '../components/ImageUpload'

const CATEGORY = [
  ['NEWS', '📰 Berita'],
  ['WEATHER', '🌦️ Cuaca'],
  ['EVENT', '🎪 Event'],
  ['HISTORY', '📜 Sejarah Lokal'],
  ['REGULATION', '📋 Tata Tertib'],
]
const LABEL = Object.fromEntries(CATEGORY)

const blank = {
  title: '',
  slug: '',
  category: 'NEWS',
  excerpt: '',
  body: '',
  imageUrl: '',
  isPublished: true,
}

export default function ContentPage() {
  const [rows, setRows] = useState<Content[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState('')
  const [akanDihapus, setAkanDihapus] = useState<Content | null>(null)

  const load = () => {
    setLoading(true)
    api
      .get('/content', { params: { all: 1 } })
      .then((r) => setRows(r.data.data))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const save = async () => {
    if (!form) return
    setError('')
    try {
      if (form.id) await api.put(`/content/${form.id}`, form)
      else await api.post('/content', form)
      setForm(null)
      load()
    } catch (e) {
      setError(errMsg(e))
    }
  }

  const remove = async () => {
    if (!akanDihapus) return
    await api.delete(`/content/${akanDihapus.id}`)
    setAkanDihapus(null)
    load()
  }

  if (loading) return <Loading />

  return (
    <>
      <PageHeader
        title="Konten & Informasi"
        subtitle="Sejarah lokal, tata tertib, prakiraan cuaca, dan agenda kegiatan yang tampil di aplikasi pendaki"
        action={
          <button className="btn-primary" onClick={() => setForm({ ...blank })}>
            + Konten Baru
          </button>
        }
      />

      {rows.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((c) => (
            <article key={c.id} className="card flex flex-col overflow-hidden !p-0">
              {c.imageUrl && (
                <img src={c.imageUrl} alt="" className="h-36 w-full object-cover" />
              )}
              <div className="flex flex-1 flex-col p-5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="badge bg-moss-100 text-moss-700">{LABEL[c.category] ?? c.category}</span>
                  <span className={`badge ${c.isPublished ? 'bg-sky-100 text-sky-700' : 'bg-slate-200 text-slate-600'}`}>
                    {c.isPublished ? 'Terbit' : 'Draf'}
                  </span>
                </div>
                <h3 className="font-bold leading-snug text-slate-900">{c.title}</h3>
                <p className="mt-1.5 line-clamp-3 flex-1 text-sm text-slate-500">{c.excerpt || c.body}</p>
                <div className="mt-3 text-xs text-slate-400">{tanggal(c.publishedAt)}</div>
                <div className="mt-3 flex gap-2">
                  <button
                    className="btn-ghost flex-1 !text-xs"
                    onClick={() =>
                      setForm({ ...c, excerpt: c.excerpt ?? '', imageUrl: c.imageUrl ?? '' })
                    }
                  >
                    Ubah
                  </button>
                  <button className="btn-ghost !text-xs !text-rose-600" onClick={() => setAkanDihapus(c)}>
                    Hapus
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="card">
          <Empty text="Belum ada konten" />
        </div>
      )}

      <ConfirmDialog
        open={!!akanDihapus}
        title="Hapus konten?"
        message={`"${akanDihapus?.title ?? ''}" akan dihapus dan tidak lagi tampil di aplikasi pendaki.`}
        confirmLabel="Ya, hapus"
        danger
        onConfirm={remove}
        onCancel={() => setAkanDihapus(null)}
      />

      <Modal open={!!form} title={form?.id ? 'Ubah Konten' : 'Konten Baru'} onClose={() => setForm(null)} wide>
        {form && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Judul</label>
                <input
                  className="input"
                  value={String(form.title ?? '')}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      title: e.target.value,
                      slug: form.id
                        ? form.slug
                        : e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, '-')
                            .replace(/^-|-$/g, ''),
                    })
                  }
                />
              </div>
              <div>
                <label className="label">Slug</label>
                <input
                  className="input font-mono text-xs"
                  value={String(form.slug ?? '')}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Kategori</label>
                <select
                  className="input"
                  value={String(form.category)}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  {CATEGORY.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Gambar</label>
                <ImageUpload
                  folder="konten"
                  value={String(form.imageUrl ?? '')}
                  onChange={(url) => setForm({ ...form, imageUrl: url })}
                />
              </div>
            </div>
            <div>
              <label className="label">Ringkasan</label>
              <input
                className="input"
                value={String(form.excerpt ?? '')}
                onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Isi Konten</label>
              <textarea
                className="input"
                rows={9}
                value={String(form.body ?? '')}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-moss-600"
                checked={!!form.isPublished}
                onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
              />
              Terbitkan ke aplikasi pendaki
            </label>
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
