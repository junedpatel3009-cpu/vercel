import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/api/api_client.dart';
import '../../core/auth/auth_service.dart';
import '../../core/theme/app_theme.dart';
import '../../widgets/motion.dart';

class JobsScreen extends StatefulWidget {
  const JobsScreen({super.key});

  @override
  State<JobsScreen> createState() => _JobsScreenState();
}

class _JobsScreenState extends State<JobsScreen> {
  List<Map<String, dynamic>> _jobs = [];
  bool _loading = true;
  bool _isClient = false;
  String _query = '';
  String _filter = 'All';

  @override
  void initState() {
    super.initState();
    _loadJobs();
  }

  Future<void> _loadJobs() async {
    try {
      final user = await AuthService().getUser();
      final isClient = user?['role'].toString().toLowerCase() == 'client';
      List<Map<String, dynamic>> jobs;
      // The bottom Jobs tab is the marketplace: every client can browse all
      // open jobs posted by clients. Client project tracking remains on the
      // dashboard rather than being mixed into this list.
      jobs = await ApiClient.instance.getList('/api/v1/jobs', authenticated: false);
      if (mounted) setState(() { _jobs = jobs; _isClient = isClient; });
    } on ApiException catch (error) {
      if (mounted && error.statusCode != 401) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<Map<String, dynamic>> get _visibleJobs {
    return _jobs.where((job) {
      final queryText = '${job['title']} ${job['category']} ${job['description']}'.toLowerCase();
      if (_query.isNotEmpty && !queryText.contains(_query.toLowerCase())) return false;
      final project = job['project'] as Map?;
      final status = (job['status'] ?? '').toString().toUpperCase();
      return switch (_filter) {
        'Running' => project != null && (project['status'] ?? '').toString().toUpperCase() == 'ACTIVE',
        'Hiring' => project == null && status == 'OPEN',
        'Completed' => project != null && (project['status'] ?? '').toString().toUpperCase() != 'ACTIVE',
        _ => true,
      };
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF7F9FD),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: const Text('Jobs', style: TextStyle(color: AppTheme.brandNavy, fontWeight: FontWeight.w800)),
        leading: IconButton(icon: const Icon(Icons.arrow_back, color: AppTheme.brandNavy), onPressed: () => context.canPop() ? context.pop() : context.go('/')),
        actions: _isClient ? [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: ElevatedButton.icon(
              onPressed: () => context.push('/post-job'),
              icon: const Icon(Icons.add, size: 18),
              label: const Text('New'),
              style: ElevatedButton.styleFrom(backgroundColor: AppTheme.brandBlue, foregroundColor: Colors.white, minimumSize: Size.zero),
            ),
          ),
        ] : null,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _buildProfessionalJobs(),
    );
  }

  Widget _buildClientBoard() {
    final running = _jobs.where((job) => job['project'] is Map && ((job['project'] as Map)['status'] ?? '').toString().toUpperCase() == 'ACTIVE').length;
    final hiring = _jobs.where((job) => job['project'] == null && (job['status'] ?? '').toString().toUpperCase() == 'OPEN').length;
    final completed = _jobs.where((job) => job['project'] is Map && ((job['project'] as Map)['status'] ?? '').toString().toUpperCase() != 'ACTIVE').length;
    return RefreshIndicator(
      onRefresh: _loadJobs,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
        children: [
          const Text('Your project workspace', style: TextStyle(fontSize: 26, fontWeight: FontWeight.w900, color: AppTheme.brandNavy)),
          const SizedBox(height: 6),
          const Text('Track progress, work with hired professionals, and keep every deadline in view.', style: TextStyle(color: AppTheme.textGray, height: 1.45)),
          const SizedBox(height: 20),
          Row(children: [
            _statCard('$running', 'Running', const Color(0xFF0F8C77), Icons.rocket_launch_outlined),
            const SizedBox(width: 10),
            _statCard('$hiring', 'Hiring', const Color(0xFF2450B8), Icons.person_search_outlined),
            const SizedBox(width: 10),
            _statCard('$completed', 'Done', const Color(0xFF7C3AED), Icons.task_alt_outlined),
          ]),
          const SizedBox(height: 20),
          TextField(
            onChanged: (value) => setState(() => _query = value),
            decoration: InputDecoration(
              hintText: 'Search your projects',
              prefixIcon: const Icon(Icons.search),
              filled: true,
              fillColor: Colors.white,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
            ),
          ),
          const SizedBox(height: 14),
          SingleChildScrollView(scrollDirection: Axis.horizontal, child: Row(children: ['All', 'Running', 'Hiring', 'Completed'].map(_filterChip).toList())),
          const SizedBox(height: 22),
          Text(_filter == 'All' ? 'All projects' : '$_filter projects', style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w800, color: AppTheme.brandNavy)),
          const SizedBox(height: 12),
          if (_visibleJobs.isEmpty) _emptyBoard() else ..._visibleJobs.asMap().entries.map((entry) => FadeSlideIn(delay: Duration(milliseconds: entry.key * 55), child: _projectCard(entry.value))),
        ],
      ),
    );
  }

  Widget _statCard(String value, String label, Color color, IconData icon) => Expanded(child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(17), border: Border.all(color: const Color(0xFFE5EAF2))),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Icon(icon, color: color, size: 21), const SizedBox(height: 14), Text(value, style: TextStyle(fontSize: 25, fontWeight: FontWeight.w900, color: color)), Text(label, style: const TextStyle(fontSize: 11, color: AppTheme.textGray, fontWeight: FontWeight.w600)),
        ]),
      ));

  Widget _filterChip(String label) => Padding(
        padding: const EdgeInsets.only(right: 8),
        child: ChoiceChip(label: Text(label), selected: _filter == label, onSelected: (_) => setState(() => _filter = label), selectedColor: const Color(0xFF2450B8), labelStyle: TextStyle(color: _filter == label ? Colors.white : AppTheme.brandNavy, fontWeight: FontWeight.w700), backgroundColor: Colors.white, side: const BorderSide(color: Color(0xFFE0E7F1))),
      );

  Widget _projectCard(Map<String, dynamic> job) {
    final project = job['project'] as Map?;
    final isRunning = project != null && (project['status'] ?? '').toString().toUpperCase() == 'ACTIVE';
    final label = isRunning ? 'IN PROGRESS' : project != null ? 'COMPLETED' : (job['status'] ?? 'OPEN').toString().replaceAll('_', ' ');
    final color = isRunning ? const Color(0xFF0F8C77) : project != null ? const Color(0xFF7C3AED) : const Color(0xFF2450B8);
    final deadline = DateTime.tryParse((job['deadline'] ?? '').toString());
    final progress = isRunning ? .58 : project != null ? 1.0 : .14;
    final proName = project?['professionalName']?.toString();
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22), border: Border.all(color: const Color(0xFFE4EAF3)), boxShadow: const [BoxShadow(color: Color(0x080F172A), blurRadius: 16, offset: Offset(0, 5))]),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Text((job['title'] ?? 'Untitled project').toString(), maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppTheme.brandNavy))),
          Container(padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5), decoration: BoxDecoration(color: color.withValues(alpha: .12), borderRadius: BorderRadius.circular(20)), child: Text(label, style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.w900))),
        ]),
        const SizedBox(height: 5),
        Text((job['category'] ?? 'Project').toString(), style: const TextStyle(color: AppTheme.textGray, fontWeight: FontWeight.w600)),
        const SizedBox(height: 18),
        if (project != null) _professionalRow(project, color) else _hirePrompt(),
        const SizedBox(height: 18),
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Text(isRunning ? 'Project progress' : project != null ? 'Project complete' : 'Ready to hire', style: const TextStyle(fontSize: 12, color: AppTheme.textGray, fontWeight: FontWeight.w600)),
          Text('${(progress * 100).round()}%', style: TextStyle(fontSize: 12, color: color, fontWeight: FontWeight.w800)),
        ]),
        const SizedBox(height: 7),
        ClipRRect(borderRadius: BorderRadius.circular(10), child: LinearProgressIndicator(value: progress, minHeight: 7, backgroundColor: const Color(0xFFE9EEF5), color: color)),
        const SizedBox(height: 16),
        Row(children: [
          Icon(Icons.calendar_today_outlined, size: 15, color: color), const SizedBox(width: 6), Text(deadline == null ? 'Deadline not set' : 'Due ${DateFormat.MMMd().format(deadline)}', style: const TextStyle(fontSize: 12, color: AppTheme.textGray)),
          const Spacer(), Text('\$${job['budgetMin'] ?? 0}–\$${job['budgetMax'] ?? 0}', style: const TextStyle(fontWeight: FontWeight.w800, color: AppTheme.brandNavy)),
        ]),
        const SizedBox(height: 17),
        Row(children: [
          Expanded(
            child: OutlinedButton(
              onPressed: () => context.push('${project != null ? '/project' : '/job'}/${job['id']}'),
              child: Text(project != null ? 'View project' : 'View job'),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(child: ElevatedButton.icon(onPressed: project != null ? () => context.push('/messages?proId=${project['professionalId']}&name=${Uri.encodeComponent(proName ?? 'Professional')}') : () => context.push('/discover'), icon: Icon(project != null ? Icons.chat_bubble_outline : Icons.person_search_outlined, size: 17), label: Text(project != null ? 'Message' : 'Find pro'), style: ElevatedButton.styleFrom(backgroundColor: AppTheme.brandBlue, foregroundColor: Colors.white))),
        ]),
      ]),
    );
  }

  Widget _professionalRow(Map project, Color color) => Row(children: [
        CircleAvatar(radius: 21, backgroundColor: color.withValues(alpha: .12), backgroundImage: (project['professionalAvatar'] ?? '').toString().startsWith('http') ? NetworkImage(project['professionalAvatar'].toString()) : null, child: (project['professionalAvatar'] ?? '').toString().startsWith('http') ? null : Icon(Icons.person_outline, color: color)),
        const SizedBox(width: 11), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [const Text('Working with', style: TextStyle(fontSize: 11, color: AppTheme.textGray)), Text((project['professionalName'] ?? 'Professional').toString(), style: const TextStyle(fontWeight: FontWeight.w800))])),
        Icon(Icons.verified_rounded, color: color, size: 19),
      ]);

  Widget _hirePrompt() => const Row(children: [
        CircleAvatar(radius: 21, backgroundColor: Color(0xFFEAF0FF), child: Icon(Icons.person_add_alt_1_outlined, color: AppTheme.brandBlue)),
        SizedBox(width: 11), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('No professional hired yet', style: TextStyle(fontWeight: FontWeight.w800)), Text('Compare experts and send a hire request.', style: TextStyle(fontSize: 12, color: AppTheme.textGray))])),
      ]);

  Widget _emptyBoard() => Container(padding: const EdgeInsets.all(32), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20)), child: Column(children: [const Icon(Icons.folder_open_outlined, size: 48, color: AppTheme.textGray), const SizedBox(height: 12), const Text('No projects here yet', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 17)), const SizedBox(height: 5), const Text('Post a project to start hiring trusted professionals.', textAlign: TextAlign.center, style: TextStyle(color: AppTheme.textGray)), const SizedBox(height: 16), ElevatedButton(onPressed: () => context.push('/post-job'), child: const Text('Post a project'))]));

  Widget _buildProfessionalJobs() => RefreshIndicator(onRefresh: _loadJobs, child: ListView.builder(padding: const EdgeInsets.all(20), itemCount: _visibleJobs.length, itemBuilder: (_, index) { final job = _visibleJobs[index]; return Card(child: ListTile(title: Text(job['title'] ?? 'Untitled job'), subtitle: Text(job['category'] ?? 'Project'), trailing: const Icon(Icons.chevron_right), onTap: () => context.push('/job/${job['id']}'))); }));
}
