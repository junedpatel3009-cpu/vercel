import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/theme/app_theme.dart';
import '../../core/database/database_helper.dart';

class ProjectScreen extends StatefulWidget {
  final String projectId;
  const ProjectScreen({super.key, required this.projectId});

  @override
  State<ProjectScreen> createState() => _ProjectScreenState();
}

class _ProjectScreenState extends State<ProjectScreen> {
  Map<String, dynamic>? _project;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadProject();
  }

  Future<void> _loadProject() async {
    final db = DatabaseHelper();
    final jobIdInt = int.tryParse(widget.projectId) ?? 0;
    final job = await db.getJob(jobIdInt);
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
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildStatusCard(),
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
