import 'package:equatable/equatable.dart';

int _int(dynamic v) => v == null ? 0 : (v as num).toInt();
double _dbl(dynamic v) => v == null ? 0 : (v as num).toDouble();
DateTime _date(dynamic v) =>
    v == null ? DateTime.now() : DateTime.parse(v as String).toLocal();

class AppUser extends Equatable {
  final String id;
  final String name;
  final String phone;
  final String? email;
  final String role;
  final String? nik;
  final String? address;
  final String? emergencyName;
  final String? emergencyPhone;

  const AppUser({
    required this.id,
    required this.name,
    required this.phone,
    this.email,
    required this.role,
    this.nik,
    this.address,
    this.emergencyName,
    this.emergencyPhone,
  });

  factory AppUser.fromJson(Map<String, dynamic> j) => AppUser(
        id: j['id'] as String,
        name: j['name'] as String,
        phone: j['phone'] as String,
        email: j['email'] as String?,
        role: j['role'] as String,
        nik: j['nik'] as String?,
        address: j['address'] as String?,
        emergencyName: j['emergencyName'] as String?,
        emergencyPhone: j['emergencyPhone'] as String?,
      );

  @override
  List<Object?> get props => [id, name, phone, email, role];
}

class Trail extends Equatable {
  final String id;
  final String code;
  final String name;
  final String slug;
  final String difficulty;
  final String status;
  final double distanceKm;
  final int elevationGainM;
  final int summitElevM;
  final double estimatedHours;
  final int dailyQuota;
  final String? description;
  final String? imageUrl;
  final double rating;
  final int pointCount;
  final List<TrailPoint> points;

  const Trail({
    required this.id,
    required this.code,
    required this.name,
    required this.slug,
    required this.difficulty,
    required this.status,
    required this.distanceKm,
    required this.elevationGainM,
    required this.summitElevM,
    required this.estimatedHours,
    required this.dailyQuota,
    this.description,
    this.imageUrl,
    this.rating = 0,
    this.pointCount = 0,
    this.points = const [],
  });

  factory Trail.fromJson(Map<String, dynamic> j) => Trail(
        id: j['id'] as String,
        code: j['code'] as String,
        name: j['name'] as String,
        slug: j['slug'] as String,
        difficulty: j['difficulty'] as String,
        status: j['status'] as String,
        distanceKm: _dbl(j['distanceKm']),
        elevationGainM: _int(j['elevationGainM']),
        summitElevM: _int(j['summitElevM']),
        estimatedHours: _dbl(j['estimatedHours']),
        dailyQuota: _int(j['dailyQuota']),
        description: j['description'] as String?,
        imageUrl: j['imageUrl'] as String?,
        rating: _dbl(j['rating']),
        pointCount: _int((j['_count'] as Map?)?['points']) ,
        points: ((j['points'] as List?) ?? [])
            .map((e) => TrailPoint.fromJson(e as Map<String, dynamic>))
            .toList(),
      );

  String get difficultyLabel => switch (difficulty) {
        'EASY' => 'Mudah',
        'MODERATE' => 'Sedang',
        'HARD' => 'Sulit',
        _ => 'Ekstrem',
      };

  String get statusLabel => switch (status) {
        'OPEN' => 'Dibuka',
        'LIMITED' => 'Terbatas',
        _ => 'Ditutup',
      };

  @override
  List<Object?> get props => [id, name, status];
}

class TrailPoint extends Equatable {
  final String id;
  final String name;
  final String type;
  final double lat;
  final double lng;
  final int elevationM;
  final int sequence;
  final String? description;

  const TrailPoint({
    required this.id,
    required this.name,
    required this.type,
    required this.lat,
    required this.lng,
    required this.elevationM,
    required this.sequence,
    this.description,
  });

  factory TrailPoint.fromJson(Map<String, dynamic> j) => TrailPoint(
        id: j['id'] as String,
        name: j['name'] as String,
        type: j['type'] as String,
        lat: _dbl(j['lat']),
        lng: _dbl(j['lng']),
        elevationM: _int(j['elevationM']),
        sequence: _int(j['sequence']),
        description: j['description'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'type': type,
        'lat': lat,
        'lng': lng,
        'elevationM': elevationM,
        'sequence': sequence,
        'description': description,
      };

  String get icon => switch (type) {
        'BASECAMP' => '🏠',
        'POST' => '⛺',
        'WATER_SOURCE' => '💧',
        'CAMPING_GROUND' => '🏕️',
        'PHOTO_SPOT' => '📸',
        'SUMMIT' => '🏔️',
        'JUNCTION' => '🔀',
        'DANGER' => '⚠️',
        'SHELTER' => '🛖',
        'CLIFF' => '🧗',
        _ => '📍',
      };

  String get typeLabel => switch (type) {
        'BASECAMP' => 'Basecamp',
        'POST' => 'Pos Pendakian',
        'WATER_SOURCE' => 'Sumber Air',
        'CAMPING_GROUND' => 'Camping Ground',
        'PHOTO_SPOT' => 'Spot Foto',
        'SUMMIT' => 'Puncak',
        'JUNCTION' => 'Persimpangan',
        'DANGER' => 'Titik Bahaya',
        'SHELTER' => 'Shelter',
        'CLIFF' => 'Tebing',
        _ => type,
      };

  @override
  List<Object?> get props => [id];
}

/// Everything needed to render the trail map without a network connection.
class OfflineBundle extends Equatable {
  final String version;
  final String trailName;
  final List<TrailPoint> points;
  final List<List<double>> track;

  const OfflineBundle({
    required this.version,
    required this.trailName,
    required this.points,
    required this.track,
  });

  factory OfflineBundle.fromJson(Map<String, dynamic> j) => OfflineBundle(
        version: j['version'] as String,
        trailName: (j['trail'] as Map)['name'] as String,
        points: ((j['points'] as List?) ?? [])
            .map((e) => TrailPoint.fromJson(e as Map<String, dynamic>))
            .toList(),
        track: ((j['track'] as List?) ?? [])
            .map((e) => [
                  _dbl((e as Map)['lat']),
                  _dbl(e['lng']),
                ])
            .toList(),
      );

  Map<String, dynamic> toJson() => {
        'version': version,
        'trail': {'name': trailName},
        'points': points.map((p) => p.toJson()).toList(),
        'track': track.map((t) => {'lat': t[0], 'lng': t[1]}).toList(),
      };

  @override
  List<Object?> get props => [version, trailName];
}

class QuotaDay extends Equatable {
  final String date;
  final int quota;
  final int booked;
  final int remaining;

  const QuotaDay({
    required this.date,
    required this.quota,
    required this.booked,
    required this.remaining,
  });

  factory QuotaDay.fromJson(Map<String, dynamic> j) => QuotaDay(
        date: j['date'] as String,
        quota: _int(j['quota']),
        booked: _int(j['booked']),
        remaining: _int(j['remaining']),
      );

  @override
  List<Object?> get props => [date, remaining];
}

class TicketType extends Equatable {
  final String id;
  final String code;
  final String name;
  final String category;
  final int price;
  final String? description;

  const TicketType({
    required this.id,
    required this.code,
    required this.name,
    required this.category,
    required this.price,
    this.description,
  });

  factory TicketType.fromJson(Map<String, dynamic> j) => TicketType(
        id: j['id'] as String,
        code: j['code'] as String,
        name: j['name'] as String,
        category: j['category'] as String,
        price: _int(j['price']),
        description: j['description'] as String?,
      );

  bool get perNight => category == 'CAMPING';

  @override
  List<Object?> get props => [id];
}

class RentalItem extends Equatable {
  final String id;
  final String name;
  final String category;
  final int pricePerDay;
  final int stock;
  final String? description;

  const RentalItem({
    required this.id,
    required this.name,
    required this.category,
    required this.pricePerDay,
    required this.stock,
    this.description,
  });

  factory RentalItem.fromJson(Map<String, dynamic> j) => RentalItem(
        id: j['id'] as String,
        name: j['name'] as String,
        category: j['category'] as String,
        pricePerDay: _int(j['pricePerDay']),
        stock: _int(j['stock']),
        description: j['description'] as String?,
      );

  @override
  List<Object?> get props => [id, stock];
}

class Guide extends Equatable {
  final String id;
  final String name;
  final String phone;
  final String type;
  final int ratePerDay;
  final int experienceYears;
  final double rating;
  final String? bio;

  const Guide({
    required this.id,
    required this.name,
    required this.phone,
    required this.type,
    required this.ratePerDay,
    required this.experienceYears,
    required this.rating,
    this.bio,
  });

  factory Guide.fromJson(Map<String, dynamic> j) => Guide(
        id: j['id'] as String,
        name: j['name'] as String,
        phone: j['phone'] as String,
        type: j['type'] as String,
        ratePerDay: _int(j['ratePerDay']),
        experienceYears: _int(j['experienceYears']),
        rating: _dbl(j['rating']),
        bio: j['bio'] as String?,
      );

  String get typeLabel => type == 'PORTER' ? 'Porter' : 'Pemandu';

  @override
  List<Object?> get props => [id];
}

class BookingItem extends Equatable {
  final String id;
  final String refType;
  final String name;
  final int qty;
  final int days;
  final int unitPrice;
  final int amount;

  const BookingItem({
    required this.id,
    required this.refType,
    required this.name,
    required this.qty,
    required this.days,
    required this.unitPrice,
    required this.amount,
  });

  factory BookingItem.fromJson(Map<String, dynamic> j) => BookingItem(
        id: (j['id'] ?? '') as String,
        refType: j['refType'] as String,
        name: j['name'] as String,
        qty: _int(j['qty']),
        days: _int(j['days']),
        unitPrice: _int(j['unitPrice']),
        amount: _int(j['amount']),
      );

  @override
  List<Object?> get props => [id, name, amount];
}

class BookingMember extends Equatable {
  final String name;
  final String? nik;
  final String? phone;
  final int? age;
  final String? gender;
  final String? emergencyName;
  final String? emergencyPhone;
  final bool isLeader;

  const BookingMember({
    required this.name,
    this.nik,
    this.phone,
    this.age,
    this.gender,
    this.emergencyName,
    this.emergencyPhone,
    this.isLeader = false,
  });

  factory BookingMember.fromJson(Map<String, dynamic> j) => BookingMember(
        name: j['name'] as String,
        nik: j['nik'] as String?,
        phone: j['phone'] as String?,
        age: j['age'] == null ? null : _int(j['age']),
        gender: j['gender'] as String?,
        emergencyName: j['emergencyName'] as String?,
        emergencyPhone: j['emergencyPhone'] as String?,
        isLeader: (j['isLeader'] as bool?) ?? false,
      );

  Map<String, dynamic> toJson() => {
        'name': name,
        if (nik != null && nik!.isNotEmpty) 'nik': nik,
        if (phone != null && phone!.isNotEmpty) 'phone': phone,
        if (age != null) 'age': age,
        if (gender != null) 'gender': gender,
        if (emergencyName != null && emergencyName!.isNotEmpty)
          'emergencyName': emergencyName,
        if (emergencyPhone != null && emergencyPhone!.isNotEmpty)
          'emergencyPhone': emergencyPhone,
        'isLeader': isLeader,
      };

  BookingMember copyWith({
    String? name,
    String? nik,
    String? phone,
    int? age,
    String? gender,
    String? emergencyName,
    String? emergencyPhone,
    bool? isLeader,
  }) =>
      BookingMember(
        name: name ?? this.name,
        nik: nik ?? this.nik,
        phone: phone ?? this.phone,
        age: age ?? this.age,
        gender: gender ?? this.gender,
        emergencyName: emergencyName ?? this.emergencyName,
        emergencyPhone: emergencyPhone ?? this.emergencyPhone,
        isLeader: isLeader ?? this.isLeader,
      );

  @override
  List<Object?> get props => [name, nik, phone, age, isLeader];
}

class Payment extends Equatable {
  final String id;
  final String method;
  final int amount;
  final String status;
  final String reference;
  final String? vaNumber;
  final String? qrisPayload;
  final DateTime? expiresAt;

  const Payment({
    required this.id,
    required this.method,
    required this.amount,
    required this.status,
    required this.reference,
    this.vaNumber,
    this.qrisPayload,
    this.expiresAt,
  });

  factory Payment.fromJson(Map<String, dynamic> j) => Payment(
        id: j['id'] as String,
        method: j['method'] as String,
        amount: _int(j['amount']),
        status: j['status'] as String,
        reference: j['reference'] as String,
        vaNumber: j['vaNumber'] as String?,
        qrisPayload: j['qrisPayload'] as String?,
        expiresAt:
            j['expiresAt'] == null ? null : DateTime.parse(j['expiresAt'] as String).toLocal(),
      );

  @override
  List<Object?> get props => [id, status];
}

class Booking extends Equatable {
  final String id;
  final String code;
  final String status;
  final DateTime startDate;
  final DateTime endDate;
  final int totalPersons;
  final int subtotal;
  final int serviceFee;
  final int total;
  final String trailName;
  final String? trailImage;
  final List<BookingItem> items;
  final List<BookingMember> members;
  final List<Payment> payments;
  final DateTime createdAt;

  const Booking({
    required this.id,
    required this.code,
    required this.status,
    required this.startDate,
    required this.endDate,
    required this.totalPersons,
    required this.subtotal,
    required this.serviceFee,
    required this.total,
    required this.trailName,
    this.trailImage,
    this.items = const [],
    this.members = const [],
    this.payments = const [],
    required this.createdAt,
  });

  factory Booking.fromJson(Map<String, dynamic> j) {
    final trail = (j['trail'] as Map?) ?? const {};
    return Booking(
      id: j['id'] as String,
      code: j['code'] as String,
      status: j['status'] as String,
      startDate: _date(j['startDate']),
      endDate: _date(j['endDate']),
      totalPersons: _int(j['totalPersons']),
      subtotal: _int(j['subtotal']),
      serviceFee: _int(j['serviceFee']),
      total: _int(j['total']),
      trailName: (trail['name'] as String?) ?? '-',
      trailImage: trail['imageUrl'] as String?,
      items: ((j['items'] as List?) ?? [])
          .map((e) => BookingItem.fromJson(e as Map<String, dynamic>))
          .toList(),
      members: ((j['members'] as List?) ?? [])
          .map((e) => BookingMember.fromJson(e as Map<String, dynamic>))
          .toList(),
      payments: ((j['payments'] as List?) ?? [])
          .map((e) => Payment.fromJson(e as Map<String, dynamic>))
          .toList(),
      createdAt: _date(j['createdAt']),
    );
  }

  String get statusLabel => switch (status) {
        'PENDING_PAYMENT' => 'Menunggu Pembayaran',
        'PAID' => 'E-Pass Aktif',
        'CHECKED_IN' => 'Sedang Mendaki',
        'COMPLETED' => 'Selesai',
        'CANCELLED' => 'Dibatalkan',
        _ => 'Kedaluwarsa',
      };

  bool get isActive => status == 'PAID' || status == 'CHECKED_IN';

  @override
  List<Object?> get props => [id, status, total];
}

class EPass extends Equatable {
  final String code;
  final String qrToken;
  final String status;
  final String trail;
  final String leader;
  final int persons;
  final DateTime startDate;
  final DateTime endDate;
  final List<BookingItem> items;

  const EPass({
    required this.code,
    required this.qrToken,
    required this.status,
    required this.trail,
    required this.leader,
    required this.persons,
    required this.startDate,
    required this.endDate,
    required this.items,
  });

  factory EPass.fromJson(Map<String, dynamic> j) => EPass(
        code: j['code'] as String,
        qrToken: j['qrToken'] as String,
        status: j['status'] as String,
        trail: j['trail'] as String,
        leader: j['leader'] as String,
        persons: _int(j['persons']),
        startDate: _date(j['startDate']),
        endDate: _date(j['endDate']),
        items: ((j['items'] as List?) ?? [])
            .map((e) => BookingItem.fromJson(e as Map<String, dynamic>))
            .toList(),
      );

  @override
  List<Object?> get props => [code, qrToken, status];
}

class SosAlert extends Equatable {
  final String id;
  final String code;
  final String type;
  final String status;
  final double lat;
  final double lng;
  final String? message;
  final String? resolutionNote;
  final DateTime createdAt;

  const SosAlert({
    required this.id,
    required this.code,
    required this.type,
    required this.status,
    required this.lat,
    required this.lng,
    this.message,
    this.resolutionNote,
    required this.createdAt,
  });

  factory SosAlert.fromJson(Map<String, dynamic> j) => SosAlert(
        id: j['id'] as String,
        code: j['code'] as String,
        type: j['type'] as String,
        status: j['status'] as String,
        lat: _dbl(j['lat']),
        lng: _dbl(j['lng']),
        message: j['message'] as String?,
        resolutionNote: j['resolutionNote'] as String?,
        createdAt: _date(j['createdAt']),
      );

  String get typeLabel => switch (type) {
        'INJURY' => 'Cedera',
        'LOST' => 'Tersesat',
        'MEDICAL' => 'Darurat Medis',
        'WEATHER' => 'Cuaca Ekstrem',
        'FIRE' => 'Kebakaran',
        _ => 'Lainnya',
      };

  String get statusLabel => switch (status) {
        'OPEN' => 'Terkirim',
        'ACKNOWLEDGED' => 'Ditanggapi Pos',
        'RESCUING' => 'Tim Evakuasi Menuju Lokasi',
        'RESOLVED' => 'Selesai Ditangani',
        _ => 'Alarm Palsu',
      };

  bool get isActive =>
      status == 'OPEN' || status == 'ACKNOWLEDGED' || status == 'RESCUING';

  @override
  List<Object?> get props => [id, status];
}

class ContentItem extends Equatable {
  final String id;
  final String title;
  final String slug;
  final String category;
  final String? excerpt;
  final String body;
  final String? imageUrl;
  final DateTime publishedAt;

  const ContentItem({
    required this.id,
    required this.title,
    required this.slug,
    required this.category,
    this.excerpt,
    required this.body,
    this.imageUrl,
    required this.publishedAt,
  });

  factory ContentItem.fromJson(Map<String, dynamic> j) => ContentItem(
        id: j['id'] as String,
        title: j['title'] as String,
        slug: j['slug'] as String,
        category: j['category'] as String,
        excerpt: j['excerpt'] as String?,
        body: j['body'] as String,
        imageUrl: j['imageUrl'] as String?,
        publishedAt: _date(j['publishedAt']),
      );

  String get categoryLabel => switch (category) {
        'NEWS' => 'Berita',
        'WEATHER' => 'Cuaca',
        'EVENT' => 'Event',
        'HISTORY' => 'Sejarah',
        _ => 'Tata Tertib',
      };

  String get categoryIcon => switch (category) {
        'NEWS' => '📰',
        'WEATHER' => '🌦️',
        'EVENT' => '🎪',
        'HISTORY' => '📜',
        _ => '📋',
      };

  @override
  List<Object?> get props => [id];
}

class Capacity extends Equatable {
  final int totalPersons;
  final int totalGroups;
  final List<CapacityTrail> trails;

  const Capacity({
    required this.totalPersons,
    required this.totalGroups,
    required this.trails,
  });

  factory Capacity.fromJson(Map<String, dynamic> j) => Capacity(
        totalPersons: _int(j['totalPersons']),
        totalGroups: _int(j['totalGroups']),
        trails: ((j['trails'] as List?) ?? [])
            .map((e) => CapacityTrail.fromJson(e as Map<String, dynamic>))
            .toList(),
      );

  @override
  List<Object?> get props => [totalPersons, totalGroups];
}

class CapacityTrail extends Equatable {
  final String trailId;
  final String trailName;
  final int persons;
  final int quota;
  final int utilization;

  const CapacityTrail({
    required this.trailId,
    required this.trailName,
    required this.persons,
    required this.quota,
    required this.utilization,
  });

  factory CapacityTrail.fromJson(Map<String, dynamic> j) => CapacityTrail(
        trailId: j['trailId'] as String,
        trailName: j['trailName'] as String,
        persons: _int(j['persons']),
        quota: _int(j['quota']),
        utilization: _int(j['utilization']),
      );

  @override
  List<Object?> get props => [trailId, persons];
}

/// Server-computed price preview for a draft booking.
class Quote extends Equatable {
  final int days;
  final int persons;
  final List<BookingItem> items;
  final int subtotal;
  final int serviceFee;
  final int total;

  const Quote({
    required this.days,
    required this.persons,
    required this.items,
    required this.subtotal,
    required this.serviceFee,
    required this.total,
  });

  factory Quote.fromJson(Map<String, dynamic> j) => Quote(
        days: _int(j['days']),
        persons: _int(j['persons']),
        items: ((j['items'] as List?) ?? [])
            .map((e) => BookingItem.fromJson(e as Map<String, dynamic>))
            .toList(),
        subtotal: _int(j['subtotal']),
        serviceFee: _int(j['serviceFee']),
        total: _int(j['total']),
      );

  @override
  List<Object?> get props => [days, persons, total];
}
