import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'blocs/auth/auth_bloc.dart';
import 'blocs/booking/booking_bloc.dart';
import 'blocs/home/home_bloc.dart';
import 'blocs/map/map_bloc.dart';
import 'blocs/sos/sos_bloc.dart';
import 'blocs/trips/trips_bloc.dart';
import 'core/api_client.dart';
import 'core/theme.dart';
import 'data/repositories.dart';
import 'ui/screens/login_screen.dart';
import 'ui/screens/shell_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('id_ID');
  final api = await ApiClient.create();
  runApp(SembungApp(api: api));
}

class SembungApp extends StatelessWidget {
  const SembungApp({super.key, required this.api});
  final ApiClient api;

  @override
  Widget build(BuildContext context) {
    final authRepo = AuthRepository(api);
    final catalogRepo = CatalogRepository(api);
    final bookingRepo = BookingRepository(api);
    final sosRepo = SosRepository(api);
    final inboxRepo = InboxRepository(api);

    return MultiRepositoryProvider(
      providers: [
        RepositoryProvider.value(value: api),
        RepositoryProvider.value(value: authRepo),
        RepositoryProvider.value(value: catalogRepo),
        RepositoryProvider.value(value: bookingRepo),
        RepositoryProvider.value(value: sosRepo),
        RepositoryProvider.value(value: inboxRepo),
      ],
      child: MultiBlocProvider(
        providers: [
          BlocProvider(
            create: (_) => AuthBloc(authRepo)..add(const AuthStarted()),
          ),
          BlocProvider(create: (_) => HomeBloc(catalogRepo, bookingRepo)),
          BlocProvider(create: (_) => TripsBloc(bookingRepo)),
          BlocProvider(create: (_) => BookingBloc(catalogRepo, bookingRepo)),
          BlocProvider(create: (_) => SosBloc(sosRepo)),
          BlocProvider(create: (_) => MapBloc(catalogRepo)),
        ],
        child: MaterialApp(
          title: 'Sembung Explorer',
          debugShowCheckedModeBanner: false,
          theme: buildTheme(),
          home: BlocBuilder<AuthBloc, AuthState>(
            buildWhen: (a, b) => a.status != b.status,
            builder: (context, state) => switch (state.status) {
              AuthStatus.unknown => const _Splash(),
              AuthStatus.authenticated => const ShellScreen(),
              AuthStatus.unauthenticated => const LoginScreen(),
            },
          ),
        ),
      ),
    );
  }
}

class _Splash extends StatelessWidget {
  const _Splash();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      backgroundColor: AppColors.mossDark,
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('🏔️', style: TextStyle(fontSize: 64)),
            SizedBox(height: 16),
            Text(
              'Sembung Explorer',
              style: TextStyle(
                color: Colors.white,
                fontSize: 22,
                fontWeight: FontWeight.w800,
              ),
            ),
            SizedBox(height: 24),
            SizedBox(
              height: 22,
              width: 22,
              child: CircularProgressIndicator(
                  strokeWidth: 2, color: Colors.white),
            ),
          ],
        ),
      ),
    );
  }
}
