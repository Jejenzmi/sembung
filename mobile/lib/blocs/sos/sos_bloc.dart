import 'dart:async';

import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';
import 'package:geolocator/geolocator.dart';

import '../../core/config.dart';
import '../../data/models.dart';
import '../../data/repositories.dart';

abstract class SosEvent extends Equatable {
  const SosEvent();
  @override
  List<Object?> get props => [];
}

class SosStarted extends SosEvent {
  const SosStarted();
}

class SosLocationRefreshed extends SosEvent {
  const SosLocationRefreshed();
}

class SosTriggered extends SosEvent {
  final String type;
  final String? message;
  const SosTriggered(this.type, this.message);
  @override
  List<Object?> get props => [type, message];
}

/// Sends the current position to the monitoring post ("bagikan lokasi").
class SosPinged extends SosEvent {
  const SosPinged();
}

/// Turns the periodic position reporting on or off.
class SosAutoTrackToggled extends SosEvent {
  final bool enabled;
  /// Jeda antar laporan lokasi. Semakin rapat, semakin boros baterai.
  final Duration? interval;
  const SosAutoTrackToggled(this.enabled, {this.interval});
  @override
  List<Object?> get props => [enabled, interval];
}

/// Retries anything that was queued while the phone had no signal.
class SosOutboxFlushed extends SosEvent {
  const SosOutboxFlushed();
}

enum SosStatus { idle, locating, sending, sent, failure }

class SosState extends Equatable {
  final SosStatus status;
  final double? lat;
  final double? lng;
  final double? accuracy;
  final int? elevationM;
  final bool locationDenied;
  final List<SosAlert> history;
  final SosAlert? lastAlert;
  final bool autoTrack;
  final Duration interval;
  final int queued;
  final String? error;
  final String? notice;

  const SosState({
    this.status = SosStatus.idle,
    this.lat,
    this.lng,
    this.accuracy,
    this.elevationM,
    this.locationDenied = false,
    this.history = const [],
    this.lastAlert,
    this.autoTrack = false,
    this.interval = SosBloc.trackInterval,
    this.queued = 0,
    this.error,
    this.notice,
  });

  bool get hasFix => lat != null && lng != null;

  SosState copyWith({
    SosStatus? status,
    double? lat,
    double? lng,
    double? accuracy,
    int? elevationM,
    bool? locationDenied,
    List<SosAlert>? history,
    SosAlert? lastAlert,
    bool? autoTrack,
    Duration? interval,
    int? queued,
    String? error,
    String? notice,
    bool clearMessages = false,
  }) =>
      SosState(
        status: status ?? this.status,
        lat: lat ?? this.lat,
        lng: lng ?? this.lng,
        accuracy: accuracy ?? this.accuracy,
        elevationM: elevationM ?? this.elevationM,
        locationDenied: locationDenied ?? this.locationDenied,
        history: history ?? this.history,
        lastAlert: lastAlert ?? this.lastAlert,
        autoTrack: autoTrack ?? this.autoTrack,
        interval: interval ?? this.interval,
        queued: queued ?? this.queued,
        error: clearMessages ? null : (error ?? this.error),
        notice: clearMessages ? null : (notice ?? this.notice),
      );

  @override
  List<Object?> get props => [
        status,
        lat,
        lng,
        accuracy,
        elevationM,
        locationDenied,
        history,
        lastAlert,
        autoTrack,
        interval,
        queued,
        error,
        notice,
      ];
}

class SosBloc extends Bloc<SosEvent, SosState> {
  SosBloc(this._repo) : super(const SosState()) {
    on<SosStarted>(_onStarted);
    on<SosLocationRefreshed>(_onLocation);
    on<SosTriggered>(_onTrigger);
    on<SosPinged>(_onPing);
    on<SosAutoTrackToggled>(_onAutoTrack);
    on<SosOutboxFlushed>(_onFlush);
  }

  final SosRepository _repo;
  Timer? _autoTimer;

  /// Pilihan jeda laporan lokasi. GPS adalah salah satu perangkat paling haus
  /// daya di ponsel, jadi jedanya dibuat bisa dipilih — bukan dipaksa rapat.
  /// 15 menit dipakai sebagai bawaan karena cukup bagi tim pencari untuk
  /// mempersempit area, sementara baterai tetap awet seharian pendakian.
  static const pilihanInterval = <(Duration, String)>[
    (Duration(minutes: 5), 'Tiap 5 menit · paling boros'),
    (Duration(minutes: 15), 'Tiap 15 menit · seimbang'),
    (Duration(minutes: 30), 'Tiap 30 menit · paling hemat'),
  ];

  static const trackInterval = Duration(minutes: 15);

  @override
  Future<void> close() {
    _autoTimer?.cancel();
    return super.close();
  }

  Future<void> _onStarted(SosStarted event, Emitter<SosState> emit) async {
    add(const SosLocationRefreshed());
    add(const SosOutboxFlushed());
    try {
      emit(state.copyWith(history: await _repo.mine(), queued: _repo.pendingCount));
    } catch (_) {
      // History is a nicety; a failure here must never block the panic button.
      emit(state.copyWith(queued: _repo.pendingCount));
    }
  }

  Future<void> _onFlush(SosOutboxFlushed event, Emitter<SosState> emit) async {
    final sent = await _repo.flushOutbox();
    emit(state.copyWith(
      queued: _repo.pendingCount,
      notice: sent > 0 ? '$sent laporan tertunda berhasil dikirim' : null,
    ));
  }

  void _onAutoTrack(SosAutoTrackToggled event, Emitter<SosState> emit) {
    _autoTimer?.cancel();
    final jeda = event.interval ?? state.interval;

    if (event.enabled) {
      _autoTimer = Timer.periodic(jeda, (_) {
        add(const SosLocationRefreshed());
        add(const SosPinged());
      });
      add(const SosPinged());
    }
    emit(state.copyWith(
      autoTrack: event.enabled,
      interval: jeda,
      notice: event.enabled
          ? 'Berbagi lokasi aktif — dilaporkan tiap ${jeda.inMinutes} menit'
          : 'Berbagi lokasi otomatis dimatikan',
    ));
  }

  Future<void> _onLocation(
      SosLocationRefreshed event, Emitter<SosState> emit) async {
    emit(state.copyWith(status: SosStatus.locating, clearMessages: true));
    try {
      if (!await Geolocator.isLocationServiceEnabled()) {
        emit(state.copyWith(
          status: SosStatus.idle,
          locationDenied: true,
          error: 'Layanan lokasi perangkat tidak aktif',
        ));
        return;
      }
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        emit(state.copyWith(
          status: SosStatus.idle,
          locationDenied: true,
          error: 'Izin lokasi ditolak. SOS tetap dapat dikirim dengan titik basecamp.',
        ));
        return;
      }

      final pos = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 15),
      );
      emit(state.copyWith(
        status: SosStatus.idle,
        lat: pos.latitude,
        lng: pos.longitude,
        accuracy: pos.accuracy,
        elevationM: pos.altitude.round(),
        locationDenied: false,
        clearMessages: true,
      ));
    } catch (e) {
      emit(state.copyWith(
        status: SosStatus.idle,
        error: 'Gagal membaca GPS: sinyal lemah atau tertutup kanopi',
      ));
    }
  }

  Future<void> _onTrigger(SosTriggered event, Emitter<SosState> emit) async {
    emit(state.copyWith(status: SosStatus.sending, clearMessages: true));
    // Falling back to the basecamp coordinate is better than sending nothing:
    // the post at least learns someone on this account needs help.
    final lat = state.lat ?? kBasecampLat;
    final lng = state.lng ?? kBasecampLng;
    try {
      final alert = await _repo.trigger(
        lat: lat,
        lng: lng,
        type: event.type,
        elevationM: state.elevationM,
        accuracy: state.accuracy,
        message: event.message,
      );

      if (alert == null) {
        // Queued offline — say so honestly instead of implying help is coming.
        emit(state.copyWith(
          status: SosStatus.sent,
          queued: _repo.pendingCount,
          notice:
              'Tidak ada sinyal. Permintaan darurat disimpan dan dikirim otomatis '
              'begitu jaringan kembali. Cari titik terbuka bila memungkinkan.',
        ));
        return;
      }

      final history = await _repo.mine();
      emit(state.copyWith(
        status: SosStatus.sent,
        lastAlert: alert,
        history: history,
        queued: _repo.pendingCount,
        notice: 'Sinyal darurat terkirim ke pos pemantau',
      ));
    } catch (e) {
      emit(state.copyWith(status: SosStatus.failure, error: e.toString()));
    }
  }

  Future<void> _onPing(SosPinged event, Emitter<SosState> emit) async {
    if (!state.hasFix) {
      add(const SosLocationRefreshed());
      return;
    }
    final delivered = await _repo.ping(
      lat: state.lat!,
      lng: state.lng!,
      elevationM: state.elevationM,
      accuracy: state.accuracy,
    );
    emit(state.copyWith(
      queued: _repo.pendingCount,
      notice: delivered
          ? 'Lokasi dibagikan ke pos pemantau'
          : 'Lokasi disimpan, menunggu jaringan',
    ));
  }
}
