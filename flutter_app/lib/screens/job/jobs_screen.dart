import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:intl/intl.dart';
import 'package:latlong2/latlong.dart';

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
  final _mapController = MapController();
  final Map<Object, LatLng> _locationsByJobId = {};
  bool _loading = true;
  bool _isClient = false;
  bool _showMap = false;
  bool _loadingLocations = false;
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
      return switch (_filter) {
        'High priority' => (job['urgency'] ?? '').toString().toUpperCase() == 'HIGH',
        'Medium priority' => (job['urgency'] ?? '').toString().toUpperCase() == 'MEDIUM',
        'Low priority' => (job['urgency'] ?? '').toString().toUpperCase() == 'LOW',
        'Remote' => (job['workMode'] ?? '').toString().toUpperCase() == 'REMOTE',
        _ => true,
      };
    }).toList();
  }

  Future<void> _showJobsOnMap() async {
    setState(() => _showMap = true);
    if (_locationsByJobId.isNotEmpty || _loadingLocations) return;

    setState(() => _loadingLocations = true);
    final locations = <Object, LatLng>{};
    for (final job in _visibleJobs) {
      final id = job['id'];
      if (id == null || _isRemoteJob(job)) continue;
      final point = await _locationFromJob(job);
      if (point != null) locations[id] = point;
    }
    if (!mounted) return;
    setState(() {
      _locationsByJobId.addAll(locations);
      _loadingLocations = false;
    });
  }

  bool _isRemoteJob(Map<String, dynamic> job) =>
      (job['workMode'] ?? '').toString().toUpperCase() == 'REMOTE';

  Future<LatLng?> _locationFromJob(Map<String, dynamic> job) async {
    final latitude = double.tryParse('${job['latitude'] ?? job['lat'] ?? ''}');
    final longitude = double.tryParse('${job['longitude'] ?? job['lng'] ?? job['lon'] ?? ''}');
    if (latitude != null && longitude != null) return LatLng(latitude, longitude);

    final location = (job['locationLabel'] ?? job['location'] ?? job['city'] ?? '')
        .toString()
        .trim();
    if (location.isEmpty) return null;

    try {
      final response = await http.get(
        Uri.https('nominatim.openstreetmap.org', '/search', {
          'format': 'jsonv2',
          'limit': '1',
          'q': location,
        }),
        headers: const {'User-Agent': 'ServioApp/1.0'},
      );
      final data = jsonDecode(response.body);
      if (data is! List || data.isEmpty || data.first is! Map) return null;
      final result = Map<String, dynamic>.from(data.first as Map);
      final lat = double.tryParse('${result['lat']}');
      final lng = double.tryParse('${result['lon']}');
      return lat != null && lng != null ? LatLng(lat, lng) : null;
    } catch (_) {
      return null;
    }
  }

  void _focusJob(Map<String, dynamic> job) {
    final location = _locationsByJobId[job['id']];
    if (location == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('This job does not have a mappable location yet.')));
      return;
    }
    _mapController.move(location, 14);
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

  Widget _buildProfessionalJobs() => RefreshIndicator(
        onRefresh: _loadJobs,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
          children: [
            TextField(
              onChanged: (value) => setState(() => _query = value),
              decoration: InputDecoration(
                hintText: 'Search jobs, skills, or category',
                prefixIcon: const Icon(Icons.search),
                filled: true,
                fillColor: Colors.white,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
              ),
            ),
            const SizedBox(height: 14),
            SingleChildScrollView(scrollDirection: Axis.horizontal, child: Row(children: ['All', 'High priority', 'Medium priority', 'Low priority', 'Remote'].map(_filterChip).toList())),
            const SizedBox(height: 14),
            SegmentedButton<bool>(
              segments: const [
                ButtonSegment(value: false, icon: Icon(Icons.view_list_outlined), label: Text('List')),
                ButtonSegment(value: true, icon: Icon(Icons.map_outlined), label: Text('Map')),
              ],
              selected: {_showMap},
              onSelectionChanged: (selection) {
                if (selection.first) {
                  _showJobsOnMap();
                } else {
                  setState(() => _showMap = false);
                }
              },
            ),
            const SizedBox(height: 20),
            Text('${_visibleJobs.length} open jobs', style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w800, color: AppTheme.brandNavy)),
            const SizedBox(height: 12),
            if (_visibleJobs.isEmpty)
              const Padding(padding: EdgeInsets.only(top: 120), child: Center(child: Text('No open jobs match your search.')))
            else if (_showMap)
              _mapAndJobList()
            else
              ..._visibleJobs.asMap().entries.map((entry) => FadeSlideIn(delay: Duration(milliseconds: entry.key < 8 ? entry.key * 45 : 360), child: _jobCard(entry.value))),
          ],
        ),
      );

  Widget _mapAndJobList() {
    final visible = _visibleJobs;
    final markers = visible
        .where((job) => _locationsByJobId[job['id']] != null)
        .map((job) => Marker(
              point: _locationsByJobId[job['id']]!,
              width: 54,
              height: 54,
              child: Tooltip(
                message: (job['title'] ?? 'Job').toString(),
                child: GestureDetector(
                  onTap: () => context.push('/job/${job['id']}'),
                  child: const Icon(Icons.location_on, size: 46, color: AppTheme.brandBlue),
                ),
              ),
            ))
        .toList();
    final center = markers.isNotEmpty ? markers.first.point : const LatLng(20.5937, 78.9629);

    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Container(
        height: 330,
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(borderRadius: BorderRadius.circular(20), border: Border.all(color: const Color(0xFFE5EAF2))),
        child: _loadingLocations
            ? const Center(child: CircularProgressIndicator())
            : FlutterMap(
                mapController: _mapController,
                options: MapOptions(initialCenter: center, initialZoom: markers.length == 1 ? 11 : 5),
                children: [
                  TileLayer(
                    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                    userAgentPackageName: 'com.servio.app',
                  ),
                  MarkerLayer(markers: markers),
                ],
              ),
      ),
      const SizedBox(height: 10),
      Text(
        markers.isEmpty
            ? 'No on-site job locations have been added for these jobs yet.'
            : 'Tap a pin or a job below to view the job details.',
        style: const TextStyle(color: AppTheme.textGray, fontSize: 12),
      ),
      const SizedBox(height: 12),
      ...visible.asMap().entries.map((entry) => FadeSlideIn(
            delay: Duration(milliseconds: entry.key < 8 ? entry.key * 45 : 360),
            child: _jobCard(entry.value, showLocation: true),
          )),
    ]);
  }

  Widget _jobCard(Map<String, dynamic> job, {bool showLocation = false}) {
    final clientName = (job['clientName'] ?? 'Client').toString().trim();
    final company = (job['clientCompanyName'] ?? '').toString().trim();
    final budgetMin = job['budgetMin'] ?? 0;
    final budgetMax = job['budgetMax'] ?? budgetMin;
    final deadline = DateTime.tryParse((job['deadline'] ?? '').toString());
    final location = (job['locationLabel'] ?? '').toString().trim();
    final urgency = (job['urgency'] ?? 'MEDIUM').toString().toUpperCase();
    final urgencyColor = urgency == 'HIGH' ? const Color(0xFFDC2626) : urgency == 'LOW' ? const Color(0xFF0F8C77) : const Color(0xFFB45309);
    return InkWell(
      borderRadius: BorderRadius.circular(22),
      onTap: () => showLocation ? _focusJob(job) : context.push('/job/${job['id']}'),
      child: Container(
        margin: const EdgeInsets.only(bottom: 14),
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: const Color(0xFFE1E8F2)),
          boxShadow: const [BoxShadow(color: Color(0x090F172A), blurRadius: 18, offset: Offset(0, 6))],
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: Text((job['title'] ?? 'Untitled job').toString(), maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w900, color: AppTheme.brandNavy))),
            Container(padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5), decoration: BoxDecoration(color: urgencyColor.withValues(alpha: .12), borderRadius: BorderRadius.circular(20)), child: Text('$urgency PRIORITY', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: urgencyColor))),
          ]),
          const SizedBox(height: 6),
          Text((job['category'] ?? 'Service job').toString(), style: const TextStyle(color: AppTheme.brandBlue, fontWeight: FontWeight.w700)),
          const SizedBox(height: 12),
          Text((job['description'] ?? 'No description provided.').toString(), maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: AppTheme.textGray, height: 1.4)),
          const SizedBox(height: 16),
          Row(children: [
            CircleAvatar(radius: 18, backgroundColor: const Color(0xFFEAF1FF), child: const Icon(Icons.business_outlined, color: AppTheme.brandBlue, size: 19)),
            const SizedBox(width: 10),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(clientName.isEmpty ? 'Client' : clientName, style: const TextStyle(fontWeight: FontWeight.w800, color: AppTheme.brandNavy)), Text(company.isEmpty ? 'Job posted by client' : company, style: const TextStyle(fontSize: 11, color: AppTheme.textGray))])),
            const Icon(Icons.chevron_right_rounded, color: AppTheme.brandBlue),
          ]),
          const SizedBox(height: 16),
          Container(height: 1, color: const Color(0xFFE9EEF5)),
          const SizedBox(height: 14),
          Row(children: [
            const Icon(Icons.account_balance_wallet_outlined, size: 17, color: AppTheme.brandBlue), const SizedBox(width: 6), Text('$budgetMin – $budgetMax', style: const TextStyle(fontWeight: FontWeight.w800, color: AppTheme.brandNavy)),
            const Spacer(), const Icon(Icons.location_on_outlined, size: 17, color: AppTheme.textGray), const SizedBox(width: 4), Flexible(child: Text(location.isEmpty ? 'Remote' : location, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, color: AppTheme.textGray))),
          ]),
          if (deadline != null) ...[const SizedBox(height: 9), Row(children: [const Icon(Icons.calendar_today_outlined, size: 15, color: AppTheme.textGray), const SizedBox(width: 6), Text('Apply by ${DateFormat.MMMd().format(deadline)}', style: const TextStyle(fontSize: 12, color: AppTheme.textGray))])],
          if (showLocation) Align(alignment: Alignment.centerRight, child: TextButton.icon(onPressed: () => context.push('/job/${job['id']}'), icon: const Icon(Icons.open_in_new, size: 16), label: const Text('View job'))),
        ]),
      ),
    );
  }
}
