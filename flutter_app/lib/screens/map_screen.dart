import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../services/location_service.dart';

class MapScreen extends StatefulWidget {
  const MapScreen({super.key});

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  final _locationService = LocationService();
  LatLng _position = const LatLng(18.5170, 73.8550);
  bool _loading = false;
  String _status = 'Using sample location';

  Future<void> _locate() async {
    setState(() => _loading = true);
    final location = await _locationService.getCurrentLocation();
    if (!mounted) return;
    setState(() {
      _loading = false;
      if (location != null) {
        _position = LatLng(location.latitude, location.longitude);
        _status = 'Live GPS location';
      } else {
        _status = 'GPS unavailable or permission denied';
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Map & Navigation')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _loading ? null : _locate,
        icon: const Icon(Icons.my_location),
        label: Text(_loading ? 'Locating...' : 'Locate me'),
      ),
      body: Column(
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            color: Theme.of(context).colorScheme.surfaceContainerHighest,
            child: Text(_status),
          ),
          Expanded(
            child: FlutterMap(
              options: MapOptions(initialCenter: _position, initialZoom: 14),
              children: [
                // DEVELOPMENT TILE LAYER ONLY.
                // Replace this with a local MBTiles/offline tile provider in Phase 2.
                TileLayer(
                  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                  userAgentPackageName: 'com.example.tourguard',
                ),
                MarkerLayer(
                  markers: [
                    Marker(
                      point: _position,
                      width: 60,
                      height: 60,
                      child: const Icon(Icons.person_pin_circle, size: 48, color: Colors.red),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
