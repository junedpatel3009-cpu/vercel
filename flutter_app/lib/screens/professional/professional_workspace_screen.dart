import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_client.dart';
import '../../core/theme/app_theme.dart';

/// Professional-only profile workspace. Client accounts continue to use the
/// client dashboard and company profile screens.
class ProfessionalWorkspaceScreen extends StatefulWidget {
  const ProfessionalWorkspaceScreen({super.key});

  @override
  State<ProfessionalWorkspaceScreen> createState() => _ProfessionalWorkspaceScreenState();
}

class _ProfessionalWorkspaceScreenState extends State<ProfessionalWorkspaceScreen> {
  Map<String, dynamic>? _profile;
  List<Map<String, dynamic>> _applications = [];
  List<Map<String, dynamic>> _transactions = [];
  List<Map<String, dynamic>> _hireRequests = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final results = await Future.wait([
        ApiClient.instance.get('/api/v1/profile'),
        ApiClient.instance.getList('/api/v1/professional/jobs/history'),
        ApiClient.instance.get('/api/v1/professional/earnings'),
        ApiClient.instance.getList('/api/v1/professional/hire-requests'),
      ]);
      final earnings = results[2] as Map<String, dynamic>;
      if (mounted) {
        setState(() {
          _profile = results[0] as Map<String, dynamic>;
          _applications = results[1] as List<Map<String, dynamic>>;
          _transactions = (earnings['transactions'] as List? ?? [])
              .whereType<Map>()
              .map((item) => Map<String, dynamic>.from(item))
              .toList();
          _hireRequests = results[3] as List<Map<String, dynamic>>;
        });
      }
    } on ApiException catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    final name = '${_profile?['firstName'] ?? ''} ${_profile?['lastName'] ?? ''}'.trim();
    return DefaultTabController(
      length: 3,
      child: Scaffold(
        backgroundColor: AppTheme.bgLight,
        appBar: AppBar(
          backgroundColor: Colors.white,
          elevation: 0,
          title: Text(name.isEmpty ? 'Professional profile' : name, style: const TextStyle(color: AppTheme.brandNavy, fontWeight: FontWeight.w800)),
          leading: IconButton(icon: const Icon(Icons.arrow_back, color: AppTheme.brandNavy), onPressed: () => context.canPop() ? context.pop() : context.go('/')),
          bottom: const TabBar(tabs: [Tab(icon: Icon(Icons.bar_chart_rounded), text: 'Stats'), Tab(icon: Icon(Icons.chat_bubble_outline), text: 'Messages'), Tab(icon: Icon(Icons.person_outline), text: 'My info')]),
        ),
        body: TabBarView(children: [_statsTab(), _messagesTab(), _infoTab(name)]),
      ),
    );
  }

  Widget _statsTab() {
    final earned = _transactions.fold<double>(0, (total, item) => total + (double.tryParse('${item['amount'] ?? 0}') ?? 0));
    final active = _applications.where((item) => (item['status'] ?? '').toString().toUpperCase() == 'ACCEPTED').length;
    return RefreshIndicator(onRefresh: _load, child: ListView(padding: const EdgeInsets.all(20), children: [
      const Text('Your professional stats', style: TextStyle(fontSize: 23, fontWeight: FontWeight.w900, color: AppTheme.brandNavy)), const SizedBox(height: 16),
      Row(children: [_metric('$active', 'Active projects', Icons.rocket_launch_outlined, const Color(0xFF0F8C77)), const SizedBox(width: 12), _metric('\$${earned.toStringAsFixed(0)}', 'Total earned', Icons.payments_outlined, const Color(0xFF7C3AED))]), const SizedBox(height: 12),
      Row(children: [_metric('${_applications.length}', 'Applications sent', Icons.description_outlined, AppTheme.brandBlue)]), const SizedBox(height: 24),
      const Text('Hire requests', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppTheme.brandNavy)), const SizedBox(height: 10),
      if (_hireRequests.isEmpty)
        const Text('No client hire requests yet.', style: TextStyle(color: AppTheme.textGray))
      else
        ..._hireRequests.take(4).map(_hireRequestCard),
      const SizedBox(height: 24),
      const Text('Quick actions', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppTheme.brandNavy)), const SizedBox(height: 10),
      ListTile(shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)), tileColor: Colors.white, leading: const Icon(Icons.work_outline, color: AppTheme.brandBlue), title: const Text('Find available jobs'), trailing: const Icon(Icons.chevron_right), onTap: () => context.push('/discover')),
      const SizedBox(height: 10), ListTile(shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)), tileColor: Colors.white, leading: const Icon(Icons.account_balance_wallet_outlined, color: AppTheme.brandBlue), title: const Text('View earnings'), trailing: const Icon(Icons.chevron_right), onTap: () => context.push('/earnings')),
    ]));
  }

  Widget _messagesTab() => Center(child: Padding(padding: const EdgeInsets.all(28), child: Column(mainAxisSize: MainAxisSize.min, children: [const Icon(Icons.forum_outlined, size: 56, color: AppTheme.brandBlue), const SizedBox(height: 15), const Text('Messages', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800)), const SizedBox(height: 6), const Text('Keep all client conversations in one place.', textAlign: TextAlign.center, style: TextStyle(color: AppTheme.textGray)), const SizedBox(height: 18), ElevatedButton.icon(onPressed: () => context.push('/messages'), icon: const Icon(Icons.chat_bubble_outline), label: const Text('Open messages'))])));

  Widget _hireRequestCard(Map<String, dynamic> request) {
    final status = (request['status'] ?? 'pending').toString().toUpperCase();
    final pending = status == 'PENDING';
    return Container(margin: const EdgeInsets.only(bottom: 10), padding: const EdgeInsets.all(15), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text((request['contractTitle'] ?? request['jobTitle'] ?? 'New hire request').toString(), style: const TextStyle(fontWeight: FontWeight.w800, color: AppTheme.brandNavy)), const SizedBox(height: 4),
      Text('${request['clientName'] ?? 'Client'} • \$${request['totalAmount'] ?? request['fixedPrice'] ?? 0}', style: const TextStyle(color: AppTheme.textGray, fontSize: 12)), const SizedBox(height: 10),
      if (pending) Row(children: [Expanded(child: OutlinedButton(onPressed: () => _updateHireRequest(request, 'rejected'), child: const Text('Decline'))), const SizedBox(width: 10), Expanded(child: ElevatedButton(onPressed: () => _updateHireRequest(request, 'accepted'), child: const Text('Accept')))]) else Text(status, style: TextStyle(color: status == 'ACCEPTED' ? const Color(0xFF0F8C77) : AppTheme.textGray, fontWeight: FontWeight.w800, fontSize: 12)),
    ]));
  }

  Future<void> _updateHireRequest(Map<String, dynamic> request, String status) async {
    try {
      await ApiClient.instance.patch('/api/v1/professional/hire-requests/${request['id']}', data: {'status': status});
      await _load();
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(status == 'accepted' ? 'Hire request accepted.' : 'Hire request declined.')));
    } on ApiException catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
    }
  }

  Widget _infoTab(String name) => ListView(padding: const EdgeInsets.all(20), children: [
    CircleAvatar(radius: 44, backgroundColor: const Color(0xFFEAF0FF), backgroundImage: (_profile?['avatarUrl'] ?? '').toString().startsWith('http') ? NetworkImage(_profile!['avatarUrl'].toString()) : null, child: (_profile?['avatarUrl'] ?? '').toString().startsWith('http') ? null : const Icon(Icons.person_outline, size: 42, color: AppTheme.brandBlue)), const SizedBox(height: 16),
    Center(child: Text(name.isEmpty ? 'Professional' : name, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: AppTheme.brandNavy))), const SizedBox(height: 24),
    _infoRow(Icons.work_outline, 'Category', (_profile?['professionalCategory'] ?? 'Not set').toString()), _infoRow(Icons.location_on_outlined, 'City', (_profile?['professionalCity'] ?? 'Not set').toString()), _infoRow(Icons.payments_outlined, 'Hourly rate', '\$${_profile?['hourlyRate'] ?? 0}/hr'), _infoRow(Icons.email_outlined, 'Email', (_profile?['email'] ?? 'Not set').toString()), const SizedBox(height: 18),
    ElevatedButton.icon(onPressed: () => context.push('/setup/professional'), icon: const Icon(Icons.edit_outlined), label: const Text('Edit my info')),
  ]);

  Widget _metric(String value, String label, IconData icon, Color color) => Expanded(child: Container(padding: const EdgeInsets.all(17), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18)), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Icon(icon, color: color), const SizedBox(height: 13), Text(value, style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: color)), Text(label, style: const TextStyle(fontSize: 11, color: AppTheme.textGray))])));
  Widget _infoRow(IconData icon, String label, String value) => Container(margin: const EdgeInsets.only(bottom: 10), padding: const EdgeInsets.all(15), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(15)), child: Row(children: [Icon(icon, color: AppTheme.brandBlue), const SizedBox(width: 12), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(label, style: const TextStyle(fontSize: 11, color: AppTheme.textGray)), Text(value, style: const TextStyle(fontWeight: FontWeight.w700))]))]));
}
