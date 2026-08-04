import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/api/api_client.dart';
import '../../core/auth/auth_service.dart';
import '../../core/database/database_helper.dart';
import '../../core/theme/app_theme.dart';

class ProScreen extends StatefulWidget {
  final String proId;
  const ProScreen({super.key, required this.proId});

  @override
  State<ProScreen> createState() => _ProScreenState();
}

class _ProScreenState extends State<ProScreen> {
  Map<String, dynamic>? _pro;
  Map<String, dynamic>? _user;
  bool _loading = true;
  bool _saved = false;

  int get _professionalId => int.tryParse(widget.proId.replaceFirst(RegExp(r'^p'), '')) ?? 0;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    try {
      _user = await AuthService().getUser();
      final pro = await ApiClient.instance.get('/api/v1/professionals/$_professionalId', authenticated: false);
      final userId = _user?['id'] is int ? _user!['id'] as int : int.tryParse('${_user?['id']}');
      if (userId != null) {
        _saved = await DatabaseHelper().isProfessionalFavourite(userId, _professionalId);
      }
      if (mounted) setState(() => _pro = pro);
    } on ApiException catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _toggleSaved() async {
    final userId = _user?['id'] is int ? _user!['id'] as int : int.tryParse('${_user?['id']}');
    if (userId == null) {
      context.push('/login');
      return;
    }
    await DatabaseHelper().toggleFavouriteProfessional(userId, _professionalId);
    if (!mounted) return;
    setState(() => _saved = !_saved);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(_saved ? 'Professional saved' : 'Removed from saved professionals')),
    );
  }

  void _message() {
    if (_user == null) {
      context.push('/login');
      return;
    }
    context.push('/messages');
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Start a conversation with ${_pro!['fullName']} from Messages.')),
    );
  }

  Future<void> _hire() async {
    if (_user == null) {
      context.push('/login');
      return;
    }
    if (_user!['role'].toString().toLowerCase() != 'client') {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Only client accounts can hire professionals.')));
      return;
    }
    final title = TextEditingController(text: 'Project with ${_pro!['fullName']}');
    final description = TextEditingController();
    final price = TextEditingController(text: (_pro!['hourlyRate'] ?? 0).toString());
    final formKey = GlobalKey<FormState>();
    final submitted = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (sheetContext) => Padding(
        padding: EdgeInsets.fromLTRB(24, 24, 24, MediaQuery.viewInsetsOf(sheetContext).bottom + 24),
        child: Form(
          key: formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Hire ${_pro!['fullName']}', style: const TextStyle(fontSize: 21, fontWeight: FontWeight.w800)),
              const SizedBox(height: 8),
              const Text('Send a direct hire request. The professional can review it before starting.'),
              const SizedBox(height: 18),
              TextFormField(controller: title, decoration: const InputDecoration(labelText: 'Project title'), validator: _required),
              const SizedBox(height: 12),
              TextFormField(controller: description, maxLines: 3, decoration: const InputDecoration(labelText: 'Work description'), validator: _required),
              const SizedBox(height: 12),
              TextFormField(controller: price, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Fixed budget'), validator: _required),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () {
                    if (formKey.currentState!.validate()) Navigator.pop(sheetContext, true);
                  },
                  child: const Text('Send hire request'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
    if (submitted != true) return;
    try {
      await ApiClient.instance.post('/api/v1/client/hire', data: {
        'professionalId': _professionalId,
        'hiringTeam': '',
        'contractTitle': title.text.trim(),
        'workDescription': description.text.trim(),
        'jobDate': '',
        'deadline': '',
        'workMode': 'remote',
        'location': '',
        'paymentOption': 'fixed',
        'hourlyRate': null,
        'fixedPrice': num.tryParse(price.text.trim()) ?? 0,
        'paymentSchedule': 'whole',
        'acceptedTerms': true,
        'attachments': [],
        'milestones': [],
      });
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Hire request sent successfully.')));
    } on ApiException catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
    }
  }

  String? _required(String? value) => value == null || value.trim().isEmpty ? 'This field is required' : null;

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    if (_pro == null) return Scaffold(appBar: AppBar(), body: const Center(child: Text('Professional not found')));
    final photo = _pro!['avatarUrl']?.toString() ?? '';
    return Scaffold(
      backgroundColor: AppTheme.bgLight,
      appBar: AppBar(
        title: const Text('Professional profile'),
        leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => Navigator.of(context).canPop() ? Navigator.pop(context) : context.go('/discover')),
        actions: [IconButton(onPressed: _toggleSaved, icon: Icon(_saved ? Icons.bookmark : Icons.bookmark_border, color: _saved ? AppTheme.brandBlue : null))],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 120),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Center(child: CircleAvatar(radius: 54, backgroundImage: photo.startsWith('http') ? NetworkImage(photo) : null, child: photo.startsWith('http') ? null : const Icon(Icons.person, size: 52))),
          const SizedBox(height: 18),
          Center(child: Text(_pro!['fullName'] ?? 'Professional', style: GoogleFonts.plusJakartaSans(fontSize: 25, fontWeight: FontWeight.w800, color: AppTheme.brandNavy))),
          const SizedBox(height: 6),
          Center(child: Text(_pro!['professionalCategory'] ?? 'Service professional', style: const TextStyle(color: AppTheme.textGray, fontSize: 16))),
          const SizedBox(height: 12),
          Center(child: Wrap(spacing: 8, children: [
            if (_pro!['isVerified'] == true) _chip(Icons.verified, 'Verified', const Color(0xFF0F49A7)),
            _chip(Icons.star_rounded, '${_pro!['averageRating'] ?? 0} (${_pro!['reviewCount'] ?? 0} reviews)', const Color(0xFFF59E0B)),
          ])),
          const SizedBox(height: 24),
          _summaryCard(),
          const SizedBox(height: 26),
          _section('About', _pro!['companyDescription']?.toString().trim().isNotEmpty == true ? _pro!['companyDescription'] : 'This professional has not added an introduction yet.'),
          const SizedBox(height: 26),
          _skillsSection(),
          const SizedBox(height: 26),
          _detailsSection(),
          const SizedBox(height: 26),
          _portfolioSection(),
        ]),
      ),
      bottomNavigationBar: SafeArea(child: Container(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
        decoration: const BoxDecoration(color: Colors.white, border: Border(top: BorderSide(color: Color(0xFFE5E7EB)))),
        child: Row(children: [
          OutlinedButton.icon(onPressed: _message, icon: const Icon(Icons.chat_bubble_outline), label: const Text('Message')),
          const SizedBox(width: 10),
          Expanded(child: ElevatedButton.icon(onPressed: _hire, icon: const Icon(Icons.handshake_outlined), label: const Text('Hire professional'))),
        ]),
      )),
    );
  }

  Widget _chip(IconData icon, String label, Color color) => Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6), decoration: BoxDecoration(color: color.withValues(alpha: .10), borderRadius: BorderRadius.circular(20)), child: Row(mainAxisSize: MainAxisSize.min, children: [Icon(icon, size: 15, color: color), const SizedBox(width: 4), Text(label, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12, color: color))]));

  Widget _summaryCard() => Container(padding: const EdgeInsets.all(18), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18)), child: Row(children: [Expanded(child: _metric(Icons.payments_outlined, 'Starting at', '\$${_pro!['hourlyRate'] ?? 0}/hr')), Expanded(child: _metric(Icons.location_on_outlined, 'Location', _pro!['professionalCity']?.toString().isNotEmpty == true ? _pro!['professionalCity'] : 'Remote')), Expanded(child: _metric(Icons.circle_outlined, 'Availability', _pro!['availabilityStatus'] ?? 'Available'))]));

  Widget _metric(IconData icon, String label, String value) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Icon(icon, color: AppTheme.brandBlue), const SizedBox(height: 8), Text(label, style: const TextStyle(fontSize: 11, color: AppTheme.textGray)), const SizedBox(height: 3), Text(value, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w800))]);

  Widget _section(String title, String text) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)), const SizedBox(height: 10), Text(text, style: const TextStyle(color: AppTheme.textGray, height: 1.55))]);

  Widget _skillsSection() {
    final skills = List<String>.from(_pro!['skills'] ?? []);
    if (skills.isEmpty) return const SizedBox.shrink();
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [const Text('Skills & expertise', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)), const SizedBox(height: 12), Wrap(spacing: 8, runSpacing: 8, children: skills.map((skill) => Chip(label: Text(skill))).toList())]);
  }

  Widget _detailsSection() => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [const Text('Professional details', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)), const SizedBox(height: 12), _detail(Icons.work_outline, 'Experience', '${_pro!['experienceYears'] ?? 0} years'), _detail(Icons.map_outlined, 'Service area', _pro!['serviceArea']?.toString().isNotEmpty == true ? _pro!['serviceArea'] : 'Not specified'), _detail(Icons.laptop_outlined, 'Work mode', (_pro!['workMode'] ?? 'both').toString())]);

  Widget _detail(IconData icon, String label, String value) => Padding(padding: const EdgeInsets.only(bottom: 13), child: Row(children: [Icon(icon, size: 20, color: AppTheme.brandBlue), const SizedBox(width: 11), Text('$label: ', style: const TextStyle(fontWeight: FontWeight.w700)), Expanded(child: Text(value, style: const TextStyle(color: AppTheme.textGray)))]));

  Widget _portfolioSection() {
    final photos = List<String>.from(_pro!['workPhotos'] ?? []);
    if (photos.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Portfolio', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
        const SizedBox(height: 12),
        SizedBox(
          height: 160,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: photos.length,
            separatorBuilder: (_, __) => const SizedBox(width: 12),
            itemBuilder: (_, index) => ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: Image.network(
                photos[index],
                width: 210,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => const SizedBox(
                  width: 210,
                  child: Center(child: Icon(Icons.image_not_supported_outlined)),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
