import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';

import '../../data/models.dart';
import '../../data/repositories.dart';

abstract class HomeEvent extends Equatable {
  const HomeEvent();
  @override
  List<Object?> get props => [];
}

class HomeRefreshed extends HomeEvent {
  /// Tamu belum punya booking; memanggil endpoint bersesi hanya akan 401.
  final bool sudahMasuk;
  const HomeRefreshed({this.sudahMasuk = false});
  @override
  List<Object?> get props => [sudahMasuk];
}

enum HomeStatus { loading, ready, failure }

class HomeState extends Equatable {
  final HomeStatus status;
  final List<Trail> trails;
  final List<ContentItem> contents;
  final Capacity? capacity;
  final List<Booking> activeBookings;
  final CuacaKawasan? cuaca;
  final String? error;

  const HomeState({
    this.status = HomeStatus.loading,
    this.trails = const [],
    this.contents = const [],
    this.capacity,
    this.activeBookings = const [],
    this.cuaca,
    this.error,
  });

  @override
  List<Object?> get props =>
      [status, trails, contents, capacity, activeBookings, cuaca, error];
}

class HomeBloc extends Bloc<HomeEvent, HomeState> {
  HomeBloc(this._catalog, this._bookings) : super(const HomeState()) {
    on<HomeRefreshed>(_onRefresh);
  }

  final CatalogRepository _catalog;
  final BookingRepository _bookings;

  Future<void> _onRefresh(HomeRefreshed event, Emitter<HomeState> emit) async {
    emit(HomeState(
      status: state.trails.isEmpty ? HomeStatus.loading : HomeStatus.ready,
      trails: state.trails,
      contents: state.contents,
      capacity: state.capacity,
      activeBookings: state.activeBookings,
      cuaca: state.cuaca,
    ));
    try {
      // One round trip per section, fired together to keep the pull-to-refresh
      // snappy on a weak signal.
      final results = await Future.wait([
        _catalog.trails(),
        _catalog.contents(),
        _catalog.capacity(),
        event.sudahMasuk
            ? _bookings.mine()
            : Future<List<Booking>>.value(const []),
        _catalog.cuaca(),
      ]);

      final all = results[3] as List<Booking>;
      emit(HomeState(
        status: HomeStatus.ready,
        trails: results[0] as List<Trail>,
        contents: results[1] as List<ContentItem>,
        capacity: results[2] as Capacity,
        cuaca: results[4] as CuacaKawasan?,
        activeBookings: all
            .where((b) =>
                b.status == 'PAID' ||
                b.status == 'CHECKED_IN' ||
                b.status == 'PENDING_PAYMENT')
            .toList(),
      ));
    } catch (e) {
      emit(HomeState(
        status: state.trails.isEmpty ? HomeStatus.failure : HomeStatus.ready,
        trails: state.trails,
        contents: state.contents,
        capacity: state.capacity,
        activeBookings: state.activeBookings,
        cuaca: state.cuaca,
        error: e.toString(),
      ));
    }
  }
}
