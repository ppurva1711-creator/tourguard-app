class DeviceLocation {
  final double latitude;
  final double longitude;
  final int timestamp;

  DeviceLocation({
    required this.latitude,
    required this.longitude,
    required this.timestamp,
  });

  factory DeviceLocation.fromMap(Map<dynamic, dynamic> map) {
    return DeviceLocation(
      latitude: (map['latitude'] ?? 0).toDouble(),
      longitude: (map['longitude'] ?? 0).toDouble(),
      timestamp: map['timestamp'] ?? 0,
    );
  }
}
