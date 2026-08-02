import { useEffect, useState } from 'react'
import { api, errMsg, tanggal } from '../lib/api'
import type { User } from '../lib/types'
import { Empty, Loading, Modal, PageHeader , ConfirmDialog } from '../components/ui'

const ROLES = [
  ['ADMIN', 'Administrator'],
  ['OFFICER', 'Petugas Pos Gerbang'],
  ['RANGER', 'Jagawana / SAR'],
  ['VISITOR', 'Pengunjung'],
]
const ROLE_LABEL = Object.fromEntries(ROLES)
const ROLE_STYLE: Record<string, string> = {
  ADMIN: 'bg-moss-100 text-moss-700',
  OFFICER: 'bg-sky-100 text-sky-700',
  RANGER: 'bg-ember-100 text-ember-600',
  VISITOR: 'bg-slate-200 text-slate-600',
}

const blank = { name: '', phone: '', username: '', email: '', password: '', role: 'OFFICER', nik: '', isActive: true }

export default function Users() {
  const [rows, setRows] = useState<User[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [role, setRole] = useState('')
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState('')
  const [akanDinonaktifkan, setAkanDinonaktifkan] = useState<User | null>(null)

  const load = () => {
    setLoading(true)
    api
      .get('/users', { params: { page, limit: 15, ...(role ? { role } : {}), ...(q ? { q } : {}) } })
      .then((r) => {
        setRows(r.data.data)
        setTotal(r.data.meta.total)
      })
      .finally(() => setLoading(false))
  }

  useEffect(load, [page, role, q]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (!form) return
    setError('')
    const payload = { ...form }
    // Empty optional strings would fail email/username uniqueness checks.
    for (const k of ['username', 'email', 'nik', 'password']) {
      if (!payload[k]) delete payload[k]
    }
    try {
      if (form.id) await api.put(`/users/${form.id}`, payload)
      else await api.post('/users', payload)
      setForm(null)
      load()
    } catch (e) {
      setError(errMsg(e))
    }
  }

  const deactivate = async () => {
    if (!akanDinonaktifkan) return
    await api.delete(`/users/${akanDinonaktifkan.id}`)
    setAkanDinonaktifkan(null)
    load()
  }

  const totalPages = Math.max(1, Math.ceil(total / 15))

  return (
    <>
      <PageHeader
        title="Pengguna"
        subtitle={`${total} akun terdaftar`}
        action={
          <button className="btn-primary" onClick={() => setForm({ ...blank })}>
            + Pengguna Baru
          </button>
        }
      />

      <div className="card mb-4 flex flex-wrap gap-3">
        <input
          className="input max-w-xs flex-1"
          placeholder="Cari nama, HP, atau email…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setPage(1)
          }}
        />
        <select
          className="input max-w-[220px]"
          value={role}
          onChange={(e) => {
            setRole(e.target.value)
            setPage(1)
          }}
        >
          <option value="">Semua peran</option>
          {ROLES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>

      <div className="card !p-0">
        {loading ? (
          <Loading />
        ) : rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="th">Nama</th>
                  <th className="th">Kontak</th>
                  <th className="th">Peran</th>
                  <th className="th">Booking</th>
                  <th className="th">Login Terakhir</th>
                  <th className="th">Status</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="td">
                      <div className="font-semibold">{u.name}</div>
                      {u.username && <div className="text-xs text-slate-500">@{u.username}</div>}
                    </td>
                    <td className="td text-xs">
                      <div>{u.phone}</div>
                      <div className="text-slate-500">{u.email ?? '—'}</div>
                    </td>
                    <td className="td">
                      <span className={`badge ${ROLE_STYLE[u.role]}`}>{ROLE_LABEL[u.role]}</span>
                    </td>
                    <td className="td">{u._count?.bookings ?? 0}</td>
                    <td className="td text-xs">{u.lastLoginAt ? tanggal(u.lastLoginAt, true) : 'Belum pernah'}</td>
                    <td className="td">
                      <span className={`badge ${u.isActive ? 'bg-moss-100 text-moss-700' : 'bg-rose-100 text-rose-700'}`}>
                        {u.isActive ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="td">
                      <div className="flex gap-1">
                        <button
                          className="btn-ghost !px-2 !py-1 !text-xs"
                          onClick={() =>
                            setForm({
                              id: u.id,
                              name: u.name,
                              phone: u.phone,
                              username: u.username ?? '',
                              email: u.email ?? '',
                              password: '',
                              role: u.role,
                              nik: u.nik ?? '',
                              isActive: u.isActive,
                            })
                          }
                        >
                          Ubah
                        </button>
                        {u.isActive && (
                          <button className="btn-ghost !px-2 !py-1 !text-xs !text-rose-600" onClick={() => setAkanDinonaktifkan(u)}>
                            Nonaktifkan
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty text="Tidak ada pengguna" />
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
            <span className="text-xs text-slate-500">
              Halaman {page} dari {totalPages}
            </span>
            <div className="flex gap-2">
              <button className="btn-ghost !px-3 !py-1.5 !text-xs" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Sebelumnya
              </button>
              <button
                className="btn-ghost !px-3 !py-1.5 !text-xs"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Berikutnya
              </button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!akanDinonaktifkan}
        title="Nonaktifkan akun?"
        message={`${akanDinonaktifkan?.name ?? ''} tidak akan bisa masuk lagi. Datanya tetap tersimpan dan bisa diaktifkan kembali.`}
        confirmLabel="Ya, nonaktifkan"
        danger
        onConfirm={deactivate}
        onCancel={() => setAkanDinonaktifkan(null)}
      />

      <Modal open={!!form} title={form?.id ? 'Ubah Pengguna' : 'Pengguna Baru'} onClose={() => setForm(null)}>
        {form && (
          <div className="space-y-4">
            {[
              ['name', 'Nama Lengkap'],
              ['phone', 'No. HP'],
              ['username', 'Username (opsional)'],
              ['email', 'Email (opsional)'],
              ['nik', 'NIK (opsional)'],
            ].map(([key, label]) => (
              <div key={key}>
                <label className="label">{label}</label>
                <input
                  className="input"
                  value={String(form[key] ?? '')}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </div>
            ))}
            <div>
              <label className="label">{form.id ? 'Kata Sandi Baru (kosongkan bila tetap)' : 'Kata Sandi'}</label>
              <input
                className="input"
                type="password"
                value={String(form.password ?? '')}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Peran</label>
              <select
                className="input"
                value={String(form.role)}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                {ROLES.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-moss-600"
                checked={!!form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              />
              Akun aktif
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
