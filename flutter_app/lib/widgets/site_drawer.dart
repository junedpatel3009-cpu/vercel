import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../core/auth/auth_service.dart';

class SiteDrawer extends StatefulWidget {
  const SiteDrawer({super.key});

  @override
  State<SiteDrawer> createState() => _SiteDrawerState();
}

class _SiteDrawerState extends State<SiteDrawer> {
  Map<String, dynamic>? _currentUser;

  @override
  void initState() {
    super.initState();
    _loadUser();
  }

  Future<void> _loadUser() async {
    final user = await AuthService().getUser();
    if (mounted) {
      setState(() {
        _currentUser = user;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Drawer(
      child: Column(
        children: [
          UserAccountsDrawerHeader(
            accountName: Text(_currentUser?['full_name'] ?? 'Guest'),
            accountEmail: Text(_currentUser?['email'] ?? 'Welcome to Servio'),
            currentAccountPicture: const CircleAvatar(child: Icon(Icons.person_outline)),
            decoration: BoxDecoration(color: theme.colorScheme.primary),
          ),
          ListTile(
            leading: const Icon(Icons.home),
            title: const Text('Home'),
            onTap: () {
              Navigator.pop(context);
              context.go('/');
            },
          ),
          if (_currentUser != null) ...[
            ListTile(
              leading: const Icon(Icons.person),
              title: const Text('My Profile'),
              onTap: () {
                Navigator.pop(context);
                context.push('/profile');
              },
            ),
            ListTile(
              leading: const Icon(Icons.dashboard),
              title: const Text('Dashboard'),
              onTap: () {
                Navigator.pop(context);
                context.push('/dashboard');
              },
            ),
          ],
          ListTile(
            leading: const Icon(Icons.search),
            title: const Text('Discover Services'),
            onTap: () {
              Navigator.pop(context);
              context.push('/discover');
            },
          ),
          ListTile(
            leading: const Icon(Icons.add_circle_outline),
            title: const Text('Post a Job'),
            onTap: () {
              Navigator.pop(context);
              context.push('/post-job');
            },
          ),
          const Divider(),
          if (_currentUser == null) ...[
            ListTile(
              leading: const Icon(Icons.login),
              title: const Text('Login'),
              onTap: () {
                Navigator.pop(context);
                context.push('/login');
              },
            ),
            ListTile(
              leading: const Icon(Icons.person_add),
              title: const Text('Sign Up'),
              onTap: () {
                Navigator.pop(context);
                context.push('/signup');
              },
            ),
          ] else ...[
            ListTile(
              leading: const Icon(Icons.logout, color: Colors.red),
              title: const Text('Logout', style: TextStyle(color: Colors.red)),
              onTap: () async {
                await AuthService().logout();
                if (!context.mounted) return;
                Navigator.pop(context);
                context.go('/login');
              },
            ),
          ],
        ],
      ),
    );
  }
}
