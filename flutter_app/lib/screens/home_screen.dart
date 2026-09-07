import 'package:flutter/material.dart';
import 'map_screen.dart';
import 'nearby_screen.dart';
import 'sos_screen.dart';
import 'safety_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _index = 0;

  final _pages = const [
    DashboardPage(),
    MapScreen(),
    NearbyScreen(),
    SosScreen(),
    SafetyScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(child: _pages[_index]),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (value) => setState(() => _index = value),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.dashboard_outlined), selectedIcon: Icon(Icons.dashboard), label: 'Home'),
          NavigationDestination(icon: Icon(Icons.map_outlined), selectedIcon: Icon(Icons.map), label: 'Map'),
          NavigationDestination(icon: Icon(Icons.near_me_outlined), selectedIcon: Icon(Icons.near_me), label: 'Nearby'),
          NavigationDestination(icon: Icon(Icons.sos_outlined), selectedIcon: Icon(Icons.sos), label: 'SOS'),
          NavigationDestination(icon: Icon(Icons.health_and_safety_outlined), selectedIcon: Icon(Icons.health_and_safety), label: 'Safety'),
        ],
      ),
    );
  }
}

class DashboardPage extends StatelessWidget {
  const DashboardPage({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text('TourGuard', style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        const Text('Offline-first travel safety and navigation companion.'),
        const SizedBox(height: 24),
        _StatusCard(
          icon: Icons.location_on,
          title: 'Location',
          subtitle: 'GPS location is used when available. ESP32 GPS can later provide the same location through Bluetooth/Wi-Fi/serial gateway.',
        ),
        _StatusCard(
          icon: Icons.map,
          title: 'Offline maps',
          subtitle: 'UI and location integration are ready. The next phase is adding locally stored tiles/MBTiles.',
        ),
        _StatusCard(
          icon: Icons.sos,
          title: 'Emergency safety',
          subtitle: 'SOS flow can log to the existing Node backend; GSM SMS will be implemented on ESP32 separately.',
        ),
      ],
    );
  }
}

class _StatusCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  const _StatusCard({required this.icon, required this.title, required this.subtitle});

  @override
  Widget build(BuildContext context) => Card(
        child: ListTile(
          leading: Icon(icon, size: 32),
          title: Text(title),
          subtitle: Text(subtitle),
        ),
      );
}
