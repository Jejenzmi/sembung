import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';

import '../../blocs/map/map_bloc.dart';
import '../../core/config.dart';
import '../../core/theme.dart';
import '../../data/models.dart';
import '../widgets/common.dart';

/// Interactive trail map. Tiles come from OpenTopoMap when online; the trail
/// geometry itself is cached on device so the route, posts and water sources
/// stay visible after the signal drops.
class MapScreen extends StatefulWidget {
  const MapScreen({super.key, required this.slug});
  final String slug;

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  final _controller = MapController();
  LatLng? _me;
  TrailPoint? _selected;

  @override
  void initState() {
    super.initState();
    context.read<MapBloc>().add(MapBundleRequested(widget.slug));
    _locate();
  }

  Future<void> _locate() async {
    try {
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        return;
      }
      final pos = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 12),
      );
      if (mounted) setState(() => _me = LatLng(pos.latitude, pos.longitude));
    } catch (_) {
      // No fix is fine — the trail map is still fully usable.
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Peta Jalur'),
        actions: [
          BlocBuilder<MapBloc, MapState>(
            builder: (context, state) => IconButton(
              tooltip: 'Perbarui peta offline',
              onPressed: state.downloading
                  ? null
                  : () => context
                      .read<MapBloc>()
                      .add(MapBundleDownloaded(widget.slug)),
              icon: state.downloading
                  ? const SizedBox(
                      height: 18,
                      width: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.download_for_offline_outlined),
            ),
          ),
        ],
      ),
      body: BlocConsumer<MapBloc, MapState>(
        listenWhen: (a, b) => a.notice != b.notice || a.error != b.error,
        listener: (context, state) {
          if (state.notice != null) showSnack(context, state.notice!);
          if (state.error != null && state.bundle != null) {
            showSnack(context, state.error!, error: true);
          }
        },
        builder: (context, state) {
          if (state.status == MapStatus.loading) {
            return const Center(child: CircularProgressIndicator());
          }
          if (state.bundle == null) {
            return ErrorView(
              message: state.error ?? 'Peta belum tersedia',
              onRetry: () =>
                  context.read<MapBloc>().add(MapBundleRequested(widget.slug)),
            );
          }

          final bundle = state.bundle!;
          final track = bundle.track.map((t) => LatLng(t[0], t[1])).toList();
          final center = track.isNotEmpty
              ? track[track.length ~/ 2]
              : const LatLng(kBasecampLat, kBasecampLng);

          return Stack(
            children: [
              FlutterMap(
                mapController: _controller,
                options: MapOptions(
                  initialCenter: center,
                  initialZoom: 13.5,
                  minZoom: 10,
                  maxZoom: 17,
                ),
                children: [
                  TileLayer(
                    urlTemplate:
                        'https://tile.opentopomap.org/{z}/{x}/{y}.png',
                    userAgentPackageName: 'id.sembung.sembung_explorer',
                    // Tiles that were fetched earlier stay in the image cache,
                    // so a previously viewed area still renders offline.
                    errorTileCallback: (_, __, ___) {},
                  ),
                  if (track.length > 1)
                    PolylineLayer(
                      polylines: [
                        Polyline(
                          points: track,
                          strokeWidth: 4.5,
                          color: AppColors.moss,
                        ),
                      ],
                    ),
                  MarkerLayer(
                    markers: [
                      ...bundle.points.map(
                        (p) => Marker(
                          point: LatLng(p.lat, p.lng),
                          width: 40,
                          height: 40,
                          child: GestureDetector(
                            onTap: () => setState(() => _selected = p),
                            child: Container(
                              decoration: BoxDecoration(
                                color: Colors.white,
                                shape: BoxShape.circle,
                                boxShadow: const [
                                  BoxShadow(
                                      color: Color(0x33000000), blurRadius: 4)
                                ],
                                border: Border.all(
                                  color: _selected?.id == p.id
                                      ? AppColors.moss
                                      : Colors.transparent,
                                  width: 2.5,
                                ),
                              ),
                              alignment: Alignment.center,
                              child: Text(p.icon,
                                  style: const TextStyle(fontSize: 16)),
                            ),
                          ),
                        ),
                      ),
                      if (_me != null)
                        Marker(
                          point: _me!,
                          width: 26,
                          height: 26,
                          child: Container(
                            decoration: BoxDecoration(
                              color: AppColors.sky,
                              shape: BoxShape.circle,
                              border: Border.all(color: Colors.white, width: 3),
                              boxShadow: const [
                                BoxShadow(
                                    color: Color(0x55000000), blurRadius: 6)
                              ],
                            ),
                          ),
                        ),
                    ],
                  ),
                ],
              ),
              if (state.fromCache)
                Positioned(
                  top: 12,
                  left: 16,
                  right: 16,
                  child: Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      color: AppColors.mossDark,
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: const Row(
                      children: [
                        Icon(Icons.cloud_off, color: Colors.white, size: 16),
                        SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Mode offline — jalur & titik dari data tersimpan',
                            style:
                                TextStyle(color: Colors.white, fontSize: 12.5),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              if (_selected != null)
                Positioned(
                  left: 16,
                  right: 16,
                  bottom: 16,
                  child: AppCard(
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(_selected!.icon,
                            style: const TextStyle(fontSize: 26)),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(_selected!.name,
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w800,
                                      fontSize: 15)),
                              const SizedBox(height: 3),
                              Text(
                                '${_selected!.typeLabel} · ${_selected!.elevationM} mdpl',
                                style: const TextStyle(
                                    fontSize: 12, color: AppColors.moss),
                              ),
                              if (_selected!.description != null) ...[
                                const SizedBox(height: 6),
                                Text(
                                  _selected!.description!,
                                  style: const TextStyle(
                                      fontSize: 12.5,
                                      color: Colors.black54,
                                      height: 1.5),
                                ),
                              ],
                            ],
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.close, size: 18),
                          onPressed: () => setState(() => _selected = null),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        backgroundColor: Colors.white,
        onPressed: () async {
          await _locate();
          if (_me != null) _controller.move(_me!, 15);
        },
        child: const Icon(Icons.my_location, color: AppColors.moss),
      ),
    );
  }
}
