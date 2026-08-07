import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/theme/app_theme.dart';
import '../../core/database/database_helper.dart';
import '../../core/api/api_client.dart';

class ProjectScreen extends StatefulWidget {
  final String projectId;
  const ProjectScreen({super.key, required this.projectId});

  @override
  State<ProjectScreen> createState() => _ProjectScreenState();
}

class _ProjectScreenState extends State<ProjectScreen> {
  Map<String, dynamic>? _project;
  int _requestCount = 0;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadProject();
  }

  Future<void> _loadProject() async {
    final jobIdInt = int.tryParse(widget.projectId) ?? 0;
    Map<String, dynamic>? job;

    try {
      // Fetch the core client-jobs list here. Project-board enrichment is
      // optional and can be unavailable before a hire/project exists.
      final jobs = await ApiClient.instance.getList('/api/v1/client/jobs');
      for (final item in jobs) {
        if (item['id'] == jobIdInt) {
          job = item;
          break;
        }
      }
      final requests = await ApiClient.instance.getList('/api/v1/client/applications');
      _requestCount = requests.where((item) => item['jobId'] == jobIdInt).length;
    } on ApiException {
      // Offline/local data remains useful when the server cannot be reached.
    }

    job ??= await DatabaseHelper().getJob(jobIdInt);
    if (mounted) {
      setState(() {
        _project = job;
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    if (_project == null) return const Scaffold(body: Center(child: Text('Project not found')));

    return Scaffold(
      backgroundColor: AppTheme.bgLight,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: Text('Project Status', style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w900, color: AppTheme.brandNavy)),
        leading: IconButton(icon: const Icon(Icons.arrow_back, color: AppTheme.brandNavy), onPressed: () => context.canPop() ? context.pop() : context.go('/projects')),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildStatusCard(),
            const SizedBox(height: 20),
            _buildProjectDetails(),
            const SizedBox(height: 32),
            const Text('Milestones', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
            const SizedBox(height: 16),
            _buildMilestone('Project Started', 'The project was assigned and kick-off meeting held.', true),
            _buildMilestone('Planning phase', 'Resource allocation and schedule confirmed.', true),
            _buildMilestone('Execution', 'In progress...', false),
            _buildMilestone('Final Review', 'Pending', false),
          ],
        ),
      ),
    );
  }

  Widget _buildStatusCard() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(24), border: Border.all(color: const Color(0xFFF1F5F9))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(_project!['title'] ?? 'Project', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          Text(_project!['status']?.toUpperCase() ?? 'ACTIVE', style: const TextStyle(color: AppTheme.brandBlue, fontWeight: FontWeight.bold, fontSize: 12)),
          const SizedBox(height: 24),
          const LinearProgressIndicator(value: 0.5, minHeight: 8, borderRadius: BorderRadius.all(Radius.circular(10))),
          const SizedBox(height: 12),
          const Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Overall Progress', style: TextStyle(color: AppTheme.textGray, fontSize: 13)),
              Text('50%', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
            ],
          )
        ],
      ),
    );
  }

  Widget _buildProjectDetails() {
    final budgetMin = _project!['budgetMin'] ?? _project!['min_budget'];
    final budgetMax = _project!['budgetMax'] ?? _project!['max_budget'];
    final deadline = _project!['deadline'] ?? _project!['start_date'];
    final location = _project!['locationLabel'] ?? _project!['city'] ?? _project!['address'];
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), border: Border.all(color: const Color(0xFFF1F5F9))),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Project details', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
        const SizedBox(height: 12),
        _detail(Icons.group_outlined, 'Hire requests', '$_requestCount'),
        _detail(Icons.account_balance_wallet_outlined, 'Budget', '${budgetMin ?? 0} – ${budgetMax ?? 0}'),
        _detail(Icons.calendar_today_outlined, 'Deadline', deadline?.toString().isNotEmpty == true ? deadline.toString() : 'Not set'),
        _detail(Icons.location_on_outlined, 'Location', location?.toString().isNotEmpty == true ? location.toString() : 'Remote'),
      ]),
    );
  }

  Widget _detail(IconData icon, String label, String value) => Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: Row(children: [Icon(icon, size: 18, color: AppTheme.brandBlue), const SizedBox(width: 10), Text('$label: ', style: const TextStyle(fontWeight: FontWeight.w700)), Expanded(child: Text(value, style: const TextStyle(color: AppTheme.textGray)))]),
  );

  Widget _buildMilestone(String title, String subtitle, bool completed) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 24),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(completed ? Icons.check_circle : Icons.radio_button_unchecked, color: completed ? Colors.green : Colors.grey[300]),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: TextStyle(fontWeight: FontWeight.bold, decoration: completed ? TextDecoration.lineThrough : null)),
                Text(subtitle, style: const TextStyle(color: AppTheme.textGray, fontSize: 13)),
              ],
            ),
          )
        ],
      ),
    );
  }
}
