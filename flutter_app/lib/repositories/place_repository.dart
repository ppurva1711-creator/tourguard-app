import 'dart:convert';
import 'package:flutter/services.dart';
import 'package:latlong2/latlong.dart';
import '../models/place.dart';

class PlaceWithDistance {
  final Place place;
  final double distanceKm;
  const PlaceWithDistance(this.place, this.distanceKm);
}

class PlaceRepository {
  final Distance _distance = const Distance();

  Future<List<Place>> loadOfflinePlaces() async {
    final raw = await rootBundle.loadString('assets/data/hotels.json');
    final list = jsonDecode(raw) as List<dynamic>;
    return list
        .map((e) => Place.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<List<PlaceWithDistance>> findNearby({
    required double latitude,
    required double longitude,
    required String category,
    double radiusKm = 10,
  }) async {
    final places = await loadOfflinePlaces();
    final origin = LatLng(latitude, longitude);
    final result = <PlaceWithDistance>[];
    for (final place in places.where((p) => p.category == category)) {
      final km = _distance.as(
        LengthUnit.Kilometer,
        origin,
        LatLng(place.lat, place.lng),
      );
      if (km <= radiusKm) result.add(PlaceWithDistance(place, km));
    }
    result.sort((a, b) => a.distanceKm.compareTo(b.distanceKm));
    return result;
  }
}
