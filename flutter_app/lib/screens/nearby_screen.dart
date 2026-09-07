import 'package:flutter/material.dart';
import '../repositories/place_repository.dart';
import '../services/location_service.dart';

class NearbyScreen extends StatefulWidget {
  const NearbyScreen({super.key});

  @override
  State<NearbyScreen> createState() => _NearbyScreenState();
}

class _NearbyScreenState extends State<NearbyScreen> {
  final _repo = PlaceRepository();
  final _location = LocationService();
  String _category = 'hotel';
  double _radius = 10;
  bool _loading = false;
  String _message = 'Tap search to find places from the offline database.';
  List<PlaceWithDistance> _results = [];

  Future<void> _search() async {
    setState(() => _loading = true);
    final loc = await _location.getCurrentLocation();
    if (!mounted) return;
    final lat = loc?.latitude ?? 18.5170;
    final lng = loc?.longitude ?? 73.8550;
    final results = await _repo.findNearby(
      latitude: lat,
      longitude: lng,
      category: _category,
      radiusKm: _radius,
    );
    if (!mounted) return;
    setState(() {
      _loading = false;
      _results = results;
      _message = loc == null ? 'GPS unavailable; using sample location.' : 'Results from local offline data.';
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Nearby Places')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                SegmentedButton<String>(
                  segments: const [
                    ButtonSegment(value: 'hotel', label: Text('Hotels'), icon: Icon(Icons.hotel)),
                    ButtonSegment(value: 'restaurant', label: Text('Restaurants'), icon: Icon(Icons.restaurant)),
                  ],
                  selected: {_category},
                  onSelectionChanged: (v) => setState(() => _category = v.first),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    const Text('Radius'),
                    Expanded(
                      child: Slider(
                        min: 1,
                        max: 20,
                        divisions: 19,
                        value: _radius,
                        label: '${_radius.round()} km',
                        onChanged: (v) => setState(() => _radius = v),
                      ),
                    ),
                    Text('${_radius.round()} km'),
                  ],
                ),
                FilledButton.icon(
                  onPressed: _loading ? null : _search,
                  icon: const Icon(Icons.search),
                  label: Text(_loading ? 'Searching...' : 'Find nearby'),
                ),
                const SizedBox(height: 8),
                Text(_message),
              ],
            ),
          ),
          Expanded(
            child: ListView.builder(
              itemCount: _results.length,
              itemBuilder: (context, index) {
                final item = _results[index];
                return Card(
                  margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                  child: ListTile(
                    leading: Icon(_category == 'hotel' ? Icons.hotel : Icons.restaurant),
                    title: Text(item.place.name),
                    subtitle: Text('${item.place.type} • ⭐ ${item.place.rating}'),
                    trailing: Text('${item.distanceKm.toStringAsFixed(2)} km'),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
