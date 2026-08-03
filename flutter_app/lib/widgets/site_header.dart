import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../core/auth/auth_service.dart';

class SiteHeaderWidget extends StatefulWidget implements PreferredSizeWidget {
  const SiteHeaderWidget({super.key});

  @override
  State<SiteHeaderWidget> createState() => _SiteHeaderWidgetState();

  @override
  Size get preferredSize => const Size.fromHeight(64);
}

class _SiteHeaderWidgetState extends State<SiteHeaderWidget> {
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
    final isMobile = MediaQuery.of(context).size.width < 1100;
    final theme = Theme.of(context);

    final canPop = context.canPop();
    String location = '/';
    try {
      location = GoRouterState.of(context).matchedLocation;
    } catch (e) {
      debugPrint('Error getting location: $e');
    }
    final isHome = location == '/';

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: Colors.grey[200]!)),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: AppBar(
        titleSpacing: 0,
        backgroundColor: Colors.transparent,
        elevation: 0,
        leadingWidth: !isHome ? 40 : 0,
        leading: !isHome 
          ? IconButton(
              icon: const Icon(Icons.arrow_back, color: Colors.black87),
              onPressed: () {
                if (canPop) {
                  context.pop();
                } else {
                  context.go('/');
                }
              },
            )
          : null,
        title: Row(
          children: [
            // Logo
            InkWell(
              onTap: () => context.go('/'),
              child: Row(
                children: [
                  Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      color: const Color(0xFF2563EB),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: const Icon(Icons.work, color: Colors.white, size: 18),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'Servio',
                    style: theme.textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w900,
                      fontSize: 20,
                    ),
                  ),
                ],
              ),
            ),
            if (!isMobile) ...[
              const SizedBox(width: 40),
              _navLink(context, 'Home', '/'),
              _navLink(context, 'How It Works', '/how-it-works'),
              _navLink(context, 'Services', '/discover'),
              _navLink(context, 'For Clients', '/for-clients'),
              _navLink(context, 'For Professionals', '/for-professionals'),
              _navLink(context, 'Pricing', '/pricing'),
              _navLink(context, 'FAQ', '/faq'),
            ],
          ],
        ),
        actions: [
          if (!isMobile) ...[
            if (_currentUser == null) ...[
              TextButton(
                onPressed: () => context.push('/login'),
                child: const Text('Log in', style: TextStyle(color: Colors.black87)),
              ),
              const SizedBox(width: 8),
              OutlinedButton(
                onPressed: () => context.push('/signup'),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  side: BorderSide(color: Colors.grey[300]!),
                ),
                child: const Text('Sign up', style: TextStyle(color: Colors.black87)),
              ),
            ] else ...[
              PopupMenuButton<String>(
                onSelected: (value) async {
                  if (value == 'logout') {
                    await AuthService().logout();
                    if (!context.mounted) return;
                    context.go('/login');
                  } else if (value == 'profile') {
                    context.push('/profile');
                  }
                },
                itemBuilder: (context) => [
                  PopupMenuItem(
                    value: 'user',
                    enabled: false,
                    child: Text(_currentUser!['full_name'] ?? 'User', style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.black)),
                  ),
                  const PopupMenuDivider(),
                  const PopupMenuItem(
                    value: 'profile',
                    child: Text('Profile'),
                  ),
                  const PopupMenuItem(
                    value: 'logout',
                    child: Text('Logout', style: TextStyle(color: Colors.red)),
                  ),
                ],
                child: CircleAvatar(
                  radius: 18,
                  backgroundImage: NetworkImage(_currentUser!['profile_image'] ?? 'https://i.pravatar.cc/100?u=user'),
                ),
              ),
            ],
            const SizedBox(width: 12),
            ElevatedButton(
              onPressed: () => context.push('/post-job'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFF97316),
                padding: const EdgeInsets.symmetric(horizontal: 16),
              ),
              child: const Text('Post a Job'),
            ),
          ] else ...[
            Builder(
              builder: (context) => IconButton(
                icon: const Icon(Icons.menu),
                onPressed: () => Scaffold.of(context).openEndDrawer(),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _navLink(BuildContext context, String title, String path) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      child: InkWell(
        onTap: () => context.go(path),
        child: Text(
          title,
          style: const TextStyle(
            fontSize: 14,
            color: Colors.black54,
            fontWeight: FontWeight.w500,
          ),
        ),
      ),
    );
  }
}
