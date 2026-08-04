import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/app_theme.dart';
import '../../core/database/database_helper.dart';
import '../../core/auth/auth_service.dart';
import '../../core/api/api_client.dart';

class JobScreen extends StatefulWidget {
  final String? jobId;
  const JobScreen({super.key, this.jobId});

  @override
  State<JobScreen> createState() => _JobScreenState();
}

class _JobScreenState extends State<JobScreen> {
  Map<String, dynamic>? _currentUser;
  Map<String, dynamic>? _job;
  List<Map<String, dynamic>> _proposals = [];
  bool _isLoading = true;
  bool _isSavedJob = false;

  @override
  void initState() {
    super.initState();
    _loadJobDetails();
  }

  Future<void> _loadJobDetails() async {
    _currentUser = await AuthService().getUser();
    if (widget.jobId == null) {
      if (mounted) setState(() => _isLoading = false);
      return;
    }

    final db = DatabaseHelper();
    final jobIdInt = int.tryParse(widget.jobId!) ?? 0;
    final job = await db.getJob(jobIdInt);
    
    if (job != null) {
      final proposals = await db.getProposals(jobId: jobIdInt);
      if (mounted) {
        setState(() {
          _job = job;
          _proposals = proposals;
          _isLoading = false;
        });
        await _refreshSavedState(jobIdInt);
      }
    } else {
      try {
        final remoteJob = await ApiClient.instance.get('/api/v1/jobs/$jobIdInt', authenticated: false);
        if (mounted) {
          setState(() {
            _job = {
              'id': remoteJob['id'],
              'title': remoteJob['title'],
              'description': remoteJob['description'],
              'status': (remoteJob['status'] ?? 'OPEN').toString().toLowerCase(),
              'city': remoteJob['locationLabel'] ?? (remoteJob['workMode'] == 'REMOTE' ? 'Remote' : ''),
              'country': '',
              'created_at': remoteJob['createdAt'] ?? DateTime.now().toIso8601String(),
              'min_budget': remoteJob['budgetMin'],
              'max_budget': remoteJob['budgetMax'],
               'budget_type': remoteJob['timingType'],
               'category': remoteJob['category'],
               'urgency': remoteJob['urgency'],
               'work_mode': remoteJob['workMode'],
               'address': remoteJob['locationAddress'],
               'latitude': remoteJob['locationLat'],
               'longitude': remoteJob['locationLng'],
               'start_date': remoteJob['jobDate'],
               'deadline': remoteJob['deadline'],
               'attachments': remoteJob['attachments'],
            };
            _isLoading = false;
          });
        }
        await _refreshSavedState(jobIdInt);
      } catch (_) {
        if (mounted) setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    if (_job == null) return const Scaffold(body: Center(child: Text('Job not found')));

    return Scaffold(
      backgroundColor: AppTheme.bgLight,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          tooltip: 'Back',
          onPressed: () {
            if (Navigator.of(context).canPop()) {
              Navigator.of(context).pop();
            } else {
              context.go('/jobs');
            }
          },
        ),
        title: Text('Job Details', style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w900, color: AppTheme.brandNavy)),
        actions: [
          TextButton.icon(
            onPressed: _toggleSaveJob,
            icon: Icon(_isSavedJob ? Icons.bookmark : Icons.bookmark_border),
            label: Text(_isSavedJob ? 'Saved' : 'Save job'),
            style: TextButton.styleFrom(foregroundColor: AppTheme.brandBlue),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildStatusBadge(),
            const SizedBox(height: 16),
            Text(_job!['title'] ?? 'Untitled Job', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: AppTheme.brandNavy)),
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(Icons.location_on_outlined, size: 16, color: AppTheme.textGray),
                const SizedBox(width: 4),
                Text('${_job!['city'] ?? 'Remote'}, ${_job!['country'] ?? ''}', style: const TextStyle(color: AppTheme.textGray)),
                const SizedBox(width: 16),
                const Icon(Icons.access_time, size: 16, color: AppTheme.textGray),
                const SizedBox(width: 4),
                Text('Posted ${DateFormat.yMMMd().format(DateTime.parse(_job!['created_at']))}', style: const TextStyle(color: AppTheme.textGray)),
              ],
            ),
            const SizedBox(height: 32),
             _buildPriceSection(),
             const SizedBox(height: 32),
             _buildJobInformation(),
             const SizedBox(height: 32),
            const Text('Description', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
            const SizedBox(height: 12),
            Text(_job!['description'] ?? '', style: const TextStyle(color: AppTheme.textGray, height: 1.6)),
            const SizedBox(height: 32),
            if (_job!['required_skills'] != null) ...[
              const Text('Required Skills', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                children: (_job!['required_skills'] as String).split(',').map((s) => Chip(label: Text(s.trim()))).toList(),
              ),
              const SizedBox(height: 32),
            ],
            const Text('Proposals', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
            const SizedBox(height: 16),
            _proposals.isEmpty
              ? const Text('No proposals yet.', style: TextStyle(color: AppTheme.textGray))
              : Column(children: _proposals.map((p) => _buildProposalCard(p)).toList()),
            const SizedBox(height: 40),
          ],
        ),
      ),
      bottomNavigationBar: _buildBottomBar(),
    );
  }

  Widget _buildStatusBadge() {
    final status = _job!['status'] ?? 'active';
    Color color = Colors.green;
    if (status == 'draft') color = Colors.orange;
    if (status == 'completed') color = Colors.blue;
    if (status == 'cancelled') color = Colors.red;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(8)),
      child: Text(status.toUpperCase(), style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.bold)),
    );
  }

  Widget _buildPriceSection() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(24), border: Border.all(color: const Color(0xFFF1F5F9))),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Budget', style: TextStyle(color: AppTheme.textGray, fontSize: 12, fontWeight: FontWeight.bold)),
              Text('\$${_job!['min_budget']} - \$${_job!['max_budget']}', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: AppTheme.brandBlue)),
            ],
          ),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: AppTheme.bgLight, borderRadius: BorderRadius.circular(12)),
            child: Text(_job!['budget_type'] ?? 'Fixed Price', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
          )
        ],
      ),
    );
  }

  int? get _currentUserId => _currentUser?['id'] is int
      ? _currentUser!['id'] as int
      : int.tryParse('${_currentUser?['id']}');

  Future<void> _refreshSavedState(int jobId) async {
    final userId = _currentUserId;
    if (userId == null) return;
    final saved = await DatabaseHelper().isJobSaved(userId, jobId);
    if (mounted) setState(() => _isSavedJob = saved);
  }

  Future<void> _toggleSaveJob() async {
    final userId = _currentUserId;
    if (userId == null) {
      context.push('/login');
      return;
    }
    final db = DatabaseHelper();
    final jobId = _job!['id'] as int;
    if (!_isSavedJob && await db.getJob(jobId) == null) {
      await (await db.database).insert('jobs', {
        'id': jobId,
        'title': _job!['title'],
        'description': _job!['description'],
        'city': _job!['city'],
        'country': _job!['country'],
        'address': _job!['address'],
        'status': _job!['status'],
        'budget_type': _job!['budget_type'],
        'min_budget': _job!['min_budget'],
        'max_budget': _job!['max_budget'],
        'start_date': _job!['start_date'],
        'deadline': _job!['deadline'],
        'created_at': _job!['created_at'],
      });
    }
    await db.toggleSavedJob(userId, jobId);
    if (!mounted) return;
    setState(() => _isSavedJob = !_isSavedJob);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(_isSavedJob ? 'Job saved' : 'Removed from saved jobs')),
    );
  }

  Widget _buildJobInformation() {
    final details = <MapEntry<String, String>>[
      MapEntry('Category', (_job!['category'] ?? 'Not specified').toString()),
      MapEntry('Work mode', (_job!['work_mode'] ?? (_job!['is_remote'] == 1 ? 'REMOTE' : 'ON_SITE')).toString().replaceAll('_', ' ')),
      MapEntry('Urgency', (_job!['urgency'] ?? _job!['priority'] ?? 'MEDIUM').toString()),
      MapEntry('Job date', _formatDate(_job!['start_date'])),
      MapEntry('Deadline', _formatDate(_job!['deadline'])),
      MapEntry('Address', (_job!['address'] ?? _job!['locationAddress'] ?? _job!['city'] ?? 'Not specified').toString()),
    ];
    final attachments = _job!['attachments'];
    if (attachments is List) details.add(MapEntry('Attachments', '${attachments.length} file(s)'));

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), border: Border.all(color: const Color(0xFFF1F5F9))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Job information', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
          const SizedBox(height: 16),
          ...details.map((detail) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SizedBox(width: 104, child: Text(detail.key, style: const TextStyle(color: AppTheme.textGray))),
                    Expanded(child: Text(detail.value, style: const TextStyle(fontWeight: FontWeight.w600))),
                  ],
                ),
              )),
        ],
      ),
    );
  }

  String _formatDate(dynamic value) {
    if (value == null || value.toString().isEmpty) return 'Not specified';
    final date = DateTime.tryParse(value.toString());
    return date == null ? value.toString() : DateFormat.yMMMd().format(date);
  }

  Widget _buildProposalCard(Map<String, dynamic> proposal) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), border: Border.all(color: const Color(0xFFF1F5F9))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const CircleAvatar(child: Icon(Icons.person_outline)),
              const SizedBox(width: 12),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(proposal['full_name'] ?? 'Professional', style: const TextStyle(fontWeight: FontWeight.bold)), Text(proposal['profession'] ?? '', style: const TextStyle(fontSize: 12, color: AppTheme.textGray))])),
              Text('\$${proposal['price']}', style: const TextStyle(fontWeight: FontWeight.w900, color: AppTheme.brandBlue)),
            ],
          ),
          const SizedBox(height: 12),
          Text(proposal['text'] ?? '', style: const TextStyle(color: AppTheme.textGray, fontSize: 13)),
        ],
      ),
    );
  }

  Widget _buildBottomBar() {
    if (_currentUser == null) return const SizedBox.shrink();
    if (_currentUser!['role'] != 'professional') return const SizedBox.shrink();
    
    // Check if already applied
    final hasApplied = _proposals.any((p) => p['professional_id'] == _currentUser!['id']);
    if (hasApplied) {
      return Container(
        padding: const EdgeInsets.all(24),
        decoration: const BoxDecoration(color: Colors.white, border: Border(top: BorderSide(color: Color(0xFFF1F5F9)))),
        child: const Center(child: Text('You have already applied for this job', style: TextStyle(color: AppTheme.brandBlue, fontWeight: FontWeight.bold))),
      );
    }

    return Container(
      padding: const EdgeInsets.all(24),
      decoration: const BoxDecoration(color: Colors.white, border: Border(top: BorderSide(color: Color(0xFFF1F5F9)))),
      child: ElevatedButton(
        onPressed: _showProposalDialog,
        style: ElevatedButton.styleFrom(backgroundColor: AppTheme.brandNavy, padding: const EdgeInsets.symmetric(vertical: 18), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
        child: const Text('Apply for this Job', style: TextStyle(fontWeight: FontWeight.bold)),
      ),
    );
  }

  void _showProposalDialog() {
    final priceController = TextEditingController();
    final textController = TextEditingController();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(32))),
      builder: (context) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom, left: 24, right: 24, top: 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Submit Proposal', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
            const SizedBox(height: 24),
            const Text('Your Price (\$)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
            const SizedBox(height: 8),
            TextField(controller: priceController, keyboardType: TextInputType.number, decoration: const InputDecoration(hintText: 'e.g. 500')),
            const SizedBox(height: 24),
            const Text('Why should we hire you?', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
            const SizedBox(height: 8),
            TextField(controller: textController, maxLines: 4, decoration: const InputDecoration(hintText: 'Describe your relevant experience...')),
            const SizedBox(height: 32),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => _submitProposal(priceController.text, textController.text),
                style: ElevatedButton.styleFrom(backgroundColor: AppTheme.brandBlue, padding: const EdgeInsets.symmetric(vertical: 18), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                child: const Text('Submit Proposal', style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            ),
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }

  Future<void> _submitProposal(String price, String text) async {
    if (price.isEmpty || text.isEmpty) return;
    
    Navigator.pop(context);
    
    final db = DatabaseHelper();
    await db.submitProposal({
      'job_id': _job!['id'],
      'professional_id': _currentUser!['id'],
      'price': double.tryParse(price) ?? 0.0,
      'text': text,
    });

    // Notify client
    await db.addNotification({
      'user_id': _job!['client_id'],
      'title': 'New Proposal Received',
      'message': 'A professional has submitted a proposal for your job: ${_job!['title']}',
      'type': 'proposal',
    });

    await _loadJobDetails();
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Proposal submitted successfully!')));
    }
  }
}
