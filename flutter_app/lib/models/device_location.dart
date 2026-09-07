class DeviceLocation {
  final double latitude;
  final double longitude;
  final double accuracy;
  final DateTime timestamp;

  DeviceLocation({
    required this.latitude,
    required this.longitude,
    required this.accuracy,
    required this.timestamp,
  });

  Map<String, dynamic> toJson() {
    return {
      'latitude': latitude,
      'longitude': longitude,
      'accuracy': accuracy,
      'timestamp': timestamp.toIso8601String(),
    };
  }

  factory DeviceLocation.fromJson(Map<dynamic, dynamic> json) {
    return DeviceLocation(
      latitude: (json['latitude'] ?? 0).toDouble(),
      longitude: (json['longitude'] ?? 0).toDouble(),
      accuracy: (json['accuracy'] ?? 0).toDouble(),
      timestamp: DateTime.tryParse(json['timestamp'] ?? '') ??
          DateTime.now(),
    );
  }
}
