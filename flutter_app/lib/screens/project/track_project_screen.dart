import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/api/api_client.dart';
import '../../core/theme/app_theme.dart';

/// Live project-tracking view backed by the ProjectTracking database record.
class TrackProjectScreen extends StatefulWidget {
  const TrackProjectScreen({super.key, required this.trackingId});

  final String trackingId;

  @override
  State<TrackProjectScreen> createState() => _TrackProjectScreenState();
}

class _TrackProjectScreenState extends State<TrackProjectScreen> {
  Map<String, dynamic>? _tracking;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadTracking();
  }

  Future<void> _loadTracking() async {
    try {
      final tracking = await ApiClient.instance.get(
        '/api/v1/project-tracking/${widget.trackingId}',
      );
      if (mounted) setState(() => _tracking = tracking);
    } on ApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    if (_tracking == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Track project')),
        body: const Center(child: Text('Project tracking details are not available.')),
      );
    }

    final tracking = _tracking!;
    final milestones = _records(tracking['milestones']);
    final uploads = _records(tracking['workUploads']);
    final revisions = _records(tracking['revisionRequests']);
    final completed = milestones.where((item) => _status(item) == 'PAID').length;
    final progress = (tracking['status'] ?? '').toString().toUpperCase() == 'COMPLETED'
        ? 1.0
        : milestones.isEmpty
            ? 0.0
            : completed / milestones.length;
    final projectTitle = (tracking['projectTitle'] ?? 'Project').toString();
    final professional = (tracking['professionalName'] ?? 'Professional').toString();

    return Scaffold(
      backgroundColor: AppTheme.bgLight,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: const Text('Track project', style: TextStyle(color: AppTheme.brandNavy, fontWeight: FontWeight.w800)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppTheme.brandNavy),
          onPressed: () => context.canPop() ? context.pop() : context.go('/dashboard'),
        ),
      ),
      body: RefreshIndicator(
        onRefresh: _loadTracking,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
          children: [
            _hero(projectTitle, professional, progress, tracking),
            const SizedBox(height: 20),
            _detailsCard(tracking),
            const SizedBox(height: 24),
            _sectionTitle('Milestones', '$completed/${milestones.length} completed'),
            const SizedBox(height: 10),
            if (milestones.isEmpty)
              _emptyCard('Milestones have not been added yet.')
            else
              ...milestones.map(_milestoneCard),
            const SizedBox(height: 24),
            _sectionTitle('Work updates', '${uploads.length} update${uploads.length == 1 ? '' : 's'}'),
            const SizedBox(height: 10),
            if (uploads.isEmpty)
              _emptyCard('No work updates have been shared yet.')
            else
              ...uploads.map(_workUpdateCard),
            if (revisions.isNotEmpty) ...[
              const SizedBox(height: 24),
              _sectionTitle('Revision requests', '${revisions.length}'),
              const SizedBox(height: 10),
              ...revisions.map((revision) => _activityCard(
                    Icons.restart_alt_rounded,
                    (revision['note'] ?? 'Revision requested').toString(),
                    _date(revision['createdAt']),
                    const Color(0xFFB45309),
                  )),
            ],
            const SizedBox(height: 18),
            SizedBox(
              height: 50,
              child: ElevatedButton.icon(
                onPressed: () => context.push('/messages?proId=${tracking['professionalId']}&name=${Uri.encodeComponent(professional)}'),
                icon: const Icon(Icons.chat_bubble_outline),
                label: const Text('Message professional'),
                style: ElevatedButton.styleFrom(backgroundColor: AppTheme.brandBlue, foregroundColor: Colors.white),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _hero(String title, String professional, double progress, Map<String, dynamic> tracking) {
    final status = (tracking['status'] ?? 'ACTIVE').toString().replaceAll('_', ' ');
    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        gradient: const LinearGradient(colors: [Color(0xFF1E3A8A), Color(0xFF2450B8)]),
        borderRadius: BorderRadius.circular(24),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(status.toUpperCase(), style: TextStyle(color: Colors.white.withValues(alpha: .72), fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 1)),
        const SizedBox(height: 8),
        Text(title, style: const TextStyle(color: Colors.white, fontSize: 23, fontWeight: FontWeight.w900)),
        const SizedBox(height: 5),
        Text('Working with $professional', style: TextStyle(color: Colors.white.withValues(alpha: .82))),
        const SizedBox(height: 22),
        ClipRRect(borderRadius: BorderRadius.circular(8), child: LinearProgressIndicator(value: progress, minHeight: 8, color: Colors.white, backgroundColor: Colors.white24)),
        const SizedBox(height: 8),
        Text('${(progress * 100).round()}% milestone progress', style: TextStyle(color: Colors.white.withValues(alpha: .88), fontSize: 12, fontWeight: FontWeight.w700)),
      ]),
    );
  }

  Widget _detailsCard(Map<String, dynamic> tracking) => Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), border: Border.all(color: const Color(0xFFE5EAF2))),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Project details', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppTheme.brandNavy)),
          const SizedBox(height: 14),
          _detail(Icons.account_balance_wallet_outlined, 'Agreed value', _money(tracking['bidAmount'] ?? tracking['projectBudgetMax'] ?? tracking['projectBudgetMin'])),
          _detail(Icons.calendar_today_outlined, 'Deadline', _date(tracking['projectDeadline'])),
          _detail(Icons.location_on_outlined, 'Location', (tracking['projectLocationLabel'] ?? 'Remote').toString()),
          _detail(Icons.work_outline, 'Work mode', (tracking['projectWorkMode'] ?? 'Not set').toString()),
        ]),
      );

  Widget _milestoneCard(Map<String, dynamic> milestone) {
    final status = _status(milestone);
    final paid = status == 'PAID';
    final active = status == 'IN_PROGRESS';
    final color = paid ? const Color(0xFF0F8C77) : active ? AppTheme.brandBlue : AppTheme.textGray;
    return _activityCard(
      paid ? Icons.check_circle_rounded : active ? Icons.timelapse_rounded : Icons.radio_button_unchecked,
      (milestone['title'] ?? 'Milestone').toString(),
      '${_money(milestone['amount'])}  •  ${_date(milestone['dueDate'])}  •  ${status.replaceAll('_', ' ')}',
      color,
    );
  }

  Widget _workUpdateCard(Map<String, dynamic> upload) => _activityCard(
        Icons.upload_file_outlined,
        (upload['title'] ?? upload['fileName'] ?? 'Work update').toString(),
        _date(upload['createdAt']),
        AppTheme.brandBlue,
      );

  Widget _activityCard(IconData icon, String title, String subtitle, Color color) => Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(15),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(17), border: Border.all(color: const Color(0xFFE5EAF2))),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Icon(icon, color: color, size: 22),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: const TextStyle(fontWeight: FontWeight.w800, color: AppTheme.brandNavy)), const SizedBox(height: 3), Text(subtitle, style: const TextStyle(color: AppTheme.textGray, fontSize: 12))])),
        ]),
      );

  Widget _sectionTitle(String title, String trailing) => Row(children: [Text(title, style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w800, color: AppTheme.brandNavy)), const Spacer(), Text(trailing, style: const TextStyle(color: AppTheme.textGray, fontSize: 12))]);
  Widget _emptyCard(String text) => Container(padding: const EdgeInsets.all(22), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18)), child: Text(text, style: const TextStyle(color: AppTheme.textGray)));
  Widget _detail(IconData icon, String label, String value) => Padding(padding: const EdgeInsets.only(bottom: 11), child: Row(children: [Icon(icon, size: 18, color: AppTheme.brandBlue), const SizedBox(width: 10), Text('$label: ', style: const TextStyle(fontWeight: FontWeight.w700)), Expanded(child: Text(value, style: const TextStyle(color: AppTheme.textGray)))]));
  List<Map<String, dynamic>> _records(dynamic value) => (value as List? ?? []).whereType<Map>().map((item) => Map<String, dynamic>.from(item)).toList();
  String _status(Map<String, dynamic> record) => (record['status'] ?? 'PENDING').toString().toUpperCase();
  String _money(dynamic value) => '\$${(double.tryParse('${value ?? 0}') ?? 0).toStringAsFixed(0)}';
  String _date(dynamic value) { final date = DateTime.tryParse('${value ?? ''}'); return date == null ? 'Not set' : DateFormat.MMMd().format(date); }
}
