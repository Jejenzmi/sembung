import { useEffect, useRef, useState } from 'react'
import { api, errMsg, tanggal } from '../lib/api'
import type { Booking, CheckLog, Gate } from '../lib/types'
import { Empty, PageHeader, StatusBadge } from '../components/ui'
import QrCamera from '../components/QrCamera'

interface ScanResult {
  booking: Booking
  valid: boolean
  reasons: string[]
  nextAction: 'CHECK_IN' | 'CHECK_OUT' | 'NONE'
}

export default function GateScanner() {
  const [gates, setGates] = useState<Gate[]>([])
  const [gateId, setGateId] = useState('')
  const [token, setToken] = useState('')
  const [scan, setScan] = useState<ScanResult | null>(null)
  const [persons, setPersons] = useState(0)
  const [waste, setWaste] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [flash, setFlash] = useState('')
  const [logs, setLogs] = useState<CheckLog[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const loadLogs = () => api.get('/gate/logs', { params: { limit: 8 } }).then((r) => setLogs(r.data.data))

  useEffect(() => {
    api.get('/catalog/gates').then((r) => {
      setGates(r.data.data)
      setGateId(r.data.data[0]?.id ?? '')
    })
    loadLogs()
    inputRef.current?.focus()
  }, [])

  const doScan = async (value?: string, e?: React.FormEvent) => {
    e?.preventDefault()
    const raw = (value ?? token).trim()
    if (!raw) return
    setToken(raw)
    setError('')
    setFlash('')
    try {
      const { data } = await api.post('/gate/scan', { token: raw })
      setScan(data.data)
      setPersons(data.data.booking.totalPersons)
      setWaste('')
    } catch (err) {
      setScan(null)
      setError(errMsg(err, 'E-Pass tidak dikenali'))
    }
  }

  const act = async (type: 'check-in' | 'check-out') => {
    if (!scan || !gateId) return
    setError('')
    try {
      const { data } = await api.post(`/gate/${type}`, {
        token: scan.booking.qrToken,
        gateId,
        personCount: persons,
        ...(type === 'check-out' && waste ? { wasteKg: Number(waste) } : {}),
        notes: notes || undefined,
      })
      setFlash(data.message)
      setScan(null)
      setToken('')
      setNotes('')
      setWaste('')
      loadLogs()
      inputRef.current?.focus()
    } catch (err) {
      setError(errMsg(err, 'Aksi gagal'))
    }
  }

  return (
    <>
      <PageHeader
        title="Scanner Pos Gerbang"
        subtitle="Pindai QR E-Pass pendaki, lalu catat check-in atau check-out"
      />

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="card lg:col-span-2">
          <label className="label">Pos Gerbang Bertugas</label>
          <select className="input" value={gateId} onChange={(e) => setGateId(e.target.value)}>
            {gates.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>

          <form onSubmit={(e) => doScan(undefined, e)} className="mt-5">
            <label className="label">Token QR / Kode Booking</label>
            <input
              ref={inputRef}
              className="input font-mono"
              placeholder="Tempel hasil scan atau ketik kode booking…"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
            <p className="mt-2 text-xs text-slate-500">
              Alat pemindai QR genggam akan mengisi kolom ini otomatis lalu menekan Enter.
            </p>
            <button className="btn-primary mt-4 w-full">Pindai E-Pass</button>
          </form>

          <QrCamera onDetected={(value) => doScan(value)} />

          {error && (
            <div className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {error}
            </div>
          )}
          {flash && (
            <div className="mt-4 rounded-xl bg-moss-50 px-4 py-3 text-sm font-medium text-moss-700">
              {flash}
            </div>
          )}

          <div className="mt-8">
            <h3 className="mb-3 text-sm font-bold text-slate-900">Aktivitas Gerbang Terakhir</h3>
            {logs.length ? (
              <ul className="space-y-2">
                {logs.map((l) => (
                  <li key={l.id} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                    <span className="text-lg">{l.type === 'CHECK_IN' ? '⬆️' : '⬇️'}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-slate-800">
                        {l.booking?.code} · {l.personCount} org
                      </div>
                      <div className="text-xs text-slate-500">
                        {l.gate.name} · {tanggal(l.at, true)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-400">Belum ada aktivitas.</p>
            )}
          </div>
        </div>

        <div className="lg:col-span-3">
          {scan ? (
            <div className="card">
              <div
                className={`-m-5 mb-5 rounded-t-2xl px-5 py-4 ${
                  scan.valid ? 'bg-moss-600' : 'bg-amber-500'
                } text-white`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-wide opacity-80">Hasil Pemindaian</div>
                    <div className="text-xl font-bold">{scan.booking.code}</div>
                  </div>
                  <span className="text-3xl">{scan.valid ? '✅' : '⚠️'}</span>
                </div>
                {!!scan.reasons.length && (
                  <ul className="mt-2 space-y-0.5 text-sm">
                    {scan.reasons.map((r) => (
                      <li key={r}>• {r}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Info label="Status" value={<StatusBadge status={scan.booking.status} />} />
                <Info label="Jalur" value={scan.booking.trail.name} />
                <Info label="Pemesan" value={`${scan.booking.user.name} · ${scan.booking.user.phone}`} />
                <Info
                  label="Tanggal"
                  value={`${tanggal(scan.booking.startDate)} → ${tanggal(scan.booking.endDate)}`}
                />
              </div>

              <h4 className="mb-2 mt-6 text-sm font-bold text-slate-900">
                Anggota Rombongan ({scan.booking.members?.length ?? 0})
              </h4>
              <div className="overflow-hidden rounded-xl ring-1 ring-slate-200">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="th">Nama</th>
                      <th className="th">NIK</th>
                      <th className="th">Kontak Darurat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {scan.booking.members?.map((m) => (
                      <tr key={m.id}>
                        <td className="td font-medium">
                          {m.name} {m.isLeader && <span className="badge ml-1 bg-moss-100 text-moss-700">Ketua</span>}
                        </td>
                        <td className="td font-mono text-xs">{m.nik ?? '—'}</td>
                        <td className="td text-xs">
                          {m.emergencyName ? `${m.emergencyName} (${m.emergencyPhone ?? '-'})` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h4 className="mb-2 mt-6 text-sm font-bold text-slate-900">Rincian Tiket & Layanan</h4>
              <ul className="space-y-1.5">
                {scan.booking.items?.map((i) => (
                  <li key={i.id} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <span>
                      {i.name} <span className="text-slate-400">×{i.qty}</span>
                      {i.days > 1 && <span className="text-slate-400"> · {i.days} hari</span>}
                    </span>
                  </li>
                ))}
              </ul>

              {scan.nextAction !== 'NONE' && (
                <div className="mt-6 rounded-2xl bg-slate-50 p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="label">Jumlah orang aktual</label>
                      <input
                        type="number"
                        min={0}
                        className="input"
                        value={persons}
                        onChange={(e) => setPersons(Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label className="label">Catatan petugas</label>
                      <input
                        className="input"
                        placeholder="opsional"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                      />
                    </div>
                    {scan.nextAction === 'CHECK_OUT' && (
                      <div className="sm:col-span-2">
                        <label className="label">Sampah dibawa turun (kg)</label>
                        <input
                          type="number"
                          min={0}
                          step="0.1"
                          className="input"
                          placeholder="Timbang sesuai tata tertib butir 2"
                          value={waste}
                          onChange={(e) => setWaste(e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                  <button
                    className={`mt-4 w-full ${scan.nextAction === 'CHECK_IN' ? 'btn-primary' : 'btn-danger'}`}
                    onClick={() => act(scan.nextAction === 'CHECK_IN' ? 'check-in' : 'check-out')}
                  >
                    {scan.nextAction === 'CHECK_IN'
                      ? `⬆️ Catat Check-In (${persons} orang naik)`
                      : `⬇️ Catat Check-Out (${persons} orang turun)`}
                  </button>
                  {scan.nextAction === 'CHECK_OUT' && persons < scan.booking.totalPersons && (
                    <p className="mt-2 text-center text-xs font-semibold text-rose-600">
                      {scan.booking.totalPersons - persons} orang belum turun — verifikasi sebelum menyimpan.
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="card grid h-full place-items-center">
              <Empty text="Belum ada E-Pass yang dipindai" />
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="text-sm font-semibold text-slate-800">{value}</div>
    </div>
  )
}
