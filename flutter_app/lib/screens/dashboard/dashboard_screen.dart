import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_service.dart';

/// The client's workspace navigation. This is deliberately separate from the
/// home feed, so tapping the profile icon never opens the setup form directly.
class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  Map<String, dynamic>? _user;

  @override
  void initState() {
    super.initState();
    _loadUser();
  }

  Future<void> _loadUser() async {
    final user = await AuthService().getUser();
    if (mounted) setState(() => _user = user);
  }

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.of(context).size.width;
    final isWide = width >= 700;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFF),
      body: SafeArea(
        child: Align(
          alignment: isWide ? Alignment.centerLeft : Alignment.topCenter,
          child: Container(
            width: isWide ? 310 : double.infinity,
            height: double.infinity,
            color: Colors.white,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _header(),
                const Divider(height: 1, color: Color(0xFFE6EBF3)),
                const SizedBox(height: 22),
                _navItem(Icons.grid_view_rounded, 'Dashboard', () => context.go('/')),
                _navItem(Icons.person_outline_rounded, 'My info', () => context.push('/setup/client')),
                _navItem(Icons.group_outlined, 'Find pros', () => context.push('/discover')),
                _navItem(Icons.add_circle_outline_rounded, 'Post a job', () => context.push('/post-job')),
                _navItem(Icons.business_center_outlined, 'Projects', () => context.push('/jobs'), selected: true),
                _navItem(Icons.chat_bubble_outline_rounded, 'Messages', () => context.push('/messages')),
                _navItem(Icons.account_balance_wallet_outlined, 'Earnings', () => context.push('/earnings')),
                _navItem(Icons.description_outlined, 'Reports', () => context.push('/reports')),
                const Spacer(),
                const Divider(height: 1, color: Color(0xFFE6EBF3)),
                _navItem(Icons.logout_rounded, 'Log out', _logout, color: const Color(0xFFB42318)),
                const SizedBox(height: 18),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _header() {
    final name = (_user?['full_name'] ?? _user?['name'] ?? '').toString().trim();
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 22, 18, 20),
      child: Row(
        children: [
          Container(
            width: 45,
            height: 45,
            decoration: const BoxDecoration(color: Color(0xFF2450B8), shape: BoxShape.circle),
            child: const Icon(Icons.business_center_outlined, color: Colors.white, size: 23),
          ),
          const SizedBox(width: 11),
          const Text('Servio', style: TextStyle(color: Color(0xFF102A5C), fontSize: 27, fontWeight: FontWeight.w800)),
          const Spacer(),
          if (name.isNotEmpty)
            Tooltip(
              message: name,
              child: const Icon(Icons.more_horiz_rounded, color: Color(0xFF64748B)),
            ),
        ],
      ),
    );
  }

  Widget _navItem(IconData icon, String label, VoidCallback onTap, {bool selected = false, Color? color}) {
    final itemColor = color ?? (selected ? Colors.white : const Color(0xFF5A6981));
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 3),
      child: Material(
        color: selected ? const Color(0xFF2D57B9) : Colors.transparent,
        borderRadius: BorderRadius.circular(20),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(20),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
            child: Row(
              children: [
                Icon(icon, color: itemColor, size: 23),
                const SizedBox(width: 16),
                Text(label, style: TextStyle(color: itemColor, fontSize: 17, fontWeight: selected ? FontWeight.w700 : FontWeight.w500)),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _logout() async {
    await AuthService().logout();
    if (mounted) context.go('/');
  }
}
