import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_client.dart';
import '../../core/theme/app_theme.dart';

class ClientReportsScreen extends StatefulWidget {
  const ClientReportsScreen({super.key});

  @override
  State<ClientReportsScreen> createState() => _ClientReportsScreenState();
}

class _ClientReportsScreenState extends State<ClientReportsScreen> {
  bool _loading = true;
  List<Map<String, dynamic>> _jobs = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final jobs = await ApiClient.instance.getList('/api/v1/client/jobs');
      if (mounted) setState(() => _jobs = jobs);
    } on ApiException catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final open = _jobs.where((job) => ['OPEN', 'ACTIVE', 'ASSIGNED', 'IN_PROGRESS'].contains((job['status'] ?? '').toString().toUpperCase())).length;
    final closed = _jobs.where((job) => (job['status'] ?? '').toString().toUpperCase() == 'CLOSED').length;
    final budget = _jobs.fold<double>(0, (total, job) => total + _budgetFor(job));

    return Scaffold(
      backgroundColor: AppTheme.bgLight,
      appBar: AppBar(
        title: const Text('Project reports'),
        leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => context.pop()),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(20),
                children: [
                  const Text('Your hiring overview', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: AppTheme.brandNavy)),
                  const SizedBox(height: 7),
                  const Text('Live totals from your posted projects.', style: TextStyle(color: AppTheme.textGray)),
                  const SizedBox(height: 20),
                  _metric('Total projects', _jobs.length.toString(), Icons.business_center_outlined, const Color(0xFF2450B8)),
                  _metric('Active projects', open.toString(), Icons.timelapse_rounded, const Color(0xFF0F8C77)),
                  _metric('Completed projects', closed.toString(), Icons.task_alt_rounded, const Color(0xFF7C3AED)),
                  _metric('Planned budget', '\$${budget.toStringAsFixed(0)}', Icons.account_balance_wallet_outlined, const Color(0xFFB45309)),
                  const SizedBox(height: 18),
                  OutlinedButton.icon(
                    onPressed: () => context.push('/jobs'),
                    icon: const Icon(Icons.list_alt_rounded),
                    label: const Text('View all projects'),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _metric(String label, String value, IconData icon, Color color) => Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18), border: Border.all(color: const Color(0xFFE4EAF3))),
        child: Row(children: [
          Container(padding: const EdgeInsets.all(11), decoration: BoxDecoration(color: color.withValues(alpha: .12), borderRadius: BorderRadius.circular(12)), child: Icon(icon, color: color)),
          const SizedBox(width: 14),
          Expanded(child: Text(label, style: const TextStyle(fontWeight: FontWeight.w600, color: AppTheme.textGray))),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 21, color: AppTheme.brandNavy)),
        ]),
      );

  double _budgetFor(Map<String, dynamic> job) {
    return double.tryParse((job['budgetMax'] ?? job['budgetMin'] ?? 0).toString()) ?? 0;
  }
}
