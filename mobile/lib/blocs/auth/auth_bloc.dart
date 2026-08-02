import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';

import '../../core/api_client.dart';
import '../../data/models.dart';
import '../../data/repositories.dart';

/* --------------------------------- events --------------------------------- */

abstract class AuthEvent extends Equatable {
  const AuthEvent();
  @override
  List<Object?> get props => [];
}

/// Fired once at startup to decide between the login screen and the shell.
class AuthStarted extends AuthEvent {
  const AuthStarted();
}

class AuthLoginRequested extends AuthEvent {
  final String identifier;
  final String password;
  const AuthLoginRequested(this.identifier, this.password);
  @override
  List<Object?> get props => [identifier, password];
}

class AuthRegisterRequested extends AuthEvent {
  final String name;
  final String phone;
  final String password;
  final String? email;
  final String? nik;
  final String? emergencyName;
  final String? emergencyPhone;

  const AuthRegisterRequested({
    required this.name,
    required this.phone,
    required this.password,
    this.email,
    this.nik,
    this.emergencyName,
    this.emergencyPhone,
  });

  @override
  List<Object?> get props => [name, phone, password, email];
}

class AuthProfileUpdated extends AuthEvent {
  final Map<String, dynamic> payload;
  const AuthProfileUpdated(this.payload);
  @override
  List<Object?> get props => [payload];
}

class AuthLogoutRequested extends AuthEvent {
  const AuthLogoutRequested();
}

/* --------------------------------- states --------------------------------- */

enum AuthStatus { unknown, authenticated, unauthenticated }

class AuthState extends Equatable {
  final AuthStatus status;
  final AppUser? user;
  final bool busy;
  final String? error;

  const AuthState({
    this.status = AuthStatus.unknown,
    this.user,
    this.busy = false,
    this.error,
  });

  AuthState copyWith({
    AuthStatus? status,
    AppUser? user,
    bool? busy,
    String? error,
    bool clearError = false,
  }) =>
      AuthState(
        status: status ?? this.status,
        user: user ?? this.user,
        busy: busy ?? this.busy,
        error: clearError ? null : (error ?? this.error),
      );

  @override
  List<Object?> get props => [status, user, busy, error];
}

/* ---------------------------------- bloc ---------------------------------- */

class AuthBloc extends Bloc<AuthEvent, AuthState> {
  AuthBloc(this._repo) : super(const AuthState()) {
    on<AuthStarted>(_onStarted);
    on<AuthLoginRequested>(_onLogin);
    on<AuthRegisterRequested>(_onRegister);
    on<AuthProfileUpdated>(_onProfile);
    on<AuthLogoutRequested>(_onLogout);
  }

  final AuthRepository _repo;

  Future<void> _onStarted(AuthStarted event, Emitter<AuthState> emit) async {
    final cached = _repo.cachedUser;
    if (cached == null) {
      emit(const AuthState(status: AuthStatus.unauthenticated));
      return;
    }
    // Show the cached identity immediately, then verify the token silently so a
    // hiker with no signal still gets into the app.
    emit(AuthState(status: AuthStatus.authenticated, user: cached));
    try {
      final fresh = await _repo.me();
      emit(AuthState(status: AuthStatus.authenticated, user: fresh));
    } on ApiException catch (e) {
      if (e.status == 401) {
        await _repo.logout();
        emit(const AuthState(status: AuthStatus.unauthenticated));
      }
    }
  }

  Future<void> _onLogin(
      AuthLoginRequested event, Emitter<AuthState> emit) async {
    emit(state.copyWith(busy: true, clearError: true));
    try {
      final user = await _repo.login(event.identifier, event.password);
      emit(AuthState(status: AuthStatus.authenticated, user: user));
    } catch (e) {
      emit(state.copyWith(busy: false, error: e.toString()));
    }
  }

  Future<void> _onRegister(
      AuthRegisterRequested event, Emitter<AuthState> emit) async {
    emit(state.copyWith(busy: true, clearError: true));
    try {
      final user = await _repo.register(
        name: event.name,
        phone: event.phone,
        password: event.password,
        email: event.email,
        nik: event.nik,
        emergencyName: event.emergencyName,
        emergencyPhone: event.emergencyPhone,
      );
      emit(AuthState(status: AuthStatus.authenticated, user: user));
    } catch (e) {
      emit(state.copyWith(busy: false, error: e.toString()));
    }
  }

  Future<void> _onProfile(
      AuthProfileUpdated event, Emitter<AuthState> emit) async {
    emit(state.copyWith(busy: true, clearError: true));
    try {
      final user = await _repo.updateProfile(event.payload);
      emit(AuthState(status: AuthStatus.authenticated, user: user));
    } catch (e) {
      emit(state.copyWith(busy: false, error: e.toString()));
    }
  }

  Future<void> _onLogout(
      AuthLogoutRequested event, Emitter<AuthState> emit) async {
    await _repo.logout();
    emit(const AuthState(status: AuthStatus.unauthenticated));
  }
}
