class Place {
  final String id;
  final String name;
  final double lat;
  final double lng;
  final String type;
  final String category;
  final double rating;
  final int pricePerNight;

  const Place({
    required this.id,
    required this.name,
    required this.lat,
    required this.lng,
    required this.type,
    required this.category,
    required this.rating,
    required this.pricePerNight,
  });

  factory Place.fromJson(Map<String, dynamic> json) => Place(
        id: json['id'] as String,
        name: json['name'] as String,
        lat: (json['lat'] as num).toDouble(),
        lng: (json['lng'] as num).toDouble(),
        type: (json['type'] ?? 'Place') as String,
        category: (json['category'] ?? 'hotel') as String,
        rating: ((json['rating'] ?? 0) as num).toDouble(),
        pricePerNight: ((json['pricePerNight'] ?? 0) as num).toInt(),
      );
}
