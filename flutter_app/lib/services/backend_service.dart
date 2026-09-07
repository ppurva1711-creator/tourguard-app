import 'dart:convert';
import 'package:http/http.dart' as http;

class BackendService {
  // Android emulator: http://10.0.2.2:3000
  // Real phone on same Wi-Fi: http://YOUR_PC_LAN_IP:3000
  // Web: http://localhost:3000
  final String baseUrl;
  const BackendService({required this.baseUrl});

  Future<List<dynamic>> getCrowd() async {
    final response = await http.get(Uri.parse('$baseUrl/api/crowd'));
    if (response.statusCode != 200) throw Exception('Crowd API failed');
    return jsonDecode(response.body) as List<dynamic>;
  }

  Future<void> logSos({
    required double lat,
    required double lng,
    required String deviceId,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/sos'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'lat': lat, 'lng': lng, 'deviceId': deviceId}),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception('SOS backend request failed');
    }
  }
}
