import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/auth/auth_service.dart';

/// A consistent client workspace menu displayed over every signed-in client
/// page. Keeping navigation here prevents each screen from having a different
/// dashboard style or a disconnected set of links.
class ClientWorkspaceMenu extends StatefulWidget {
  const ClientWorkspaceMenu({super.key, required this.location, required this.child});

  final String location;
  final Widget child;

  @override
  State<ClientWorkspaceMenu> createState() => _ClientWorkspaceMenuState();
}

class _ClientWorkspaceMenuState extends State<ClientWorkspaceMenu> {
  bool _isClient = false;

  @override
  void initState() {
    super.initState();
    _loadRole();
  }

  Future<void> _loadRole() async {
    final user = await AuthService().getUser();
    if (mounted) setState(() => _isClient = user?['role'].toString().toLowerCase() == 'client');
  }

  @override
  Widget build(BuildContext context) {
    if (!_isClient || _excludedRoute(widget.location)) return widget.child;
    return Stack(
      children: [
        widget.child,
        Positioned(
          top: MediaQuery.paddingOf(context).top + 10,
          right: 14,
          child: Material(
            color: Colors.white,
            elevation: 4,
            shadowColor: const Color(0x330F2B62),
            shape: const CircleBorder(),
            child: IconButton(
              tooltip: 'Client menu',
              icon: const Icon(Icons.menu_rounded, color: Color(0xFF1E40AF)),
              onPressed: _openMenu,
            ),
          ),
        ),
      ],
    );
  }

  bool _excludedRoute(String location) => const {
        '/', '/welcome', '/login', '/signup', '/forgot-password', '/setup/client', '/setup/professional',
      }.contains(location);

  void _openMenu() {
    showGeneralDialog<void>(
      context: context,
      barrierLabel: 'Close client menu',
      barrierDismissible: true,
      barrierColor: const Color(0x660B1633),
      transitionDuration: const Duration(milliseconds: 240),
      pageBuilder: (dialogContext, _, __) => Align(
        alignment: Alignment.centerLeft,
        child: Material(
          color: Colors.white,
          child: SafeArea(
            child: SizedBox(width: 286, height: double.infinity, child: _menu(dialogContext)),
          ),
        ),
      ),
      transitionBuilder: (_, animation, __, child) => SlideTransition(
        position: Tween<Offset>(begin: const Offset(-1, 0), end: Offset.zero).animate(CurvedAnimation(parent: animation, curve: Curves.easeOutCubic)),
        child: child,
      ),
    );
  }

  Widget _menu(BuildContext dialogContext) {
    return Column(
      children: [
        const Padding(
          padding: EdgeInsets.fromLTRB(23, 24, 20, 21),
          child: Row(children: [
            CircleAvatar(radius: 22, backgroundColor: Color(0xFF2450B8), child: Icon(Icons.business_center_outlined, color: Colors.white)),
            SizedBox(width: 11),
            Text('Servio', style: TextStyle(color: Color(0xFF102A5C), fontSize: 26, fontWeight: FontWeight.w800)),
          ]),
        ),
        const Divider(height: 1, color: Color(0xFFE6EBF3)),
        const SizedBox(height: 18),
        _item(dialogContext, Icons.grid_view_rounded, 'Dashboard', '/'),
        _item(dialogContext, Icons.person_outline_rounded, 'My info', '/setup/client'),
        _item(dialogContext, Icons.group_outlined, 'Find pros', '/discover'),
        _item(dialogContext, Icons.add_circle_outline_rounded, 'Post a job', '/post-job'),
        _item(dialogContext, Icons.business_center_outlined, 'Projects', '/jobs'),
        _item(dialogContext, Icons.chat_bubble_outline_rounded, 'Messages', '/messages'),
        _item(dialogContext, Icons.account_balance_wallet_outlined, 'Earnings', '/earnings'),
        _item(dialogContext, Icons.description_outlined, 'Reports', '/reports'),
        const Spacer(),
        const Divider(height: 1, color: Color(0xFFE6EBF3)),
        _item(dialogContext, Icons.logout_rounded, 'Log out', null, color: const Color(0xFFB42318)),
        const SizedBox(height: 15),
      ],
    );
  }

  Widget _item(BuildContext dialogContext, IconData icon, String label, String? route, {Color? color}) {
    final selected = route != null && widget.location == route;
    final itemColor = color ?? (selected ? Colors.white : const Color(0xFF5A6981));
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
      child: Material(
        color: selected ? const Color(0xFF2D57B9) : Colors.transparent,
        borderRadius: BorderRadius.circular(19),
        child: InkWell(
          borderRadius: BorderRadius.circular(19),
          onTap: () async {
            Navigator.of(dialogContext).pop();
            if (route != null) {
              context.go(route);
            } else {
              await AuthService().logout();
              if (mounted) context.go('/');
            }
          },
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
            child: Row(children: [
              Icon(icon, color: itemColor, size: 22),
              const SizedBox(width: 15),
              Text(label, style: TextStyle(color: itemColor, fontSize: 16, fontWeight: selected ? FontWeight.w700 : FontWeight.w500)),
            ]),
          ),
        ),
      ),
    );
  }
}
