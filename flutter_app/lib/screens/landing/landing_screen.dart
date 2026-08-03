import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/theme/app_theme.dart';
import '../../core/database/database_helper.dart';
import 'package:flutter/services.dart';
import '../../core/auth/auth_service.dart';
import '../../core/api/api_client.dart';
import '../../widgets/site_drawer.dart';

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

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final user = await AuthService().getUser();
    final db = DatabaseHelper();
    
    List<Map<String, dynamic>> jobs = [];
    List<Map<String, dynamic>> publicJobs = [];
    List<Map<String, dynamic>> pros = [];
    List<Map<String, dynamic>> focus = [];
    Map<String, dynamic> stats = {};
    Map<String, dynamic>? update;

    // Jobs are marketplace content, so every home view can show them.
    publicJobs = await ApiClient.instance.getList('/api/v1/jobs', authenticated: false);

    if (user != null) {
      if (user['role'] == 'professional') {
        jobs = await ApiClient.instance.getList('/api/v1/jobs');
        stats = await db.getProfessionalStats(user['id']);
        focus = await db.getJobs(status: 'assigned'); // Jobs assigned to this pro
      } else {
        pros = _mapProfessionals(
          await ApiClient.instance.getList('/api/v1/professionals', authenticated: false),
        );
        stats = await db.getClientStats(user['id']);
        focus = await ApiClient.instance.getList('/api/v1/client/jobs');
      }
      
      final notifications = await db.getNotifications(user['id']);
      if (notifications.isNotEmpty) update = notifications.first;
    } else {
      // Public landing: show some random pros or categories
      pros = _mapProfessionals(
        await ApiClient.instance.getList('/api/v1/professionals', authenticated: false),
      );
    }

    if (mounted) {
      setState(() {
        _currentUser = user;
        _availableJobs = jobs;
        _publicJobs = publicJobs;
        _recommendedPros = pros;
        _stats = stats;
        _focusItems = focus;
        _latestUpdate = update;
      });
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
        endDrawer: const SiteDrawer(),
        body: SafeArea(
          child: Column(
            children: [
              _buildAppBar(context),
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const SizedBox(height: 16),
                      _buildGreeting(),
                      const SizedBox(height: 24),
                      _buildSearchBar(context),
                      const SizedBox(height: 24),
                      _buildSummarySection(context),
                      const SizedBox(height: 24),
                      _buildUpdateBanner(context),
                      const SizedBox(height: 40),
                      const Text('Quick Actions', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
                      const SizedBox(height: 24),
                      _buildQuickActionsGrid(context),
                      const SizedBox(height: 40),
                      _buildDynamicListHeader(context),
                      const SizedBox(height: 16),
                      _currentUser?['role'] == 'professional' ? _buildJobsList(context) : _buildRecommendedList(context),
                      if (_currentUser?['role'] != 'professional') ...[
                        const SizedBox(height: 40),
                        _buildLatestJobsHeader(context),
                        const SizedBox(height: 16),
                        _buildPublicJobsList(context),
                      ],
                      const SizedBox(height: 40),
                      const Text('Current Focus', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
                      const SizedBox(height: 24),
                      _buildCurrentFocusList(context),
                      const SizedBox(height: 40),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
        bottomNavigationBar: _buildBottomNav(context),
      ),
    );
  }

  Widget _buildAppBar(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          GestureDetector(
            onTap: () => context.go('/'),
            child: Text(
              _currentUser?['role'] == 'professional' ? 'ProDashboard' : 'ProConnect',
              style: GoogleFonts.plusJakartaSans(
                fontSize: 24,
                fontWeight: FontWeight.w900,
                color: const Color(0xFF1E3A8A),
                letterSpacing: -0.5,
              ),
            ),
          ),
          if (_currentUser == null)
            Row(
              children: [
                TextButton(
                  onPressed: () => context.push('/login'),
                  child: const Text('Login', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF1E40AF))),
                ),
                const SizedBox(width: 8),
                ElevatedButton(
                  onPressed: () => context.push('/signup'),
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    backgroundColor: const Color(0xFF1E40AF),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    minimumSize: Size.zero,
                  ),
                  child: const Text('Sign Up', style: TextStyle(fontSize: 12)),
                ),
              ],
            )
          else
            Row(
              children: [
                OutlinedButton.icon(
                  onPressed: () => context.push('/profile'),
                  icon: const Icon(Icons.person_outline, size: 17),
                  label: const Text('Profile'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFF1E40AF),
                    side: const BorderSide(color: Color(0xFFBFDBFE)),
                  ),
                ),
                const SizedBox(width: 8),
                TextButton.icon(
                  onPressed: () async {
                    await AuthService().logout();
                    if (!context.mounted) return;
                    setState(() => _currentUser = null);
                    context.go('/');
                  },
                  icon: const Icon(Icons.logout, size: 17),
                  label: const Text('Log out'),
                  style: TextButton.styleFrom(foregroundColor: const Color(0xFF1E40AF)),
                ),
              ],
            ),
        ],
      ),
    );
  }

  Widget _buildGreeting() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          _currentUser != null
              ? 'Hello, ${(_currentUser!['full_name'] ?? _currentUser!['firstName'] ?? 'there').toString().split(' ')[0]}'
              : 'Welcome to Servio',
          style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 8),
        Text(
          _currentUser?['role'] == 'professional' ? 'Browse available jobs and start earning today' : 'What professional service do you need today?',
          style: Theme.of(context).textTheme.bodyMedium,
        ),
      ],
    );
  }

  Widget _buildSearchBar(BuildContext context) {
    return GestureDetector(
      onTap: () => context.push(_currentUser?['role'] == 'professional' ? '/jobs' : '/discover'),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: Row(
          children: [
            const Icon(Icons.search, color: Color(0xFF94A3B8)),
            const SizedBox(width: 12),
            Text(
              _currentUser?['role'] == 'professional' ? 'Search for jobs (e.g. Logo Design, Plumber)' : 'Search for experts (e.g. UI Designer, Plumber)',
              style: TextStyle(color: const Color(0xFF94A3B8).withValues(alpha: 0.7), fontSize: 14),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSummarySection(BuildContext context) {
    if (_currentUser == null) return const SizedBox.shrink();
    
    final isPro = _currentUser!['role'] == 'professional';
    return Row(
      children: [
        _buildSummaryCard(
          context,
          count: (isPro ? _stats['active_jobs'] : _stats['active_jobs'])?.toString().padLeft(2, '0') ?? '00',
          label: 'Active Projects',
          icon: Icons.check_box_outlined,
          bgColor: const Color(0xFF1E40AF),
          textColor: Colors.white,
          onTap: () => context.push('/jobs'),
        ),
        const SizedBox(width: 16),
        _buildSummaryCard(
          context,
          count: (isPro ? _stats['jobs_applied'] : _stats['total_jobs_posted'])?.toString().padLeft(2, '0') ?? '00',
          label: isPro ? 'Pending Proposals' : 'Total Posted',
          icon: Icons.assignment_outlined,
          bgColor: Colors.white,
          textColor: const Color(0xFF0F172A),
          iconColor: const Color(0xFF92400E),
          onTap: () => context.push('/dashboard'),
        ),
      ],
    );
  }

  Widget _buildUpdateBanner(BuildContext context) {
    if (_latestUpdate == null) return const SizedBox.shrink();
    
    return GestureDetector(
      onTap: () => context.push('/notifications'),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(color: const Color(0xFFFFF7ED), borderRadius: BorderRadius.circular(24)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('LATEST UPDATE', style: GoogleFonts.plusJakartaSans(fontSize: 12, fontWeight: FontWeight.w800, color: const Color(0xFFF97316), letterSpacing: 1)),
            const SizedBox(height: 12),
            Text(_latestUpdate!['message'] ?? '', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Color(0xFF92400E))),
            const SizedBox(height: 16),
            const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('View Notification', style: TextStyle(color: Color(0xFFF97316), fontWeight: FontWeight.w800)),
                SizedBox(width: 8),
                Icon(Icons.arrow_forward, size: 16, color: Color(0xFFF97316)),
              ],
            )
          ],
        ),
      ),
    );
  }

  Widget _buildDynamicListHeader(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          _currentUser?['role'] == 'professional' ? 'Latest Jobs for You' : 'Recommended for You',
          style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
        ),
        TextButton.icon(
          onPressed: () => context.push(_currentUser?['role'] == 'professional' ? '/jobs' : '/discover'),
          icon: const Text('View all', style: TextStyle(color: Color(0xFF1E40AF), fontWeight: FontWeight.bold)),
          label: const Icon(Icons.open_in_new, size: 14, color: Color(0xFF1E40AF)),
        ),
      ],
    );
  }

  Widget _buildJobsList(BuildContext context, [List<Map<String, dynamic>>? jobs]) {
    final jobRows = jobs ?? _availableJobs;
    if (jobRows.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(32),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(24), border: Border.all(color: const Color(0xFFF1F5F9))),
        child: const Center(child: Text('No active jobs found near you.')),
      );
    }
    return Column(
      children: jobRows.take(3).toList().asMap().entries.map((entry) {
        final index = entry.key;
        final job = entry.value;
        return _StaggeredReveal(
          index: index,
          child: Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: GestureDetector(
          onTap: () => context.push('/job/${job['id']}'),
          child: Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(24), border: Border.all(color: const Color(0xFFF1F5F9))),
            child: Row(
              children: [
                Container(padding: const EdgeInsets.all(12), decoration: BoxDecoration(color: const Color(0xFFEEF2FF), borderRadius: BorderRadius.circular(16)), child: const Icon(Icons.work_outline, color: Color(0xFF1E40AF))),
                const SizedBox(width: 16),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(job['title'] ?? 'Untitled Job', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)), const SizedBox(height: 4), Text('\$${job['budget'] ?? 'Negotiable'} • ${job['city'] ?? 'Remote'}', style: const TextStyle(color: Color(0xFF64748B), fontSize: 13))])),
                const Icon(Icons.chevron_right, color: Color(0xFF94A3B8)),
              ],
            ),
          ),
        ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildRecommendedList(BuildContext context) {
    if (_recommendedPros.isEmpty) {
      return Container(
        height: 150,
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(24), border: Border.all(color: const Color(0xFFF1F5F9))),
        child: const Center(child: Text('No experts found yet.')),
      );
    }
    return SizedBox(
      height: 300,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: _recommendedPros.length,
        separatorBuilder: (context, index) => const SizedBox(width: 16),
        itemBuilder: (context, index) {
          final pro = _recommendedPros[index];
          return _StaggeredReveal(
            index: index,
            child: GestureDetector(
              onTap: () => context.push('/pro/${pro['user_id']}'),
              child: Container(
              width: 260,
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(24), border: Border.all(color: const Color(0xFFF1F5F9))),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ClipRRect(
                    borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
                    child: pro['profile_photo'] == null
                        ? Container(
                            height: 150,
                            width: double.infinity,
                            color: const Color(0xFFEEF2FF),
                            child: const Icon(Icons.person_outline, size: 52, color: Color(0xFF1E40AF)),
                          )
                        : Image.network(
                            pro['profile_photo'],
                            height: 150,
                            width: double.infinity,
                            fit: BoxFit.cover,
                            errorBuilder: (context, error, stackTrace) => Container(
                              color: const Color(0xFFEEF2FF),
                              child: const Icon(Icons.person_outline, size: 52, color: Color(0xFF1E40AF)),
                            ),
                          ),
                  ),
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(pro['full_name'] ?? 'Expert', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                        const SizedBox(height: 4),
                        Text(pro['profession'] ?? 'Service Professional', style: const TextStyle(color: Color(0xFF64748B), fontSize: 13)),
                      ],
                    ),
                  )
                ],
              ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildSummaryCard(BuildContext context, {required String count, required String label, required IconData icon, required Color bgColor, required Color textColor, Color? iconColor, required VoidCallback onTap}) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: bgColor,
            borderRadius: BorderRadius.circular(24),
            border: bgColor == Colors.white ? Border.all(color: const Color(0xFFF1F5F9)) : null,
            boxShadow: bgColor == Colors.white ? [BoxShadow(color: Colors.black.withValues(alpha: 0.02), blurRadius: 10, offset: const Offset(0, 4))] : null,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, color: iconColor ?? textColor, size: 28),
              const SizedBox(height: 24),
              Text(count, style: GoogleFonts.plusJakartaSans(fontSize: 32, fontWeight: FontWeight.w800, color: textColor)),
              Text(label, style: TextStyle(color: textColor.withValues(alpha: 0.7), fontWeight: FontWeight.w600, fontSize: 13)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildQuickActionsGrid(BuildContext context) {
    final actions = [
      {'name': 'Post a Job', 'icon': Icons.add_circle_outline, 'route': '/post-job'},
      {'name': 'Search', 'icon': Icons.search_outlined, 'route': '/discover'},
      {'name': 'Categories', 'icon': Icons.grid_view_outlined, 'route': '/services'},
      {'name': 'Saved', 'icon': Icons.dashboard, 'route': '/dashboard'},
    ];
    return LayoutBuilder(
      builder: (context, constraints) {
        final columns = constraints.maxWidth >= 880 ? 4 : 2;
        return GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: columns,
            crossAxisSpacing: 14,
            mainAxisSpacing: 14,
            childAspectRatio: columns == 4 ? 2.1 : 1.7,
          ),
          itemCount: actions.length,
          itemBuilder: (context, index) => InkWell(
            onTap: () => context.push(actions[index]['route'] as String),
            borderRadius: BorderRadius.circular(18),
            child: Ink(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: const Color(0xFFE7EDF6)),
                boxShadow: const [
                  BoxShadow(color: Color(0x0D0F172A), blurRadius: 18, offset: Offset(0, 7)),
                ],
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: const BoxDecoration(color: Color(0xFFEEF2FF), shape: BoxShape.circle),
                    child: Icon(actions[index]['icon'] as IconData, color: const Color(0xFF1E40AF), size: 20),
                  ),
                  const SizedBox(width: 10),
                  Text(actions[index]['name'] as String, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF1E293B))),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildCurrentFocusList(BuildContext context) {
    if (_focusItems.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(24), border: Border.all(color: const Color(0xFFF1F5F9))),
        child: const Center(child: Text('No active focuses right now.')),
      );
    }
    return Column(
      children: _focusItems.take(2).map((job) => Padding(
        padding: const EdgeInsets.only(bottom: 16),
        child: _buildFocusItem(
          context: context, 
          title: job['title'] ?? 'Job', 
          status: (job['status'] as String).toUpperCase(), 
          progress: job['status'] == 'completed' ? 1.0 : 0.4, 
          badgeLabel: job['status'] == 'active' ? 'Recruiting' : 'In Progress', 
          badgeColor: job['status'] == 'active' ? const Color(0xFF22C55E) : const Color(0xFF3B82F6), 
          icon: Icons.rocket_launch_outlined
        ),
      )).toList(),
    );
  }

  Widget _buildFocusItem({required BuildContext context, required String title, required String status, required double progress, required String badgeLabel, required Color badgeColor, required IconData icon}) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(24), border: Border.all(color: const Color(0xFFF1F5F9))),
      child: Column(
        children: [
          Row(
            children: [
              Container(width: 44, height: 44, decoration: BoxDecoration(color: const Color(0xFFF8FAFC), borderRadius: BorderRadius.circular(12)), child: Icon(icon, color: const Color(0xFF64748B), size: 24)),
              const SizedBox(width: 16),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)), const SizedBox(height: 4), Text(status, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: badgeColor))])),
              Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6), decoration: BoxDecoration(color: badgeColor.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(8)), child: Text(badgeLabel, style: TextStyle(color: badgeColor, fontSize: 10, fontWeight: FontWeight.w900))),
            ],
          ),
          const SizedBox(height: 20),
          Stack(
            children: [
              Container(height: 6, decoration: BoxDecoration(color: const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(10))),
              FractionallySizedBox(widthFactor: progress, child: Container(height: 6, decoration: BoxDecoration(color: const Color(0xFF0F172A), borderRadius: BorderRadius.circular(10)))),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildBottomNav(BuildContext context) {
    return Container(
      padding: const EdgeInsets.only(top: 12, bottom: 24),
      decoration: const BoxDecoration(color: Colors.white, border: Border(top: BorderSide(color: Color(0xFFF1F5F9)))),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _navItem(context, Icons.home, 'HOME', true, '/'),
          _navItem(context, Icons.search, 'SEARCH', false, '/discover'),
          _navItem(context, Icons.work_outline, 'JOBS', false, '/jobs'),
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

  Widget _buildLatestJobsHeader(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        const Text(
          'Latest Jobs',
          style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
        ),
        TextButton.icon(
          onPressed: () => context.push('/jobs'),
          icon: const Text('View all', style: TextStyle(color: Color(0xFF1E40AF), fontWeight: FontWeight.bold)),
          label: const Icon(Icons.open_in_new, size: 14, color: Color(0xFF1E40AF)),
        ),
      ],
    );
  }

  Widget _buildPublicJobsList(BuildContext context) {
    if (_publicJobs.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(32),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(24), border: Border.all(color: const Color(0xFFF1F5F9))),
        child: const Center(child: Text('No open jobs yet.')),
      );
    }
    return _buildJobsList(context, _publicJobs);
  }
}

/// Adds a light staggered entrance without changing the page layout or cards.
class _StaggeredReveal extends StatefulWidget {
  const _StaggeredReveal({required this.index, required this.child});

  final int index;
  final Widget child;

  @override
  State<_StaggeredReveal> createState() => _StaggeredRevealState();
}

class _StaggeredRevealState extends State<_StaggeredReveal> {
  bool _isHovered = false;

  @override
  Widget build(BuildContext context) {
    final start = (widget.index * 0.12).clamp(0.0, 0.72).toDouble();
    return MouseRegion(
      cursor: SystemMouseCursors.click,
      onEnter: (_) => setState(() => _isHovered = true),
      onExit: (_) => setState(() => _isHovered = false),
      child: TweenAnimationBuilder<double>(
      duration: Duration(milliseconds: 650 + widget.index * 80),
      curve: Interval(start, 1, curve: Curves.easeOutCubic),
      tween: Tween(begin: 0, end: 1),
      child: AnimatedScale(
        duration: const Duration(milliseconds: 180),
        curve: Curves.easeOut,
        scale: _isHovered ? 1.025 : 1,
        child: widget.child,
      ),
      builder: (context, value, animatedChild) => Opacity(
        opacity: value,
        child: Transform.translate(
          offset: Offset(0, 28 * (1 - value)),
          child: animatedChild,
        ),
      ),
      ),
    );
  }
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
