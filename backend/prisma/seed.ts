import 'dotenv/config';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import {
  ContentCategory,
  Difficulty,
  GuideType,
  PointType,
  PrismaClient,
  Role,
  TicketCategory,
  TrailStatus,
} from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Gunung Sembung sits in the Sanggabuana range, Purwakarta/Karawang border.
 * Coordinates below trace the classic Pasanggrahan approach.
 */
const SEMBUNG_TRACK: [string, PointType, number, number, number, number, string][] = [
  ['Basecamp Pasanggrahan', PointType.BASECAMP, -6.5312, 107.3585, 420, 0, 'Registrasi, parkir, warung, dan mushola. Titik awal seluruh pendakian.'],
  ['Gerbang Rimba', PointType.JUNCTION, -6.5334, 107.3612, 512, 1, 'Batas kebun warga dan hutan sekunder. Sinyal seluler mulai lemah.'],
  ['Pos 1 - Curug Cikoleang', PointType.POST, -6.5361, 107.3648, 648, 2, 'Shelter bambu, dekat aliran curug kecil.'],
  ['Mata Air Cikoleang', PointType.WATER_SOURCE, -6.5365, 107.3653, 655, 3, 'Sumber air terakhir yang stabil sepanjang tahun. Isi penuh di sini.'],
  ['Pos 2 - Tanjakan Cinta', PointType.POST, -6.5398, 107.3689, 812, 4, 'Tanjakan menerus 30 menit, kemiringan ±40 derajat.'],
  ['Batu Kuda', PointType.PHOTO_SPOT, -6.5412, 107.3707, 890, 5, 'Formasi batu ikonik menghadap Waduk Jatiluhur. Terbaik saat golden hour.'],
  ['Pos 3 - Lawang Angin', PointType.POST, -6.5431, 107.3728, 968, 6, 'Angin kencang, banyak pendaki beristirahat sebelum camp.'],
  ['Camping Ground Alun-alun', PointType.CAMPING_GROUND, -6.5449, 107.3751, 1035, 7, 'Lahan datar ±40 tenda, ada MCK sederhana. Ranger berjaga di musim ramai.'],
  ['Tebing Sanggabuana', PointType.CLIFF, -6.5461, 107.3766, 1082, 8, 'Jalur menyempit di sisi jurang. Wajib hati-hati saat hujan dan berkabut.'],
  ['Sabana Sembung', PointType.PHOTO_SPOT, -6.5474, 107.3781, 1128, 9, 'Padang rumput terbuka menuju puncak, spot sunrise favorit.'],
  ['Puncak Sembung', PointType.SUMMIT, -6.5489, 107.3798, 1180, 10, 'Titik tertinggi. Panorama Purwakarta, Waduk Jatiluhur, dan Gunung Burangrang.'],
];

const SANGGABUANA_TRACK: [string, PointType, number, number, number, number, string][] = [
  ['Basecamp Cirende', PointType.BASECAMP, -6.5205, 107.3441, 385, 0, 'Basecamp alternatif via Desa Cirende, akses motor sampai titik ini.'],
  ['Pos 1 - Kebun Kopi', PointType.POST, -6.5241, 107.3489, 520, 1, 'Melewati kebun kopi rakyat, jalur landai.'],
  ['Sumber Air Cirende', PointType.WATER_SOURCE, -6.5258, 107.3512, 574, 2, 'Debit menurun drastis di musim kemarau (Juli–September).'],
  ['Pos 2 - Punggungan', PointType.POST, -6.5296, 107.3567, 726, 3, 'Punggungan sempit, tidak disarankan mendirikan tenda.'],
  ['Shelter Nagawiru', PointType.SHELTER, -6.5331, 107.3618, 845, 4, 'Shelter darurat beratap seng untuk 6 orang.'],
  ['Jalur Longsor 2024', PointType.DANGER, -6.5362, 107.3661, 902, 5, 'Bekas longsor, ikuti tali pengaman yang dipasang ranger.'],
  ['Simpang Alun-alun', PointType.JUNCTION, -6.5443, 107.3744, 1020, 6, 'Bertemu jalur Pasanggrahan menuju camping ground.'],
  ['Puncak Sembung', PointType.SUMMIT, -6.5489, 107.3798, 1180, 7, 'Puncak bersama dengan jalur Pasanggrahan.'],
];

async function main() {
  console.log('🌱 Seeding Sembung Explorer...');

  // Wipe in FK-safe order so the seed is idempotent.
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.refund.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.trackPing.deleteMany(),
    prisma.sosAlert.deleteMany(),
    prisma.checkLog.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.bookingItem.deleteMany(),
    prisma.bookingMember.deleteMany(),
    prisma.review.deleteMany(),
    prisma.booking.deleteMany(),
    prisma.gate.deleteMany(),
    prisma.trailPoint.deleteMany(),
    prisma.trail.deleteMany(),
    prisma.guide.deleteMany(),
    prisma.rentalItem.deleteMany(),
    prisma.ticketType.deleteMany(),
    prisma.content.deleteMany(),
    prisma.user.deleteMany(),
    prisma.setting.deleteMany(),
  ]);

  const hash = (pw: string) => bcrypt.hashSync(pw, 10);

  // Sandi staf TIDAK boleh punya nilai bawaan yang bisa ditebak: begitu instans
  // ini terbuka di internet, 'admin123' setara tanpa sandi. Ambil dari env bila
  // disediakan, kalau tidak buatkan acak lalu cetak sekali di log.
  const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const acak = (len = 16) =>
    Array.from(crypto.randomFillSync(new Uint32Array(len)))
      .map((n) => ALPHABET[n % ALPHABET.length])
      .join('');

  const kredensial: [string, string][] = [];
  const sandiStaf = (envKey: string) => {
    const pw = process.env[envKey] || acak();
    kredensial.push([envKey, pw]);
    return pw;
  };

  const [admin, officer, ranger, visitor, visitor2] = await Promise.all([
    prisma.user.create({
      data: {
        name: 'Administrator Pengelola',
        username: 'admin',
        email: 'admin@sembung.id',
        phone: '081200000001',
        passwordHash: hash(sandiStaf('SEED_ADMIN_PASSWORD')),
        role: Role.ADMIN,
      },
    }),
    prisma.user.create({
      data: {
        name: 'Petugas Pos Gerbang',
        username: 'petugas',
        email: 'petugas@sembung.id',
        phone: '081200000002',
        passwordHash: hash(sandiStaf('SEED_OFFICER_PASSWORD')),
        role: Role.OFFICER,
      },
    }),
    prisma.user.create({
      data: {
        name: 'Jagawana Sanggabuana',
        username: 'ranger',
        email: 'ranger@sembung.id',
        phone: '081200000003',
        passwordHash: hash(sandiStaf('SEED_RANGER_PASSWORD')),
        role: Role.RANGER,
      },
    }),
    prisma.user.create({
      data: {
        name: 'Rizky Pendaki',
        email: 'demo@sembung.id',
        phone: '081200000010',
        passwordHash: hash(sandiStaf('SEED_VISITOR_PASSWORD')),
        role: Role.VISITOR,
        nik: '3214010101990001',
        address: 'Purwakarta, Jawa Barat',
        emergencyName: 'Siti Nurhaliza',
        emergencyPhone: '081200000011',
      },
    }),
    prisma.user.create({
      data: {
        name: 'Dewi Anggraeni',
        email: 'dewi@sembung.id',
        phone: '081200000012',
        passwordHash: hash(sandiStaf('SEED_VISITOR_PASSWORD')),
        role: Role.VISITOR,
        emergencyName: 'Bapak Anwar',
        emergencyPhone: '081200000013',
      },
    }),
  ]);

  const pasanggrahan = await prisma.trail.create({
    data: {
      code: 'TRL-PSG',
      name: 'Jalur Pasanggrahan',
      slug: 'pasanggrahan',
      difficulty: Difficulty.MODERATE,
      status: TrailStatus.OPEN,
      distanceKm: 6.4,
      elevationGainM: 760,
      summitElevM: 1180,
      estimatedHours: 4.5,
      dailyQuota: 150,
      description:
        'Jalur utama dan terpopuler menuju Puncak Sembung. Vegetasi rapat di paruh awal, ' +
        'terbuka menjelang sabana. Cocok untuk pendaki pemula yang sudah terbiasa trekking.',
      imageUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200',
      points: {
        createMany: {
          data: SEMBUNG_TRACK.map(([name, type, lat, lng, elevationM, sequence, description]) => ({
            name,
            type,
            lat,
            lng,
            elevationM,
            sequence,
            description,
          })),
        },
      },
    },
  });

  const cirende = await prisma.trail.create({
    data: {
      code: 'TRL-CRD',
      name: 'Jalur Cirende',
      slug: 'cirende',
      difficulty: Difficulty.HARD,
      status: TrailStatus.LIMITED,
      distanceKm: 7.8,
      elevationGainM: 845,
      summitElevM: 1180,
      estimatedHours: 6,
      dailyQuota: 60,
      description:
        'Jalur punggungan yang lebih menantang dengan satu titik bekas longsor. ' +
        'Dibuka terbatas dan wajib didampingi guide lokal.',
      imageUrl: 'https://images.unsplash.com/photo-1454391304352-2bf4678b1a7a?w=1200',
      points: {
        createMany: {
          data: SANGGABUANA_TRACK.map(([name, type, lat, lng, elevationM, sequence, description]) => ({
            name,
            type,
            lat,
            lng,
            elevationM,
            sequence,
            description,
          })),
        },
      },
    },
  });

  const [gateUtama] = await Promise.all([
    prisma.gate.create({
      data: {
        code: 'GT-01',
        name: 'Pos Gerbang Utama Pasanggrahan',
        lat: -6.5312,
        lng: 107.3585,
        trailId: pasanggrahan.id,
      },
    }),
    prisma.gate.create({
      data: {
        code: 'GT-02',
        name: 'Pos Gerbang Cirende',
        lat: -6.5205,
        lng: 107.3441,
        trailId: cirende.id,
      },
    }),
  ]);

  const tickets = await Promise.all(
    [
      ['TKT-MASUK', 'Tiket Masuk Kawasan', TicketCategory.ENTRY, 15000, 'Retribusi masuk kawasan wisata per orang.'],
      ['TKT-CAMP', 'Izin Berkemah (per malam)', TicketCategory.CAMPING, 20000, 'Izin mendirikan tenda di camping ground resmi.'],
      ['TKT-PRK-M', 'Parkir Motor', TicketCategory.PARKING_MOTOR, 5000, 'Parkir menginap di basecamp.'],
      ['TKT-PRK-C', 'Parkir Mobil', TicketCategory.PARKING_CAR, 15000, 'Parkir menginap di basecamp.'],
      ['TKT-ASR', 'Asuransi Pendakian', TicketCategory.INSURANCE, 7500, 'Perlindungan kecelakaan selama pendakian.'],
    ].map(([code, name, category, price, description]) =>
      prisma.ticketType.create({
        data: {
          code: code as string,
          name: name as string,
          category: category as TicketCategory,
          price: price as number,
          description: description as string,
        },
      })
    )
  );

  const rentals = await Promise.all(
    [
      ['RNT-TND4', 'Tenda Kapasitas 4', 'Tenda', 75000, 12, 'Tenda dome double layer lengkap flysheet.'],
      ['RNT-TND2', 'Tenda Kapasitas 2', 'Tenda', 50000, 18, 'Tenda ringan untuk duo pendaki.'],
      ['RNT-SB', 'Sleeping Bag', 'Perlengkapan Tidur', 20000, 40, 'Sleeping bag polar, nyaman hingga 12°C.'],
      ['RNT-MAT', 'Matras Gulung', 'Perlengkapan Tidur', 10000, 50, 'Matras eva foam anti lembab.'],
      ['RNT-CRR', 'Carrier 60L', 'Tas', 45000, 20, 'Carrier 60 liter dengan rain cover.'],
      ['RNT-KMP', 'Kompor Portable + Nesting', 'Masak', 30000, 15, 'Paket kompor gas kaleng dan nesting.'],
      ['RNT-HDL', 'Headlamp', 'Penerangan', 12000, 35, 'Headlamp LED 3 mode, baterai disertakan.'],
      ['RNT-TRK', 'Trekking Pole', 'Pendukung', 15000, 25, 'Sepasang trekking pole aluminium.'],
    ].map(([code, name, category, pricePerDay, stock, description]) =>
      prisma.rentalItem.create({
        data: {
          code: code as string,
          name: name as string,
          category: category as string,
          pricePerDay: pricePerDay as number,
          stock: stock as number,
          description: description as string,
        },
      })
    )
  );

  const guides = await Promise.all(
    [
      ['Asep Mulyana', '081311110001', GuideType.GUIDE, 250000, 9, 4.9, 'Guide senior Sanggabuana, hafal seluruh jalur dan sumber air.'],
      ['Yayan Sopyan', '081311110002', GuideType.GUIDE, 220000, 6, 4.7, 'Spesialis jalur Cirende dan navigasi malam hari.'],
      ['Dadang Kurnia', '081311110003', GuideType.PORTER, 150000, 4, 4.8, 'Porter berpengalaman, kuat membawa beban 25 kg.'],
      ['Iwan Setiawan', '081311110004', GuideType.PORTER, 140000, 3, 4.6, 'Porter sekaligus juru masak lapangan.'],
    ].map(([name, phone, type, ratePerDay, experienceYears, rating, bio]) =>
      prisma.guide.create({
        data: {
          name: name as string,
          phone: phone as string,
          type: type as GuideType,
          ratePerDay: ratePerDay as number,
          experienceYears: experienceYears as number,
          rating: rating as number,
          bio: bio as string,
        },
      })
    )
  );

  await prisma.content.createMany({
    data: [
      {
        title: 'Sejarah Gunung Sembung dan Pegunungan Sanggabuana',
        slug: 'sejarah-gunung-sembung',
        category: ContentCategory.HISTORY,
        excerpt: 'Jejak Kerajaan Sunda, mitos Nagawiru, dan peran Sanggabuana sebagai benteng ekologi Purwakarta.',
        body:
          'Gunung Sembung merupakan bagian dari gugusan Pegunungan Sanggabuana yang membentang di perbatasan ' +
          'Purwakarta dan Karawang. Kawasan ini secara tradisional dipandang masyarakat Sunda sebagai wilayah ' +
          '"leuweung tutupan" — hutan larangan yang dijaga adat.\n\n' +
          'Nama Sembung diyakini berasal dari tanaman sembung (Blumea balsamifera) yang tumbuh melimpah di lereng ' +
          'bawahnya dan dipakai warga sebagai obat tradisional. Cerita rakyat setempat mengaitkan tebing di sisi ' +
          'timur puncak dengan legenda Nagawiru, penjaga mata air yang menghidupi desa-desa di kaki gunung.\n\n' +
          'Hari ini Sanggabuana berperan sebagai penyangga hidrologi bagi Waduk Jatiluhur dan menjadi rumah bagi ' +
          'elang jawa serta owa jawa. Pendakian yang tertib dan berkuota adalah bagian dari upaya menjaga fungsi itu.',
        imageUrl: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1200',
      },
      {
        title: 'Tata Tertib dan Barang Wajib Pendakian',
        slug: 'tata-tertib-pendakian',
        category: ContentCategory.REGULATION,
        excerpt: 'Sepuluh aturan wajib, daftar barang minimum, dan sanksi bagi pelanggar.',
        body:
          '1. Seluruh pendaki wajib memiliki E-Pass aktif dan melapor di pos gerbang.\n' +
          '2. Sampah wajib dibawa turun; petugas melakukan penimbangan sampah saat check-out.\n' +
          '3. Dilarang menyalakan api unggun di luar area yang ditentukan.\n' +
          '4. Berkemah hanya di Camping Ground Alun-alun.\n' +
          '5. Minimal 3 orang per rombongan; solo hiking harus seizin pengelola.\n' +
          '6. Barang wajib: jaket/windbreaker, jas hujan, headlamp, air minum 3 liter/orang, P3K.\n' +
          '7. Aktifkan berbagi lokasi di aplikasi selama berada di jalur.\n' +
          '8. Dilarang memetik tanaman, mengganggu satwa, atau membuat coretan pada batu dan pohon.\n' +
          '9. Batas naik terakhir pukul 16.00 WIB.\n' +
          '10. Pelanggaran berat berakibat blokir akun selama satu musim pendakian.',
        imageUrl: 'https://images.unsplash.com/photo-1533240332313-0db49b459ad6?w=1200',
      },
      {
        title: 'Prakiraan Cuaca Kawasan Sembung Pekan Ini',
        slug: 'cuaca-pekan-ini',
        category: ContentCategory.WEATHER,
        excerpt: 'Hujan lokal sore hari, kabut tebal di atas 900 mdpl menjelang subuh.',
        body:
          'Pengelola memantau potensi hujan lokal pada rentang pukul 14.00–18.00 WIB sepanjang pekan ini. ' +
          'Kabut tebal diperkirakan turun di atas ketinggian 900 mdpl mulai pukul 03.00 WIB, sehingga jarak ' +
          'pandang di Tebing Sanggabuana dapat kurang dari 10 meter.\n\n' +
          'Rekomendasi: mulai summit attack setelah pukul 04.30 WIB, gunakan lapisan pakaian yang cepat kering, ' +
          'dan pastikan flysheet terpasang sebelum sore.',
        imageUrl: 'https://images.unsplash.com/photo-1418065460487-3e41a6c84dc5?w=1200',
      },
      {
        title: 'Festival Sanggabuana Lestari 2026',
        slug: 'festival-sanggabuana-2026',
        category: ContentCategory.EVENT,
        excerpt: 'Gerakan bersih gunung, penanaman 2.000 bibit, dan panggung budaya di basecamp.',
        body:
          'Pengelola bersama komunitas pendaki Purwakarta menggelar Festival Sanggabuana Lestari pada akhir ' +
          'Agustus 2026. Rangkaian acara meliputi gerakan bersih gunung serentak dua jalur, penanaman 2.000 ' +
          'bibit pohon endemik, lomba fotografi alam, serta panggung seni Sunda di area basecamp.\n\n' +
          'Peserta yang mendaftar melalui aplikasi memperoleh potongan retribusi masuk dan kaos kegiatan.',
        imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200',
      },
    ],
  });

  await prisma.setting.createMany({
    data: [
      { key: 'SERVICE_FEE', value: '5000' },
      { key: 'BOOKING_HOLD_MINUTES', value: '120' },
      { key: 'OVERDUE_GRACE_HOURS', value: '12' },
      { key: 'PARK_NAME', value: 'Kawasan Wisata Gunung Sembung' },
      { key: 'PARK_PHONE', value: '0264-000111' },
      { key: 'SAR_PHONE', value: '115' },
      { key: 'LAST_ASCENT_HOUR', value: '16' },
    ],
  });

  /* ------------------------- sample operational data ------------------------ */

  const today = new Date();
  const day = (offset: number) => {
    const d = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    d.setUTCDate(d.getUTCDate() + offset);
    return d;
  };

  const entry = tickets.find((t) => t.code === 'TKT-MASUK')!;
  const camp = tickets.find((t) => t.code === 'TKT-CAMP')!;
  const insurance = tickets.find((t) => t.code === 'TKT-ASR')!;
  const tent = rentals.find((r) => r.code === 'RNT-TND4')!;

  // Group currently on the mountain, so the dashboard is not empty on first run.
  const onMountain = await prisma.booking.create({
    data: {
      code: 'BK-SEED-0001',
      userId: visitor.id,
      trailId: pasanggrahan.id,
      startDate: day(0),
      endDate: day(1),
      totalPersons: 4,
      status: 'CHECKED_IN',
      checkedInAt: new Date(Date.now() - 5 * 3600_000),
      subtotal: 235000,
      serviceFee: 5000,
      total: 240000,
      qrToken: 'SEED-EPASS-ONMOUNTAIN-0001',
      items: {
        createMany: {
          data: [
            { refType: 'TICKET', refId: entry.id, name: entry.name, qty: 4, days: 1, unitPrice: entry.price, amount: 60000 },
            { refType: 'TICKET', refId: camp.id, name: camp.name, qty: 4, days: 2, unitPrice: camp.price, amount: 160000 },
            { refType: 'TICKET', refId: insurance.id, name: insurance.name, qty: 4, days: 1, unitPrice: insurance.price, amount: 30000 },
          ],
        },
      },
      members: {
        createMany: {
          data: [
            { name: 'Rizky Pendaki', phone: '081200000010', isLeader: true, age: 27, gender: 'L', emergencyName: 'Siti Nurhaliza', emergencyPhone: '081200000011' },
            { name: 'Bagas Prakoso', age: 25, gender: 'L' },
            { name: 'Nadia Ramadhani', age: 24, gender: 'P' },
            { name: 'Fajar Nugroho', age: 29, gender: 'L' },
          ],
        },
      },
      payments: {
        create: {
          method: 'QRIS',
          amount: 240000,
          status: 'PAID',
          reference: 'QRIS-SEED-0001',
          paidAt: new Date(Date.now() - 6 * 3600_000),
        },
      },
    },
  });

  await prisma.checkLog.create({
    data: {
      bookingId: onMountain.id,
      gateId: gateUtama.id,
      officerId: officer.id,
      type: 'CHECK_IN',
      personCount: 4,
      at: new Date(Date.now() - 5 * 3600_000),
    },
  });

  await prisma.trackPing.createMany({
    data: SEMBUNG_TRACK.slice(0, 7).map(([, , lat, lng, ele], i) => ({
      bookingId: onMountain.id,
      userId: visitor.id,
      lat,
      lng,
      elevationM: ele,
      battery: 92 - i * 4,
      at: new Date(Date.now() - (5 - i * 0.6) * 3600_000),
    })),
  });

  // Upcoming paid booking (E-Pass ready to scan at the gate).
  await prisma.booking.create({
    data: {
      code: 'BK-SEED-0002',
      userId: visitor2.id,
      trailId: pasanggrahan.id,
      startDate: day(2),
      endDate: day(3),
      totalPersons: 2,
      status: 'PAID',
      subtotal: 190000,
      serviceFee: 5000,
      total: 195000,
      qrToken: 'SEED-EPASS-UPCOMING-0002',
      items: {
        createMany: {
          data: [
            { refType: 'TICKET', refId: entry.id, name: entry.name, qty: 2, days: 1, unitPrice: entry.price, amount: 30000 },
            { refType: 'TICKET', refId: camp.id, name: camp.name, qty: 2, days: 2, unitPrice: camp.price, amount: 80000 },
            { refType: 'RENTAL', refId: tent.id, name: `Sewa ${tent.name}`, qty: 1, days: 2, unitPrice: tent.pricePerDay, amount: 150000 },
          ],
        },
      },
      members: {
        createMany: {
          data: [
            { name: 'Dewi Anggraeni', phone: '081200000012', isLeader: true, age: 26, gender: 'P' },
            { name: 'Larasati Putri', age: 23, gender: 'P' },
          ],
        },
      },
      payments: {
        create: {
          method: 'VA_BCA',
          amount: 195000,
          status: 'PAID',
          reference: 'VA_BCA-SEED-0002',
          vaNumber: '888101234567890',
          paidAt: new Date(Date.now() - 26 * 3600_000),
        },
      },
    },
  });

  // Completed trip in the past, so trend/report screens have history.
  const done = await prisma.booking.create({
    data: {
      code: 'BK-SEED-0003',
      userId: visitor.id,
      trailId: cirende.id,
      startDate: day(-14),
      endDate: day(-13),
      totalPersons: 3,
      status: 'COMPLETED',
      checkedInAt: new Date(Date.now() - 14 * 86_400_000),
      checkedOutAt: new Date(Date.now() - 13 * 86_400_000),
      subtotal: 545000,
      serviceFee: 5000,
      total: 550000,
      qrToken: 'SEED-EPASS-DONE-0003',
      items: {
        createMany: {
          data: [
            { refType: 'TICKET', refId: entry.id, name: entry.name, qty: 3, days: 1, unitPrice: entry.price, amount: 45000 },
            { refType: 'GUIDE', refId: guides[0].id, name: `Guide ${guides[0].name}`, qty: 1, days: 2, unitPrice: guides[0].ratePerDay, amount: 500000 },
          ],
        },
      },
      members: {
        createMany: {
          data: [
            { name: 'Rizky Pendaki', isLeader: true },
            { name: 'Bagas Prakoso' },
            { name: 'Nadia Ramadhani' },
          ],
        },
      },
      payments: {
        create: {
          method: 'QRIS',
          amount: 550000,
          status: 'PAID',
          reference: 'QRIS-SEED-0003',
          paidAt: new Date(Date.now() - 15 * 86_400_000),
        },
      },
    },
  });

  await prisma.review.create({
    data: {
      userId: visitor.id,
      trailId: cirende.id,
      rating: 5,
      comment: 'Jalur menantang tapi pemandangan sabana menjelang puncak sepadan. Guide Asep sangat membantu.',
    },
  });

  await prisma.sosAlert.create({
    data: {
      code: 'SOS-SEED-0001',
      userId: visitor.id,
      bookingId: done.id,
      type: 'INJURY',
      status: 'RESOLVED',
      lat: -6.5431,
      lng: 107.3728,
      elevationM: 968,
      message: 'Anggota rombongan terkilir di Pos 3, butuh bantuan evakuasi.',
      handlerId: ranger.id,
      acknowledgedAt: new Date(Date.now() - 13.8 * 86_400_000),
      resolvedAt: new Date(Date.now() - 13.6 * 86_400_000),
      resolutionNote: 'Tim ranger menjemput dan mengevakuasi ke basecamp. Korban sadar penuh.',
      createdAt: new Date(Date.now() - 13.9 * 86_400_000),
    },
  });

  console.log(`✅ Seed selesai.
   Trails      : ${await prisma.trail.count()} (titik: ${await prisma.trailPoint.count()})
   Tiket       : ${tickets.length}   Sewa: ${rentals.length}   Guide: ${guides.length}
   Booking     : ${await prisma.booking.count()}
   Akun        : lihat kredensial di bawah`);

  console.log('');
  console.log('=========== SANDI AWAL — SIMPAN, TIDAK DITAMPILKAN LAGI ===========');
  for (const [key, pw] of kredensial) {
    console.log('  ' + key.padEnd(24) + ' ' + pw);
  }
  console.log('  (setel variabel env di atas untuk menentukan sandi sendiri)');
  console.log('===================================================================');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
