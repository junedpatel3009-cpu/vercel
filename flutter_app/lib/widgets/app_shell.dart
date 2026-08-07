import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class AppShell extends StatelessWidget {
  final Widget child;
  final String? title;

  const AppShell({super.key, required this.child, this.title});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      drawer: _buildDrawer(context),
      appBar: AppBar(
        title: Text(title ?? ''),
        centerTitle: false,
        elevation: 1,
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
          child: child,
        ),
      ),
      bottomNavigationBar: _buildBottomNav(context),
    );
  }

  Widget _buildDrawer(BuildContext context) {
    return Drawer(
      child: ListView(
        padding: EdgeInsets.zero,
        children: [
          const DrawerHeader(child: Text('Servio')),
          ListTile(title: const Text('Dashboard'), onTap: () {}),
          ListTile(title: const Text('Discover'), onTap: () {}),
          ListTile(title: const Text('Post a job'), onTap: () {}),
        ],
      ),
    );
  }

  Widget _buildBottomNav(BuildContext context) {
    final routes = ['/dashboard', '/discover', '/jobs', '/messages', '/profile'];
    String location = '/';
    try {
      location = GoRouterState.of(context).matchedLocation;
    } catch (_) {
      // fallback to root if matchedLocation isn't available
      location = '/';
    }

    int currentIndex = routes.indexWhere((r) => location == r || location.startsWith(r + '/'));
    if (currentIndex == -1) currentIndex = 0;

    return BottomNavigationBar(
      type: BottomNavigationBarType.fixed,
      items: const [
        BottomNavigationBarItem(icon: Icon(Icons.home), label: 'Home'),
        BottomNavigationBarItem(icon: Icon(Icons.search), label: 'Search'),
        BottomNavigationBarItem(icon: Icon(Icons.work), label: 'Jobs'),
        BottomNavigationBarItem(icon: Icon(Icons.message), label: 'Messages'),
        BottomNavigationBarItem(icon: Icon(Icons.person), label: 'Profile'),
      ],
      currentIndex: currentIndex,
      onTap: (i) {
        final target = routes[i];
        if (location != target) {
          context.go(target);
        }
      },
    );
  }
}
