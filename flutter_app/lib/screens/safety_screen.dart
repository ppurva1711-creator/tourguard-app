import 'package:flutter/material.dart';

class SafetyScreen extends StatelessWidget {
  const SafetyScreen({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Safety & Fall Detection')),
        body: ListView(
          padding: const EdgeInsets.all(16),
          children: const [
            Card(
              child: ListTile(
                leading: Icon(Icons.sensors),
                title: Text('MPU6050 / ESP32 integration'),
                subtitle: Text('The ESP32 should run the actual MPU6050 fall-detection algorithm and publish an event to the app/device gateway.'),
              ),
            ),
            Card(
              child: ListTile(
                leading: Icon(Icons.sms),
                title: Text('GSM emergency message'),
                subtitle: Text('The ESP32 + SIM module can send an SMS with the latest GPS coordinates without requiring internet.'),
              ),
            ),
            Card(
              child: ListTile(
                leading: Icon(Icons.bluetooth),
                title: Text('Future app-device connection'),
                subtitle: Text('Flutter can receive status/events from ESP32 using BLE. Wi-Fi or serial gateways can also be added later.'),
              ),
            ),
          ],
        ),
      );
}
