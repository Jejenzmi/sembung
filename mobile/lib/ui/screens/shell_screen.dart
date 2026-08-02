import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../blocs/home/home_bloc.dart';
import '../../blocs/sos/sos_bloc.dart';
import '../../blocs/trips/trips_bloc.dart';
import '../../core/theme.dart';
import 'home_screen.dart';
import 'map_screen.dart';
import 'profile_screen.dart';
import 'sos_screen.dart';
import 'trips_screen.dart';

class ShellScreen extends StatefulWidget {
  const ShellScreen({super.key});

  @override
  State<ShellScreen> createState() => _ShellScreenState();
}

class _ShellScreenState extends State<ShellScreen> {
  int _index = 0;

  @override
  void initState() {
    super.initState();
    context.read<HomeBloc>().add(const HomeRefreshed());
    context.read<TripsBloc>().add(const TripsRefreshed());
    context.read<SosBloc>().add(const SosStarted());
  }

  void _open(int index) => setState(() => _index = index);

  @override
  Widget build(BuildContext context) {
    final pages = [
      HomeScreen(onOpenTab: _open),
      // The map tab defaults to the main trail; per-trail maps open from detail.
      const MapScreen(slug: 'pasanggrahan'),
      const TripsScreen(),
      const SosScreen(),
      const ProfileScreen(),
    ];

    return Scaffold(
      body: IndexedStack(index: _index, children: pages),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: _open,
        backgroundColor: Colors.white,
        indicatorColor: AppColors.mossLight,
        height: 68,
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home, color: AppColors.moss),
            label: 'Beranda',
          ),
          NavigationDestination(
            icon: Icon(Icons.map_outlined),
            selectedIcon: Icon(Icons.map, color: AppColors.moss),
            label: 'Peta',
          ),
          NavigationDestination(
            icon: Icon(Icons.confirmation_number_outlined),
            selectedIcon:
                Icon(Icons.confirmation_number, color: AppColors.moss),
            label: 'Trip',
          ),
          NavigationDestination(
            icon: Icon(Icons.sos_outlined, color: AppColors.danger),
            selectedIcon: Icon(Icons.sos, color: AppColors.danger),
            label: 'SOS',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person, color: AppColors.moss),
            label: 'Profil',
          ),
        ],
      ),
    );
  }
}
