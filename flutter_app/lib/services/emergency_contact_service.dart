import 'package:firebase_database/firebase_database.dart';

import '../models/emergency_contact.dart';

class EmergencyContactService {
  final String userId;

  EmergencyContactService(this.userId);

  DatabaseReference get _ref =>
      FirebaseDatabase.instance
          .ref('users/$userId/emergencyContacts');

  Future<void> addContact({
    required String name,
    required String phone,
  }) async {
    final newRef = _ref.push();

    await newRef.set({
      'name': name,
      'phone': phone,
    });
  }

  Future<void> deleteContact(String id) async {
    await _ref.child(id).remove();
  }

  Stream<List<EmergencyContact>> getContacts() {
    return _ref.onValue.map((event) {
      if (!event.snapshot.exists) {
        return [];
      }

      final data = event.snapshot.value as Map;

      return data.entries.map((entry) {
        return EmergencyContact.fromMap(
          entry.key,
          Map<dynamic, dynamic>.from(entry.value),
        );
      }).toList();
    });
  }
}
