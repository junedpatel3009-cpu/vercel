import 'package:flutter/material.dart';
import '../landing/landing_screen.dart';

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    // Both screens now use the same high-fidelity replication design
    return const LandingScreen();
  }
}
