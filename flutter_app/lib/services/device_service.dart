import 'package:firebase_database/firebase_database.dart';

import '../models/device_location.dart';

class DeviceService {
  final String deviceId = 'tourguard_001';

  DatabaseReference get _locationRef =>
      FirebaseDatabase.instance
          .ref('devices/$deviceId/location');

  Stream<DeviceLocation?> getLocationStream() {
    return _locationRef.onValue.map((event) {
      if (!event.snapshot.exists) {
        return null;
      }

      final data = event.snapshot.value;

      if (data is Map) {
        return DeviceLocation.fromMap(data);
      }

      return null;
    });
  }

  Stream<DatabaseEvent> getDeviceStream() {
    return FirebaseDatabase.instance
        .ref('devices/$deviceId')
        .onValue;
  }
}
