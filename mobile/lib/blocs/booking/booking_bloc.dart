import 'dart:async';

import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';

import '../../core/formatters.dart';
import '../../data/models.dart';
import '../../data/repositories.dart';

/* --------------------------------- events --------------------------------- */

abstract class BookingEvent extends Equatable {
  const BookingEvent();
  @override
  List<Object?> get props => [];
}

/// Starts a fresh draft for one trail and loads the catalogue behind it.
class BookingDraftStarted extends BookingEvent {
  final Trail trail;
  final AppUser leader;
  const BookingDraftStarted(this.trail, this.leader);
  @override
  List<Object?> get props => [trail, leader];
}

class BookingDatesChanged extends BookingEvent {
  final DateTime start;
  final DateTime end;
  const BookingDatesChanged(this.start, this.end);
  @override
  List<Object?> get props => [start, end];
}

class BookingMemberAdded extends BookingEvent {
  final BookingMember member;
  const BookingMemberAdded(this.member);
  @override
  List<Object?> get props => [member];
}

class BookingMemberRemoved extends BookingEvent {
  final int index;
  const BookingMemberRemoved(this.index);
  @override
  List<Object?> get props => [index];
}

class BookingTicketChanged extends BookingEvent {
  final String ticketId;
  final int qty;
  const BookingTicketChanged(this.ticketId, this.qty);
  @override
  List<Object?> get props => [ticketId, qty];
}

class BookingRentalChanged extends BookingEvent {
  final String rentalId;
  final int qty;
  const BookingRentalChanged(this.rentalId, this.qty);
  @override
  List<Object?> get props => [rentalId, qty];
}

class BookingGuideToggled extends BookingEvent {
  final String guideId;
  const BookingGuideToggled(this.guideId);
  @override
  List<Object?> get props => [guideId];
}

class BookingQuoteRequested extends BookingEvent {
  const BookingQuoteRequested();
}

class BookingSubmitted extends BookingEvent {
  const BookingSubmitted();
}

class BookingPaymentRequested extends BookingEvent {
  final String method;
  const BookingPaymentRequested(this.method);
  @override
  List<Object?> get props => [method];
}

class BookingPaymentConfirmed extends BookingEvent {
  const BookingPaymentConfirmed();
}

class BookingErrorCleared extends BookingEvent {
  const BookingErrorCleared();
}

/// Kosongkan kode untuk melepas voucher yang sedang terpasang.
class BookingVoucherChanged extends BookingEvent {
  final String code;
  const BookingVoucherChanged(this.code);
  @override
  List<Object?> get props => [code];
}

/* --------------------------------- states --------------------------------- */

enum BookingStep { draft, created, awaitingPayment, paid }

class BookingState extends Equatable {
  final Trail? trail;
  final DateTime? start;
  final DateTime? end;
  final List<BookingMember> members;
  final Map<String, int> tickets;
  final Map<String, int> rentals;
  final Set<String> guides;

  final List<TicketType> ticketCatalog;
  final List<RentalItem> rentalCatalog;
  final List<Guide> guideCatalog;
  final List<QuotaDay> quota;

  final Quote? quoteResult;
  final Booking? booking;
  final Payment? payment;

  final String voucherCode;
  final BookingStep step;
  final bool loading;
  final bool busy;
  final String? error;

  const BookingState({
    this.trail,
    this.start,
    this.end,
    this.members = const [],
    this.tickets = const {},
    this.rentals = const {},
    this.guides = const {},
    this.ticketCatalog = const [],
    this.rentalCatalog = const [],
    this.guideCatalog = const [],
    this.quota = const [],
    this.quoteResult,
    this.booking,
    this.payment,
    this.voucherCode = '',
    this.step = BookingStep.draft,
    this.loading = false,
    this.busy = false,
    this.error,
  });

  int get days => (start == null || end == null)
      ? 1
      : end!.difference(start!).inDays + 1;

  int get persons => members.length;

  /// Remaining quota for the chosen start date, or null when unknown.
  int? get remainingQuota {
    if (start == null) return null;
    final key = isoDate(start!);
    for (final q in quota) {
      if (q.date == key) return q.remaining;
    }
    return null;
  }

  BookingState copyWith({
    Trail? trail,
    DateTime? start,
    DateTime? end,
    List<BookingMember>? members,
    Map<String, int>? tickets,
    Map<String, int>? rentals,
    Set<String>? guides,
    List<TicketType>? ticketCatalog,
    List<RentalItem>? rentalCatalog,
    List<Guide>? guideCatalog,
    List<QuotaDay>? quota,
    Quote? quoteResult,
    Booking? booking,
    Payment? payment,
    String? voucherCode,
    BookingStep? step,
    bool? loading,
    bool? busy,
    String? error,
    bool clearError = false,
    bool clearQuote = false,
  }) =>
      BookingState(
        trail: trail ?? this.trail,
        start: start ?? this.start,
        end: end ?? this.end,
        members: members ?? this.members,
        tickets: tickets ?? this.tickets,
        rentals: rentals ?? this.rentals,
        guides: guides ?? this.guides,
        ticketCatalog: ticketCatalog ?? this.ticketCatalog,
        rentalCatalog: rentalCatalog ?? this.rentalCatalog,
        guideCatalog: guideCatalog ?? this.guideCatalog,
        quota: quota ?? this.quota,
        quoteResult: clearQuote ? null : (quoteResult ?? this.quoteResult),
        booking: booking ?? this.booking,
        payment: payment ?? this.payment,
        voucherCode: voucherCode ?? this.voucherCode,
        step: step ?? this.step,
        loading: loading ?? this.loading,
        busy: busy ?? this.busy,
        error: clearError ? null : (error ?? this.error),
      );

  @override
  List<Object?> get props => [
        trail,
        start,
        end,
        members,
        tickets,
        rentals,
        guides,
        ticketCatalog,
        rentalCatalog,
        guideCatalog,
        quota,
        quoteResult,
        booking,
        payment,
        voucherCode,
        step,
        loading,
        busy,
        error,
      ];
}

/* ---------------------------------- bloc ---------------------------------- */

class BookingBloc extends Bloc<BookingEvent, BookingState> {
  BookingBloc(this._catalog, this._bookings) : super(const BookingState()) {
    on<BookingDraftStarted>(_onStart);
    on<BookingDatesChanged>(_onDates);
    on<BookingMemberAdded>(_onMemberAdded);
    on<BookingMemberRemoved>(_onMemberRemoved);
    on<BookingTicketChanged>(_onTicket);
    on<BookingRentalChanged>(_onRental);
    on<BookingGuideToggled>(_onGuide);
    on<BookingQuoteRequested>(_onQuote);
    on<BookingSubmitted>(_onSubmit);
    on<BookingPaymentRequested>(_onPay);
    on<BookingPaymentConfirmed>(_onConfirm);
    on<BookingErrorCleared>((_, emit) => emit(state.copyWith(clearError: true)));
    on<BookingVoucherChanged>(_onVoucher);
  }

  final CatalogRepository _catalog;
  final BookingRepository _bookings;

  Map<String, dynamic> _draftPayload() => {
        'trailId': state.trail!.id,
        'startDate': isoDate(state.start!),
        'endDate': isoDate(state.end!),
        'members': state.members.map((m) => m.toJson()).toList(),
        'tickets': state.tickets.entries
            .where((e) => e.value > 0)
            .map((e) => {'id': e.key, 'qty': e.value})
            .toList(),
        'rentals': state.rentals.entries
            .where((e) => e.value > 0)
            .map((e) => {'id': e.key, 'qty': e.value})
            .toList(),
        'guides': state.guides.map((id) => {'id': id, 'qty': 1}).toList(),
        if (state.voucherCode.isNotEmpty) 'voucherCode': state.voucherCode,
      };

  Future<void> _onStart(
      BookingDraftStarted event, Emitter<BookingState> emit) async {
    final tomorrow = DateTime.now().add(const Duration(days: 1));
    final start = DateTime(tomorrow.year, tomorrow.month, tomorrow.day);

    emit(BookingState(
      trail: event.trail,
      start: start,
      end: start.add(const Duration(days: 1)),
      members: [
        BookingMember(
          name: event.leader.name,
          nik: event.leader.nik,
          phone: event.leader.phone,
          emergencyName: event.leader.emergencyName,
          emergencyPhone: event.leader.emergencyPhone,
          isLeader: true,
        ),
      ],
      loading: true,
    ));

    try {
      final results = await Future.wait([
        _catalog.tickets(),
        _catalog.rentals(),
        _catalog.guides(),
        _catalog.quotaCalendar(event.trail.id, days: 45),
      ]);
      final tickets = results[0] as List<TicketType>;

      // Entry + insurance default to one per hiker; that's what the gate expects.
      final defaults = <String, int>{};
      for (final t in tickets) {
        if (t.category == 'ENTRY' || t.category == 'INSURANCE') {
          defaults[t.id] = 1;
        }
      }

      emit(state.copyWith(
        ticketCatalog: tickets,
        rentalCatalog: results[1] as List<RentalItem>,
        guideCatalog: results[2] as List<Guide>,
        quota: results[3] as List<QuotaDay>,
        tickets: defaults,
        loading: false,
      ));
      add(const BookingQuoteRequested());
    } catch (e) {
      emit(state.copyWith(loading: false, error: e.toString()));
    }
  }

  void _onDates(BookingDatesChanged event, Emitter<BookingState> emit) {
    emit(state.copyWith(start: event.start, end: event.end, clearQuote: true));
    add(const BookingQuoteRequested());
  }

  void _onMemberAdded(BookingMemberAdded event, Emitter<BookingState> emit) {
    final members = [...state.members, event.member];
    emit(state.copyWith(members: members, tickets: _scaleTickets(members.length)));
    add(const BookingQuoteRequested());
  }

  void _onMemberRemoved(
      BookingMemberRemoved event, Emitter<BookingState> emit) {
    if (state.members.length <= 1) return;
    final members = [...state.members]..removeAt(event.index);
    emit(state.copyWith(members: members, tickets: _scaleTickets(members.length)));
    add(const BookingQuoteRequested());
  }

  /// Per-person tickets track the party size automatically.
  Map<String, int> _scaleTickets(int persons) {
    final next = {...state.tickets};
    for (final t in state.ticketCatalog) {
      if (t.category == 'ENTRY' ||
          t.category == 'INSURANCE' ||
          t.category == 'CAMPING') {
        if ((next[t.id] ?? 0) > 0) next[t.id] = persons;
      }
    }
    return next;
  }

  void _onTicket(BookingTicketChanged event, Emitter<BookingState> emit) {
    final next = {...state.tickets};
    if (event.qty <= 0) {
      next.remove(event.ticketId);
    } else {
      next[event.ticketId] = event.qty;
    }
    emit(state.copyWith(tickets: next));
    add(const BookingQuoteRequested());
  }

  void _onRental(BookingRentalChanged event, Emitter<BookingState> emit) {
    final next = {...state.rentals};
    if (event.qty <= 0) {
      next.remove(event.rentalId);
    } else {
      next[event.rentalId] = event.qty;
    }
    emit(state.copyWith(rentals: next));
    add(const BookingQuoteRequested());
  }

  void _onGuide(BookingGuideToggled event, Emitter<BookingState> emit) {
    final next = {...state.guides};
    if (!next.remove(event.guideId)) next.add(event.guideId);
    emit(state.copyWith(guides: next));
    add(const BookingQuoteRequested());
  }

  void _onVoucher(BookingVoucherChanged event, Emitter<BookingState> emit) {
    emit(state.copyWith(voucherCode: event.code.trim().toUpperCase(), clearError: true));
    add(const BookingQuoteRequested());
  }

  Future<void> _onQuote(
      BookingQuoteRequested event, Emitter<BookingState> emit) async {
    if (state.trail == null || state.tickets.isEmpty) {
      emit(state.copyWith(clearQuote: true));
      return;
    }
    try {
      final quote = await _bookings.quote(_draftPayload());
      emit(state.copyWith(quoteResult: quote, clearError: true));
    } catch (e) {
      // Kutipan sebelumnya dipertahankan bila hanya vouchernya yang ditolak,
      // supaya pengguna tidak kehilangan rincian harga yang sudah benar.
      final voucherBermasalah = state.voucherCode.isNotEmpty;
      emit(state.copyWith(
        clearQuote: !voucherBermasalah,
        voucherCode: voucherBermasalah ? '' : null,
        error: e.toString(),
      ));
      if (voucherBermasalah) add(const BookingQuoteRequested());
    }
  }

  Future<void> _onSubmit(
      BookingSubmitted event, Emitter<BookingState> emit) async {
    emit(state.copyWith(busy: true, clearError: true));
    try {
      final booking = await _bookings.create(_draftPayload());
      emit(state.copyWith(
        booking: booking,
        step: BookingStep.created,
        busy: false,
      ));
    } catch (e) {
      emit(state.copyWith(busy: false, error: e.toString()));
    }
  }

  Future<void> _onPay(
      BookingPaymentRequested event, Emitter<BookingState> emit) async {
    if (state.booking == null) return;
    emit(state.copyWith(busy: true, clearError: true));
    try {
      final payment = await _bookings.pay(state.booking!.id, event.method);
      emit(state.copyWith(
        payment: payment,
        step: BookingStep.awaitingPayment,
        busy: false,
      ));
    } catch (e) {
      emit(state.copyWith(busy: false, error: e.toString()));
    }
  }

  Future<void> _onConfirm(
      BookingPaymentConfirmed event, Emitter<BookingState> emit) async {
    if (state.payment == null || state.booking == null) return;
    emit(state.copyWith(busy: true, clearError: true));
    try {
      await _bookings.confirmPayment(state.booking!.id);
      final refreshed = await _bookings.detail(state.booking!.id);
      emit(state.copyWith(
        booking: refreshed,
        step: BookingStep.paid,
        busy: false,
      ));
    } catch (e) {
      emit(state.copyWith(busy: false, error: e.toString()));
    }
  }
}
