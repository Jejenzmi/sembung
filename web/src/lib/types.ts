export type Role = 'ADMIN' | 'OFFICER' | 'RANGER' | 'VISITOR'

export interface User {
  id: string
  name: string
  username?: string | null
  email?: string | null
  phone: string
  role: Role
  nik?: string | null
  isActive: boolean
  lastLoginAt?: string | null
  createdAt: string
  _count?: { bookings: number }
}

export interface Trail {
  id: string
  code: string
  name: string
  slug: string
  difficulty: 'EASY' | 'MODERATE' | 'HARD' | 'EXTREME'
  status: 'OPEN' | 'LIMITED' | 'CLOSED'
  distanceKm: number
  elevationGainM: number
  summitElevM: number
  estimatedHours: number
  dailyQuota: number
  description?: string | null
  imageUrl?: string | null
  rating?: number
  points?: TrailPoint[]
  _count?: { points: number; reviews: number }
}

export interface TrailPoint {
  id: string
  trailId: string
  name: string
  type: string
  lat: number
  lng: number
  elevationM: number
  sequence: number
  description?: string | null
}

export interface Gate {
  id: string
  code: string
  name: string
  lat: number
  lng: number
  trailId?: string | null
  trail?: { name: string } | null
  isActive: boolean
}

export interface TicketType {
  id: string
  code: string
  name: string
  category: 'ENTRY' | 'CAMPING' | 'PARKING_MOTOR' | 'PARKING_CAR' | 'INSURANCE'
  price: number
  description?: string | null
  isActive: boolean
}

export interface RentalItem {
  id: string
  code: string
  name: string
  category: string
  pricePerDay: number
  stock: number
  description?: string | null
  isActive: boolean
}

export interface Guide {
  id: string
  name: string
  phone: string
  type: 'GUIDE' | 'PORTER'
  ratePerDay: number
  experienceYears: number
  rating: number
  bio?: string | null
  isAvailable: boolean
}

export type BookingStatus =
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'CHECKED_IN'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'EXPIRED'

export interface BookingItem {
  id: string
  refType: 'TICKET' | 'RENTAL' | 'GUIDE'
  name: string
  qty: number
  days: number
  unitPrice: number
  amount: number
}

export interface BookingMember {
  id: string
  name: string
  nik?: string | null
  phone?: string | null
  age?: number | null
  gender?: string | null
  emergencyName?: string | null
  emergencyPhone?: string | null
  isLeader: boolean
}

export interface Booking {
  id: string
  code: string
  status: BookingStatus
  startDate: string
  endDate: string
  totalPersons: number
  subtotal: number
  serviceFee: number
  total: number
  qrToken: string
  checkedInAt?: string | null
  checkedOutAt?: string | null
  createdAt: string
  notes?: string | null
  trail: { id?: string; name: string; slug?: string; difficulty?: string }
  user: { id?: string; name: string; phone: string; email?: string | null }
  items?: BookingItem[]
  members?: BookingMember[]
  payments?: Payment[]
  checkLogs?: CheckLog[]
  overdue?: boolean
  lastPing?: TrackPing | null
  _count?: { members: number }
}

export interface Payment {
  id: string
  method: string
  amount: number
  status: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED'
  reference: string
  vaNumber?: string | null
  qrisPayload?: string | null
  paidAt?: string | null
  createdAt: string
}

export interface CheckLog {
  id: string
  type: 'CHECK_IN' | 'CHECK_OUT'
  personCount: number
  at: string
  notes?: string | null
  gate: { name: string; code: string }
  officer?: { name: string }
  booking?: { code: string; totalPersons: number; trail: { name: string } }
}

export interface TrackPing {
  id: string
  lat: number
  lng: number
  elevationM?: number | null
  battery?: number | null
  at: string
}

export interface SosAlert {
  id: string
  code: string
  type: 'INJURY' | 'LOST' | 'MEDICAL' | 'WEATHER' | 'FIRE' | 'OTHER'
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESCUING' | 'RESOLVED' | 'FALSE_ALARM'
  lat: number
  lng: number
  elevationM?: number | null
  message?: string | null
  resolutionNote?: string | null
  createdAt: string
  resolvedAt?: string | null
  user: { id: string; name: string; phone: string; emergencyName?: string | null; emergencyPhone?: string | null }
  booking?: {
    code: string
    totalPersons: number
    startDate: string
    endDate: string
    trail: { name: string }
    members: { name: string; phone?: string | null; isLeader: boolean }[]
  } | null
  handler?: { id: string; name: string } | null
  track?: TrackPing[]
  notifications?: NotificationRow[]
}

export interface NotificationRow {
  id: string
  channel: string
  target: string
  subject: string | null
  status: 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED'
  error: string | null
  createdAt: string
}

export interface Content {
  id: string
  title: string
  slug: string
  category: 'NEWS' | 'WEATHER' | 'EVENT' | 'HISTORY' | 'REGULATION'
  excerpt?: string | null
  body: string
  imageUrl?: string | null
  isPublished: boolean
  publishedAt: string
}

export interface Summary {
  onMountain: number
  groupsOnMountain: number
  trails: { trailId: string; trailName: string; status: string; quota: number; groups: number; persons: number; utilization: number }[]
  todayBookings: number
  todayRevenue: number
  monthRevenue: number
  activeSos: number
  pendingPayment: number
  totalVisitors: number
  arrivalsToday: number
}
