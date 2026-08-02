import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';

import '../../data/models.dart';
import '../../data/repositories.dart';

abstract class MapEvent extends Equatable {
  const MapEvent();
  @override
  List<Object?> get props => [];
}

class MapBundleRequested extends MapEvent {
  final String slug;
  const MapBundleRequested(this.slug);
  @override
  List<Object?> get props => [slug];
}

/// Forces a re-download so the hiker can refresh the map before losing signal.
class MapBundleDownloaded extends MapEvent {
  final String slug;
  const MapBundleDownloaded(this.slug);
  @override
  List<Object?> get props => [slug];
}

enum MapStatus { loading, ready, failure }

class MapState extends Equatable {
  final MapStatus status;
  final OfflineBundle? bundle;
  final bool fromCache;
  final bool downloading;
  final String? error;
  final String? notice;

  const MapState({
    this.status = MapStatus.loading,
    this.bundle,
    this.fromCache = false,
    this.downloading = false,
    this.error,
    this.notice,
  });

  @override
  List<Object?> get props =>
      [status, bundle, fromCache, downloading, error, notice];
}

class MapBloc extends Bloc<MapEvent, MapState> {
  MapBloc(this._repo) : super(const MapState()) {
    on<MapBundleRequested>(_onRequested);
    on<MapBundleDownloaded>(_onDownload);
  }

  final CatalogRepository _repo;

  Future<void> _onRequested(
      MapBundleRequested event, Emitter<MapState> emit) async {
    final cached = _repo.cachedBundle(event.slug);
    if (cached != null) {
      emit(MapState(status: MapStatus.ready, bundle: cached, fromCache: true));
    } else {
      emit(const MapState(status: MapStatus.loading));
    }
    try {
      final fresh = await _repo.downloadBundle(event.slug);
      emit(MapState(status: MapStatus.ready, bundle: fresh));
    } catch (e) {
      if (cached == null) {
        emit(MapState(status: MapStatus.failure, error: e.toString()));
      } else {
        emit(MapState(
          status: MapStatus.ready,
          bundle: cached,
          fromCache: true,
          notice: 'Mode offline — menampilkan peta tersimpan',
        ));
      }
    }
  }

  Future<void> _onDownload(
      MapBundleDownloaded event, Emitter<MapState> emit) async {
    emit(MapState(status: MapStatus.ready, bundle: state.bundle, downloading: true));
    try {
      final fresh = await _repo.downloadBundle(event.slug);
      emit(MapState(
        status: MapStatus.ready,
        bundle: fresh,
        notice: 'Peta offline diperbarui — siap digunakan tanpa sinyal',
      ));
    } catch (e) {
      emit(MapState(
        status: MapStatus.ready,
        bundle: state.bundle,
        fromCache: true,
        error: e.toString(),
      ));
    }
  }
}
