import 'package:flutter/material.dart';
import '../services/backend_service.dart';
import '../services/location_service.dart';

class SosScreen extends StatefulWidget {
  const SosScreen({super.key});

  @override
  State<SosScreen> createState() => _SosScreenState();
}

class _SosScreenState extends State<SosScreen> {
  final _location = LocationService();
  // Change this for your device/emulator.
  final _backend = const BackendService(baseUrl: 'http://10.0.2.2:3000');
  bool _sending = false;
  String _status = 'Ready';

  Future<void> _triggerSos() async {
    setState(() {
      _sending = true;
      _status = 'Getting location...';
    });
    final loc = await _location.getCurrentLocation();
    final lat = loc?.latitude ?? 18.5170;
    final lng = loc?.longitude ?? 73.8550;
    try {
      await _backend.logSos(lat: lat, lng: lng, deviceId: 'tourguard-flutter');
      if (!mounted) return;
      setState(() => _status = 'SOS logged to backend. GSM SMS integration is a separate hardware layer.');
    } catch (_) {
      if (!mounted) return;
      setState(() => _status = 'Backend unavailable. Offline SOS should be queued locally and sent through ESP32 GSM when available.');
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Emergency SOS')),
        body: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Icon(Icons.sos, size: 110, color: Colors.red),
              const SizedBox(height: 20),
              const Text('Emergency Alert', textAlign: TextAlign.center, style: TextStyle(fontSize: 26, fontWeight: FontWeight.bold)),
              const SizedBox(height: 12),
              Text(_status, textAlign: TextAlign.center),
              const Spacer(),
              FilledButton.icon(
                style: FilledButton.styleFrom(padding: const EdgeInsets.all(22)),
                onPressed: _sending ? null : _triggerSos,
                icon: const Icon(Icons.warning_amber),
                label: Text(_sending ? 'Sending...' : 'SEND SOS'),
              ),
            ],
          ),
        ),
      );
}
