import { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/auth'
import Layout from './components/Layout'
import Login from './pages/Login'
import { Loading } from './components/ui'

// Halaman berat (peta Leaflet, grafik, tabel besar) dimuat saat dibuka saja,
// supaya bundel awal tetap ringan di jaringan basecamp.
const Dashboard = lazy(() => import('./pages/Dashboard'))
const GateScanner = lazy(() => import('./pages/GateScanner'))
const OnMountain = lazy(() => import('./pages/OnMountain'))
const SosCenter = lazy(() => import('./pages/SosCenter'))
const Bookings = lazy(() => import('./pages/Bookings'))
const Trails = lazy(() => import('./pages/Trails'))
const Catalog = lazy(() => import('./pages/Catalog'))
const ContentPage = lazy(() => import('./pages/ContentPage'))
const Users = lazy(() => import('./pages/Users'))
const Settings = lazy(() => import('./pages/Settings'))
const Reports = lazy(() => import('./pages/Reports'))
const Refunds = lazy(() => import('./pages/Refunds'))

function Guard({ children, adminOnly }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, isAdmin } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />
  return <Suspense fallback={<Loading />}>{children}</Suspense>
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <Guard>
                <Layout />
              </Guard>
            }
          >
            <Route index element={<Guard><Dashboard /></Guard>} />
            <Route path="gate" element={<Guard><GateScanner /></Guard>} />
            <Route path="on-mountain" element={<Guard><OnMountain /></Guard>} />
            <Route path="sos" element={<Guard><SosCenter /></Guard>} />
            <Route path="bookings" element={<Guard><Bookings /></Guard>} />
            <Route path="refunds" element={<Guard><Refunds /></Guard>} />
            <Route path="reports" element={<Guard><Reports /></Guard>} />
            <Route path="trails" element={<Guard adminOnly><Trails /></Guard>} />
            <Route path="catalog" element={<Guard adminOnly><Catalog /></Guard>} />
            <Route path="content" element={<Guard adminOnly><ContentPage /></Guard>} />
            <Route path="users" element={<Guard adminOnly><Users /></Guard>} />
            <Route path="settings" element={<Guard adminOnly><Settings /></Guard>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
