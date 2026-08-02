import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/auth'
import { errMsg } from '../lib/api'

const DEMO = [
  { label: 'Administrator', id: 'admin', pw: 'admin123' },
  { label: 'Petugas Pos', id: 'petugas', pw: 'petugas123' },
  { label: 'Jagawana', id: 'ranger', pw: 'ranger123' },
]

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [identifier, setIdentifier] = useState('admin')
  const [password, setPassword] = useState('admin123')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await login(identifier, password)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error && !('response' in err) ? err.message : errMsg(err, 'Login gagal'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-full lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-moss-800 lg:block">
        <img
          src="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1400&q=80"
          alt=""
          className="h-full w-full object-cover opacity-45"
        />
        <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-moss-900 via-moss-900/40 to-transparent p-12 text-white">
          <span className="text-5xl">🏔️</span>
          <h2 className="mt-4 text-3xl font-extrabold leading-tight">
            Sembung Explorer
            <br />
            Back Office Pengelola
          </h2>
          <p className="mt-3 max-w-md text-sm text-moss-100">
            Kendali kuota pendakian, validasi E-Pass di pos gerbang, dan pusat penanganan sinyal
            darurat Kawasan Wisata Gunung Sembung, Purwakarta.
          </p>
        </div>
      </div>

      <div className="grid place-items-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <span className="text-4xl">🏔️</span>
            <h1 className="mt-2 text-2xl font-extrabold">Sembung Explorer</h1>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Masuk</h1>
          <p className="mt-1 text-sm text-slate-500">Gunakan akun pengelola atau petugas lapangan.</p>

          {error && (
            <div className="mt-5 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {error}
            </div>
          )}

          <div className="mt-6 space-y-4">
            <div>
              <label className="label">Username / Email / No. HP</label>
              <input className="input" value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
            </div>
            <div>
              <label className="label">Kata Sandi</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button className="btn-primary w-full" disabled={busy}>
              {busy ? 'Memproses…' : 'Masuk'}
            </button>
          </div>

          <div className="mt-8">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Akun demo
            </div>
            <div className="flex flex-wrap gap-2">
              {DEMO.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className="btn-ghost !px-3 !py-1.5 !text-xs"
                  onClick={() => {
                    setIdentifier(d.id)
                    setPassword(d.pw)
                  }}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
