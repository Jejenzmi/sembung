import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';

import '../../data/models.dart';
import '../../data/repositories.dart';

abstract class TripsEvent extends Equatable {
  const TripsEvent();
  @override
  List<Object?> get props => [];
}

class TripsRefreshed extends TripsEvent {
  const TripsRefreshed();
}

class TripCancelled extends TripsEvent {
  final String bookingId;
  const TripCancelled(this.bookingId);
  @override
  List<Object?> get props => [bookingId];
}

class TripReviewed extends TripsEvent {
  final String bookingId;
  final int rating;
  final String? comment;
  const TripReviewed(this.bookingId, this.rating, this.comment);
  @override
  List<Object?> get props => [bookingId, rating, comment];
}

enum TripsStatus { loading, ready, failure }

class TripsState extends Equatable {
  final TripsStatus status;
  final List<Booking> bookings;
  final String? error;
  final String? notice;

  const TripsState({
    this.status = TripsStatus.loading,
    this.bookings = const [],
    this.error,
    this.notice,
  });

  List<Booking> get upcoming =>
      bookings.where((b) => b.status == 'PENDING_PAYMENT' || b.isActive).toList();

  List<Booking> get history => bookings
      .where((b) => !(b.status == 'PENDING_PAYMENT' || b.isActive))
      .toList();

  @override
  List<Object?> get props => [status, bookings, error, notice];
}

class TripsBloc extends Bloc<TripsEvent, TripsState> {
  TripsBloc(this._repo) : super(const TripsState()) {
    on<TripsRefreshed>(_onRefresh);
    on<TripCancelled>(_onCancel);
    on<TripReviewed>(_onReview);
  }

  final BookingRepository _repo;

  Future<void> _onRefresh(TripsEvent event, Emitter<TripsState> emit) async {
    emit(TripsState(
      status: state.bookings.isEmpty ? TripsStatus.loading : TripsStatus.ready,
      bookings: state.bookings,
    ));
    try {
      emit(TripsState(status: TripsStatus.ready, bookings: await _repo.mine()));
    } catch (e) {
      emit(TripsState(
        status: state.bookings.isEmpty ? TripsStatus.failure : TripsStatus.ready,
        bookings: state.bookings,
        error: e.toString(),
      ));
    }
  }

  Future<void> _onCancel(TripCancelled event, Emitter<TripsState> emit) async {
    try {
      // Pesan dari server memuat kode refund bila bookingnya sudah lunas.
      final message = await _repo.cancel(event.bookingId);
      final list = await _repo.mine();
      emit(TripsState(
        status: TripsStatus.ready,
        bookings: list,
        notice: message,
      ));
    } catch (e) {
      emit(TripsState(
        status: TripsStatus.ready,
        bookings: state.bookings,
        error: e.toString(),
      ));
    }
  }

  Future<void> _onReview(TripReviewed event, Emitter<TripsState> emit) async {
    try {
      await _repo.review(event.bookingId, event.rating, event.comment);
      emit(TripsState(
        status: TripsStatus.ready,
        bookings: state.bookings,
        notice: 'Terima kasih atas ulasannya',
      ));
    } catch (e) {
      emit(TripsState(
        status: TripsStatus.ready,
        bookings: state.bookings,
        error: e.toString(),
      ));
    }
  }
}
