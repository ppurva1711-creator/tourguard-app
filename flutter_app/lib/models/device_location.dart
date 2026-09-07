class DeviceLocation {
  final double latitude;
  final double longitude;
  final double? accuracy;
  final DateTime timestamp;

  const DeviceLocation({
    required this.latitude,
    required this.longitude,
    required this.timestamp,
    this.accuracy,
  });
}
