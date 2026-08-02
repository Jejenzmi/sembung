import { useEffect, useState } from 'react'
import { api, tanggal } from '../lib/api'

interface Prakiraan {
  waktuLokal: string
  suhu: number
  kelembapan: number
  cuaca: string
  anginKmJam: number
  arahAngin: string
  jarakPandangM: number
}

interface Cuaca {
  lokasi: { desa: string; kecamatan: string; kabupaten: string }
  sekarang: Prakiraan | null
  prakiraan: Prakiraan[]
  peringatan: string[]
  sumber: string
  diperbaruiPada: string
}

const ikon = (cuaca: string) => {
  const c = cuaca.toLowerCase()
  if (c.includes('petir')) return '⛈️'
  if (c.includes('lebat')) return '🌧️'
  if (c.includes('hujan')) return '🌦️'
  if (c.includes('kabut') || c.includes('asap')) return '🌫️'
  if (c.includes('berawan')) return '⛅'
  if (c.includes('mendung')) return '☁️'
  return '☀️'
}

export default function WeatherCard() {
  const [data, setData] = useState<Cuaca | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .get('/weather')
      .then((r) => setData(r.data.data))
      .catch((e) =>
        setError(e?.response?.data?.message ?? 'Prakiraan cuaca tidak dapat diambil')
      )
  }, [])

  if (error) {
    return (
      <div className="card">
        <h3 className="mb-2 font-bold text-slate-900">Cuaca Kawasan</h3>
        <p className="text-sm text-amber-700">{error}</p>
      </div>
    )
  }
  if (!data) {
    return (
      <div className="card">
        <h3 className="font-bold text-slate-900">Cuaca Kawasan</h3>
        <p className="mt-2 text-sm text-slate-400">Memuat prakiraan BMKG…</p>
      </div>
    )
  }

  const aman = data.peringatan.length === 1 && data.peringatan[0].startsWith('Tidak ada')

  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-bold text-slate-900">Cuaca Kawasan</h3>
          <p className="text-xs text-slate-500">
            {data.lokasi.desa}, {data.lokasi.kecamatan} · {data.sumber}
          </p>
        </div>
        {data.sekarang && (
          <div className="text-right">
            <div className="text-3xl leading-none">{ikon(data.sekarang.cuaca)}</div>
            <div className="mt-1 text-2xl font-bold text-slate-900">{data.sekarang.suhu}°C</div>
          </div>
        )}
      </div>

      {data.sekarang && (
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[
            ['Kondisi', data.sekarang.cuaca],
            ['Angin', `${data.sekarang.anginKmJam} km/j ${data.sekarang.arahAngin}`],
            ['Lembap', `${data.sekarang.kelembapan}%`],
          ].map(([l, v]) => (
            <div key={l} className="rounded-xl bg-slate-50 px-2 py-2">
              <div className="text-[11px] uppercase tracking-wide text-slate-500">{l}</div>
              <div className="mt-0.5 text-xs font-semibold text-slate-800">{v}</div>
            </div>
          ))}
        </div>
      )}

      <div
        className={`mt-4 rounded-xl px-4 py-3 text-xs leading-relaxed ${
          aman ? 'bg-moss-50 text-moss-800' : 'bg-amber-50 text-amber-900'
        }`}
      >
        <div className="mb-1 font-bold">{aman ? '✅ Aman' : '⚠️ Perhatian pendakian'}</div>
        <ul className="space-y-1">
          {data.peringatan.map((p) => (
            <li key={p}>• {p}</li>
          ))}
        </ul>
      </div>

      {data.prakiraan.length > 1 && (
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {data.prakiraan.slice(0, 8).map((p) => (
            <div key={p.waktuLokal} className="min-w-[70px] rounded-xl bg-slate-50 px-2 py-2 text-center">
              <div className="text-[11px] text-slate-500">{p.waktuLokal.slice(11, 16)}</div>
              <div className="text-lg">{ikon(p.cuaca)}</div>
              <div className="text-xs font-semibold">{p.suhu}°</div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-3 text-[11px] text-slate-400">
        Diperbarui {tanggal(data.diperbaruiPada, true)}
      </p>
    </div>
  )
}
