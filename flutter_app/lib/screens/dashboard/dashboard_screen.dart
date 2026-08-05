import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/api/api_client.dart';
import '../../core/auth/auth_service.dart';
import '../../core/theme/app_theme.dart';

/// Live client workspace opened from the profile icon.
class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  bool _loading = true;
  Map<String, dynamic>? _user;
  List<Map<String, dynamic>> _projects = [];
  Map<String, dynamic> _finance = {};

  @override
  void initState() {
    super.initState();
    _loadDashboard();
  }

  Future<void> _loadDashboard() async {
    final user = await AuthService().getUser();
    if (mounted) {
      setState(() => _user = user);
    }
    try {
      final results = await Future.wait([
        _loadProjects(),
        _loadFinance(),
      ]);
      if (mounted) {
        setState(() {
          _user = user;
          _projects = results[0] as List<Map<String, dynamic>>;
          _finance = Map<String, dynamic>.from(results[1] as Map);
        });
      }
    } on ApiException catch (error) {
      if (mounted && error.statusCode != 401) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
      }
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  Future<List<Map<String, dynamic>>> _loadProjects() async {
    try {
      return await ApiClient.instance.getList('/api/v1/client/project-board');
    } on ApiException {
      // The project-board enrichment can be unavailable before a hire exists.
      // The user's own saved jobs remain a reliable fallback.
      return ApiClient.instance.getList('/api/v1/client/jobs');
    }
  }

  Future<Map<String, dynamic>> _loadFinance() async {
    try {
      return await ApiClient.instance.get('/api/v1/client/finance');
    } on ApiException {
      return <String, dynamic>{'totals': <String, dynamic>{}};
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(backgroundColor: AppTheme.bgLight, body: Center(child: CircularProgressIndicator()));
    }
    final metrics = _metrics;
    final name = (_user?['firstName'] ?? _user?['full_name'] ?? _user?['name'] ?? 'there').toString().split(' ').first;
    return Scaffold(
      backgroundColor: const Color(0xFFF7F9FD),
      appBar: AppBar(
        backgroundColor: Colors.white, elevation: 0,
        title: const Text('Client dashboard', style: TextStyle(fontWeight: FontWeight.w800, color: AppTheme.brandNavy)),
        leading: IconButton(icon: const Icon(Icons.arrow_back, color: AppTheme.brandNavy), onPressed: () => context.go('/')),
      ),
      body: RefreshIndicator(
        onRefresh: _loadDashboard,
        child: ListView(padding: const EdgeInsets.fromLTRB(20, 15, 20, 32), children: [
          Text('Welcome back, $name', style: const TextStyle(fontSize: 25, fontWeight: FontWeight.w900, color: AppTheme.brandNavy)),
          const SizedBox(height: 6),
          const Text('Here is what is happening with your projects today.', style: TextStyle(color: AppTheme.textGray)),
          const SizedBox(height: 20),
          Row(children: [
            _stat('${metrics.running}', 'Running projects', Icons.rocket_launch_outlined, const Color(0xFF0F8C77)),
            const SizedBox(width: 11),
            _stat('${metrics.hiring}', 'Waiting to hire', Icons.person_search_outlined, const Color(0xFF2450B8)),
          ]),
          const SizedBox(height: 11),
          Row(children: [
            _stat(_money(metrics.paid), 'Paid to pros', Icons.payments_outlined, const Color(0xFF7C3AED)),
            const SizedBox(width: 11),
            _stat(_money(metrics.committed), 'Project budget', Icons.account_balance_wallet_outlined, const Color(0xFFB45309)),
          ]),
          const SizedBox(height: 24),
          _latestActivity(metrics),
          const SizedBox(height: 25),
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            const Text('Current projects', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: AppTheme.brandNavy)),
            TextButton(onPressed: () => context.push('/jobs'), child: const Text('View all')),
          ]),
          const SizedBox(height: 10),
          if (_projects.isEmpty) _emptyProjects() else ..._projects.take(3).map(_projectCard),
          const SizedBox(height: 12),
          SizedBox(width: double.infinity, child: OutlinedButton.icon(onPressed: () => context.push('/reports'), icon: const Icon(Icons.picture_as_pdf_outlined), label: const Text('Open reports & download PDF'))),
        ]),
      ),
    );
  }

  Widget _stat(String value, String label, IconData icon, Color color) => Expanded(child: Container(
        padding: const EdgeInsets.all(16), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18), border: Border.all(color: const Color(0xFFE5EAF2))),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Icon(icon, color: color), const SizedBox(height: 14), Text(value, style: TextStyle(fontSize: 21, fontWeight: FontWeight.w900, color: color)), const SizedBox(height: 3), Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppTheme.textGray))]),
      ));

  Widget _latestActivity(_Metrics metrics) {
    final active = _projects.where((job) => job['project'] is Map && ((job['project'] as Map)['status'] ?? '').toString().toUpperCase() == 'ACTIVE').cast<Map<String, dynamic>>().firstOrNull;
    final title = active?['title']?.toString() ?? (metrics.hiring > 0 ? '$metrics.hiring project${metrics.hiring == 1 ? '' : 's'} ready to hire' : 'Your project workspace is ready');
    final message = active == null ? 'Find the right professional, compare profiles, and send a hire request.' : '${(active['project'] as Map)['professionalName'] ?? 'Your professional'} is working on this project.';
    return Container(
      padding: const EdgeInsets.all(19),
      decoration: BoxDecoration(
        color: const Color(0xFFEAF1FF),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: const BoxDecoration(
              color: Color(0xFF2450B8),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.notifications_active_outlined,
              color: Colors.white,
              size: 20,
            ),
          ),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'LATEST ACTIVITY',
                  style: TextStyle(
                    fontSize: 10,
                    letterSpacing: 1,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF2450B8),
                  ),
                ),
                const SizedBox(height: 5),
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: AppTheme.brandNavy,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  message,
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppTheme.textGray,
                    height: 1.35,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _projectCard(Map<String, dynamic> job) {
    final project = job['project'] as Map?;
    final running = project != null && (project['status'] ?? '').toString().toUpperCase() == 'ACTIVE';
    final progress = running ? .58 : project == null ? .12 : 1.0;
    final color = running ? const Color(0xFF0F8C77) : project == null ? const Color(0xFF2450B8) : const Color(0xFF7C3AED);
    final deadline = DateTime.tryParse((job['deadline'] ?? '').toString());
    return Container(margin: const EdgeInsets.only(bottom: 12), padding: const EdgeInsets.all(17), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(19), border: Border.all(color: const Color(0xFFE5EAF2))), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [Expanded(child: Text((job['title'] ?? 'Project').toString(), maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: AppTheme.brandNavy))), Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4), decoration: BoxDecoration(color: color.withValues(alpha: .13), borderRadius: BorderRadius.circular(12)), child: Text(running ? 'RUNNING' : project == null ? 'HIRING' : 'DONE', style: TextStyle(fontSize: 9, color: color, fontWeight: FontWeight.w900)))]),
      const SizedBox(height: 11),
      Text(project == null ? 'No professional hired yet' : 'Working with ${project['professionalName'] ?? 'Professional'}', style: const TextStyle(color: AppTheme.textGray)),
      const SizedBox(height: 13), LinearProgressIndicator(value: progress, minHeight: 6, borderRadius: BorderRadius.circular(10), color: color, backgroundColor: const Color(0xFFE9EEF5)),
      const SizedBox(height: 9), Row(children: [Icon(Icons.calendar_today_outlined, size: 14, color: color), const SizedBox(width: 5), Text(deadline == null ? 'Deadline not set' : 'Due ${DateFormat.MMMd().format(deadline)}', style: const TextStyle(fontSize: 12, color: AppTheme.textGray)), const Spacer(), TextButton(onPressed: () => context.push('/job/${job['id']}'), child: const Text('Open'))]),
    ]));
  }

  Widget _emptyProjects() => Container(padding: const EdgeInsets.all(27), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(19)), child: Column(children: [const Icon(Icons.folder_open_outlined, color: AppTheme.textGray, size: 43), const SizedBox(height: 10), const Text('No projects yet', style: TextStyle(fontWeight: FontWeight.w800)), TextButton(onPressed: () => context.push('/post-job'), child: const Text('Post your first project'))]));

  _Metrics get _metrics {
    final running = _projects.where((job) => job['project'] is Map && ((job['project'] as Map)['status'] ?? '').toString().toUpperCase() == 'ACTIVE').length;
    final hiring = _projects.where((job) => job['project'] == null && (job['status'] ?? '').toString().toUpperCase() == 'OPEN').length;
    final totals = Map<String, dynamic>.from(_finance['totals'] as Map? ?? {});
    return _Metrics(running, hiring, _number(totals['paid']), _number(totals['committed']));
  }
  double _number(dynamic value) => double.tryParse((value ?? 0).toString()) ?? 0;
  String _money(double value) => '\$${value.toStringAsFixed(0)}';
}

class _Metrics { const _Metrics(this.running, this.hiring, this.paid, this.committed); final int running; final int hiring; final double paid; final double committed; }

extension _FirstOrNull<T> on Iterable<T> { T? get firstOrNull => isEmpty ? null : first; }
