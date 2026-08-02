import { useRef, useState } from 'react'
import { api, errMsg } from '../lib/api'

/**
 * Kolom gambar yang menerima URL manual maupun unggahan langsung ke MinIO,
 * supaya data lama yang memakai URL luar tetap berfungsi.
 */
export default function ImageUpload({
  folder,
  value,
  onChange,
}: {
  folder: 'jalur' | 'konten' | 'sewa' | 'avatar'
  value: string
  onChange: (url: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const unggah = async (file: File) => {
    setBusy(true)
    setError('')
    try {
      const form = new FormData()
      form.append('file', file)
      const { data } = await api.post(`/media/${folder}`, form)
      onChange(data.data.url)
    } catch (e) {
      setError(errMsg(e, 'Gagal mengunggah'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="https://… atau unggah berkas"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className="btn-ghost whitespace-nowrap"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? 'Mengunggah…' : '⬆ Unggah'}
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) unggah(file)
          e.target.value = ''
        }}
      />
      {error && <p className="mt-1 text-xs font-medium text-rose-600">{error}</p>}
      {value && (
        <img
          src={value}
          alt=""
          className="mt-2 h-24 w-full rounded-xl object-cover ring-1 ring-slate-200"
          onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
        />
      )}
    </div>
  )
}
