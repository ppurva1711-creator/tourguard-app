class EmergencyContact {
  final String id;
  final String name;
  final String phone;

  EmergencyContact({
    required this.id,
    required this.name,
    required this.phone,
  });

  Map<String, dynamic> toMap() {
    return {
      'name': name,
      'phone': phone,
    };
  }

  factory EmergencyContact.fromMap(
    String id,
    Map<dynamic, dynamic> map,
  ) {
    return EmergencyContact(
      id: id,
      name: map['name'] ?? '',
      phone: map['phone'] ?? '',
    );
  }
}
