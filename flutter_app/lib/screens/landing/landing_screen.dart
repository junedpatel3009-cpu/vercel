import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../core/theme/app_theme.dart';
import '../../core/database/database_helper.dart';
import 'package:flutter/services.dart';
import '../../core/auth/auth_service.dart';
import '../../core/api/api_client.dart';
import '../professional/professional_home_screen.dart';
import 'client_home_screen.dart';

class LandingScreen extends StatefulWidget {
  const LandingScreen({super.key});

  @override
  State<LandingScreen> createState() => _LandingScreenState();
}

class _LandingScreenState extends State<LandingScreen> {
  Map<String, dynamic>? _currentUser;
  List<Map<String, dynamic>> _availableJobs = [];
  List<Map<String, dynamic>> _publicJobs = [];
  Map<String, dynamic> _stats = {};
  List<Map<String, dynamic>> _recommendedPros = [];
  List<Map<String, dynamic>> _focusItems = [];
  Map<String, dynamic>? _latestUpdate;
  bool _isSessionLoading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final user = await AuthService().getUser();
    final cached = await _readDashboardCache(user);
    // Resolve the local session first. Remote dashboard requests can be slow
    // or fail, but neither case means that the user has been logged out.
    if (mounted) {
      setState(() {
        _currentUser = user;
        _availableJobs = cached.availableJobs;
        _publicJobs = cached.publicJobs;
        _recommendedPros = cached.recommendedPros;
        _focusItems = cached.focusItems;
        _stats = cached.stats;
        _latestUpdate = cached.latestUpdate;
        _isSessionLoading = false;
      });
    }

    final db = DatabaseHelper();
    
    List<Map<String, dynamic>> jobs = [];
    List<Map<String, dynamic>> publicJobs = [];
    List<Map<String, dynamic>> pros = [];
    List<Map<String, dynamic>> focus = [];
    Map<String, dynamic> stats = {};
    Map<String, dynamic>? update;

    try {
      if (user != null) {
        if (user['role'] == 'professional') {
          final responses = await Future.wait([
            ApiClient.instance.getList('/api/v1/jobs', authenticated: false),
            ApiClient.instance.getList('/api/v1/jobs'),
          ]);
          publicJobs = responses[0];
          jobs = responses[1];
          stats = await db.getProfessionalStats(user['id']);
          focus = await db.getJobs(status: 'assigned');
        } else {
          final responses = await Future.wait([
            ApiClient.instance.getList('/api/v1/jobs', authenticated: false),
            ApiClient.instance.getList('/api/v1/professionals?limit=50', authenticated: false),
            ApiClient.instance.getList('/api/v1/client/jobs'),
          ]);
          publicJobs = responses[0];
          pros = _mapProfessionals(responses[1]);
          focus = responses[2];
          final activeJobs = focus.where((job) {
            final status = (job['status'] ?? '').toString().toUpperCase();
            return status == 'OPEN' || status == 'ACTIVE' || status == 'ASSIGNED' || status == 'IN_PROGRESS';
          }).length;
          stats = {'total_jobs_posted': focus.length, 'active_jobs': activeJobs};
        }

        final notifications = await db.getNotifications(user['id']);
        if (notifications.isNotEmpty) update = notifications.first;
        if (update == null && focus.isNotEmpty) {
          final job = focus.first;
          update = {'message': 'Your job "${job['title'] ?? 'Project'}" is ${((job['status'] ?? 'OPEN').toString()).toLowerCase()}.'};
        }
      } else {
        final responses = await Future.wait([
          ApiClient.instance.getList('/api/v1/jobs', authenticated: false),
          ApiClient.instance.getList('/api/v1/professionals?limit=50', authenticated: false),
        ]);
        publicJobs = responses[0];
        pros = _mapProfessionals(responses[1]);
      }
    } on ApiException {
      // Keep the signed-in UI visible if the server is temporarily offline.
    }

    if (mounted) {
      setState(() {
        _availableJobs = jobs;
        _publicJobs = publicJobs;
        _recommendedPros = pros;
        _stats = stats;
        _focusItems = focus;
        _latestUpdate = update;
      });
      _saveDashboardCache(
        user,
        _DashboardCache(
          availableJobs: jobs,
          publicJobs: publicJobs,
          recommendedPros: pros,
          focusItems: focus,
          stats: stats,
          latestUpdate: update,
        ),
      );
    }
  }

  String _dashboardCacheKey(Map<String, dynamic>? user) =>
      'home_dashboard_cache_${user?['id'] ?? 'guest'}';

  Future<_DashboardCache> _readDashboardCache(Map<String, dynamic>? user) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_dashboardCacheKey(user));
      if (raw == null) return const _DashboardCache();
      final data = Map<String, dynamic>.from(jsonDecode(raw) as Map);
      List<Map<String, dynamic>> listFor(String key) => (data[key] as List? ?? [])
          .map((item) => Map<String, dynamic>.from(item as Map))
          .toList();
      return _DashboardCache(
        availableJobs: listFor('availableJobs'),
        publicJobs: listFor('publicJobs'),
        recommendedPros: listFor('recommendedPros'),
        focusItems: listFor('focusItems'),
        stats: Map<String, dynamic>.from(data['stats'] as Map? ?? {}),
        latestUpdate: data['latestUpdate'] is Map
            ? Map<String, dynamic>.from(data['latestUpdate'] as Map)
            : null,
      );
    } catch (_) {
      return const _DashboardCache();
    }
  }

  Future<void> _saveDashboardCache(
    Map<String, dynamic>? user,
    _DashboardCache cache,
  ) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_dashboardCacheKey(user), jsonEncode(cache.toJson()));
    } catch (_) {
      // The live data is already shown; cache storage is only an optimization.
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        SystemNavigator.pop();
      },
      child: Scaffold(
        backgroundColor: AppTheme.bgLight,
        body: SafeArea(
          child: Column(
            children: [
              _buildAppBar(context),
              Expanded(
                child: _isSessionLoading
                    ? const Center(child: CircularProgressIndicator(color: Color(0xFF1E40AF)))
                    : _currentUser == null
                    ? _buildGuestWelcome(context)
                    : _currentUser?['role'] == 'professional'
                    ? ProfessionalHomeScreen(
                        user: _currentUser!,
                        stats: _stats,
                        availableJobs: _availableJobs,
                        focusItems: _focusItems,
                        latestUpdate: _latestUpdate,
                      )
                    : ClientHomeScreen(
                        user: _currentUser!,
                        stats: _stats,
                        recommendedPros: _recommendedPros,
                        publicJobs: _publicJobs,
                        focusItems: _focusItems,
                        latestUpdate: _latestUpdate,
                      ),
              ),
            ],
          ),
        ),
        bottomNavigationBar: _buildBottomNav(context),
      ),
    );
  }

  Widget _buildGuestWelcome(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: const Duration(milliseconds: 650),
      curve: Curves.easeOutCubic,
      builder: (context, value, child) => Opacity(
        opacity: value,
        child: Transform.translate(offset: Offset(0, 20 * (1 - value)), child: child),
      ),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(24, 12, 24, 28),
        child: Column(
          children: [
            Container(
              width: double.infinity,
              height: 290,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(32),
                gradient: const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [Color(0xFFEAF2FF), Color(0xFFF9FBFF)],
                ),
                border: Border.all(color: const Color(0xFFD9E6FB)),
                boxShadow: const [BoxShadow(color: Color(0x180F3B8A), blurRadius: 28, offset: Offset(0, 14))],
              ),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  Positioned(top: 24, right: 26, child: _welcomeOrb(72, const Color(0xFFF59E0B).withValues(alpha: 0.14))),
                  Positioned(bottom: 20, left: 18, child: _welcomeOrb(96, const Color(0xFF2563EB).withValues(alpha: 0.10))),
                  Container(
                    width: 210,
                    height: 210,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(42),
                      boxShadow: const [BoxShadow(color: Color(0x1A1E40AF), blurRadius: 22, offset: Offset(0, 10))],
                    ),
                    child: Stack(
                      alignment: Alignment.center,
                      children: [
                        Container(
                          width: 116,
                          height: 116,
                          decoration: const BoxDecoration(color: Color(0xFFEEF5FF), shape: BoxShape.circle),
                        ),
                        const Icon(Icons.handshake_rounded, size: 86, color: Color(0xFF1649A3)),
                        Positioned(
                          top: 20,
                          right: 16,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), boxShadow: const [BoxShadow(color: Color(0x1A0F172A), blurRadius: 10)]),
                            child: const Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.verified_rounded, size: 16, color: Color(0xFF2563EB)),
                                SizedBox(width: 5),
                                Text('Verified network', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF1E3A8A))),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 34),
            Text(
              'Work with people\nyou can trust.',
              textAlign: TextAlign.center,
              style: GoogleFonts.plusJakartaSans(fontSize: 28, height: 1.18, fontWeight: FontWeight.w800, color: const Color(0xFF0F1F45)),
            ),
            const SizedBox(height: 14),
            const Text(
              'Find trusted professionals, post projects,\nand manage every step in one place.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 15, height: 1.55, color: AppTheme.textGray),
            ),
            const SizedBox(height: 30),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () => context.push('/signup'),
                icon: const Icon(Icons.arrow_forward_rounded),
                iconAlignment: IconAlignment.end,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF123F94),
                  foregroundColor: Colors.white,
                  elevation: 5,
                  shadowColor: const Color(0x55123F94),
                  padding: const EdgeInsets.symmetric(vertical: 18),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                ),
                label: const Text('Create your account', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: () => context.push('/login'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFF1649A3),
                  side: const BorderSide(color: Color(0xFFBFD1F4)),
                  padding: const EdgeInsets.symmetric(vertical: 17),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                ),
                child: const Text('Log in', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
              ),
            ),
            const SizedBox(height: 26),
            const Wrap(
              alignment: WrapAlignment.center,
              spacing: 22,
              children: [
                Text('How it works', style: TextStyle(fontSize: 12, color: AppTheme.textGray)),
                Text('Trust & safety', style: TextStyle(fontSize: 12, color: AppTheme.textGray)),
                Text('Privacy', style: TextStyle(fontSize: 12, color: AppTheme.textGray)),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _welcomeOrb(double size, Color color) => Container(
    width: size,
    height: size,
    decoration: BoxDecoration(color: color, shape: BoxShape.circle),
  );

  Widget _buildAppBar(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          GestureDetector(
            onTap: () => context.go('/'),
            child: Text(
              _currentUser?['role'] == 'professional' ? 'SERVIO' : 'SERVIO',
              style: GoogleFonts.plusJakartaSans(
                fontSize: 24,
                fontWeight: FontWeight.w900,
                color: const Color(0xFF1E3A8A),
                letterSpacing: -0.5,
              ),
            ),
          ),
          if (_currentUser != null)
            InkWell(
              // Clients open their workspace dashboard from the avatar. Profile
              // setup is an edit action, not the first screen they should see.
              onTap: () => context.push(
                _currentUser?['role'] == 'client' ? '/dashboard' : '/profile',
              ),
              borderRadius: BorderRadius.circular(24),
              child: CircleAvatar(
                radius: 21,
                backgroundColor: const Color(0xFFE8F0FF),
                backgroundImage: _profileAvatar(),
                child: _profileAvatar() == null
                    ? const Icon(Icons.person_outline, color: Color(0xFF1E40AF))
                    : null,
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildBottomNav(BuildContext context) {
    if (_currentUser == null) return const SizedBox.shrink();
    final isPro = _currentUser?['role'] == 'professional';
    return Container(
      padding: const EdgeInsets.only(top: 12, bottom: 24),
      decoration: const BoxDecoration(color: Colors.white, border: Border(top: BorderSide(color: Color(0xFFF1F5F9)))),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _navItem(context, Icons.home, 'HOME', true, '/'),
          _navItem(context, Icons.search, 'SEARCH', false, '/discover'),
          isPro
              ? _navItem(context, Icons.work_outline, 'JOBS', false, '/jobs')
              : _navItem(context, Icons.business_center_outlined, 'PROJECTS', false, '/projects'),
          _navItem(context, Icons.chat_bubble_outline, 'MESSAGES', false, '/messages'),
          _navItem(context, Icons.person_outline, 'PROFILE', false, '/profile'),
        ],
      ),
    );
  }

  Widget _navItem(BuildContext context, IconData icon, String label, bool active, String route) {
    return InkWell(
      onTap: () => context.go(route),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: active ? const Color(0xFF1E40AF) : const Color(0xFF94A3B8), size: 26),
          const SizedBox(height: 6),
          Text(label, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: active ? const Color(0xFF1E40AF) : const Color(0xFF94A3B8), letterSpacing: 0.5)),
        ],
      ),
    );
  }

  ImageProvider? _profileAvatar() {
    final value = (_currentUser?['avatarUrl'] ?? _currentUser?['profile_image'] ?? '').toString().trim();
    if (value.startsWith('http://') || value.startsWith('https://')) return NetworkImage(value);
    if (value.startsWith('data:image')) {
      try {
        return MemoryImage(base64Decode(value.substring(value.indexOf(',') + 1)));
      } catch (_) {
        return null;
      }
    }
    return null;
  }
}

class _DashboardCache {
  const _DashboardCache({
    this.availableJobs = const [],
    this.publicJobs = const [],
    this.recommendedPros = const [],
    this.focusItems = const [],
    this.stats = const {},
    this.latestUpdate,
  });

  final List<Map<String, dynamic>> availableJobs;
  final List<Map<String, dynamic>> publicJobs;
  final List<Map<String, dynamic>> recommendedPros;
  final List<Map<String, dynamic>> focusItems;
  final Map<String, dynamic> stats;
  final Map<String, dynamic>? latestUpdate;

  Map<String, dynamic> toJson() => {
        'availableJobs': availableJobs,
        'publicJobs': publicJobs,
        'recommendedPros': recommendedPros,
        'focusItems': focusItems,
        'stats': stats,
        'latestUpdate': latestUpdate,
      };
}

List<Map<String, dynamic>> _mapProfessionals(List<Map<String, dynamic>> rows) => rows
    .map(
      (pro) => <String, dynamic>{
        'user_id': pro['id'],
        'full_name': '${pro['firstName'] ?? ''} ${pro['lastName'] ?? ''}'.trim(),
        'profession': pro['professionalCategory'] ?? 'Service Professional',
        'profile_photo': pro['avatarUrl'],
        'average_rating': pro['averageRating'] ?? 0,
        'total_reviews': pro['reviewCount'] ?? 0,
      },
    )
    .toList();
