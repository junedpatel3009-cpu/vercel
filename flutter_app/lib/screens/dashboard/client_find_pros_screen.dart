import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_client.dart';
import '../../core/theme/app_theme.dart';
import '../../widgets/motion.dart';

/// Client-only professional discovery workspace.
class ClientFindProsScreen extends StatefulWidget {
  const ClientFindProsScreen({super.key});

  @override
  State<ClientFindProsScreen> createState() => _ClientFindProsScreenState();
}

class _ClientFindProsScreenState extends State<ClientFindProsScreen> {
  final _searchController = TextEditingController();
  List<Map<String, dynamic>> _professionals = [];
  bool _loading = true;
  bool _verifiedOnly = false;
  bool _topRatedOnly = false;

  @override
  void initState() {
    super.initState();
    _loadProfessionals();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadProfessionals() async {
    try {
      final results = await ApiClient.instance.getList('/api/v1/professionals?limit=50', authenticated: false);
      if (mounted) {
        setState(() => _professionals = results);
      }
    } on ApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
      }
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  List<Map<String, dynamic>> get _visibleProfessionals {
    final query = _searchController.text.trim().toLowerCase();
    return _professionals.where((pro) {
      final text = '${pro['firstName']} ${pro['lastName']} ${pro['professionalCategory']} ${pro['companyDescription']}'.toLowerCase();
      final rating = double.tryParse((pro['averageRating'] ?? 0).toString()) ?? 0;
      final verified = pro['isVerified'] == true || pro['isVerified'] == 1;
      return (query.isEmpty || text.contains(query)) && (!_verifiedOnly || verified) && (!_topRatedOnly || rating >= 4.5);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF7F9FD),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(icon: const Icon(Icons.arrow_back, color: AppTheme.brandNavy), onPressed: () => context.go('/dashboard')),
        title: const Text('Find professionals', style: TextStyle(color: AppTheme.brandNavy, fontWeight: FontWeight.w800)),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadProfessionals,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 14, 20, 30),
                children: [
                  const Text('Find the right person for your project', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: AppTheme.brandNavy)),
                  const SizedBox(height: 6),
                  const Text('Search experts, compare their experience, and hire with confidence.', style: TextStyle(color: AppTheme.textGray, height: 1.45)),
                  const SizedBox(height: 18),
                  TextField(
                    controller: _searchController,
                    onChanged: (_) => setState(() {}),
                    decoration: InputDecoration(
                      hintText: 'Search design, plumbing, developer…',
                      prefixIcon: const Icon(Icons.search),
                      suffixIcon: _searchController.text.isEmpty ? null : IconButton(icon: const Icon(Icons.clear), onPressed: () { _searchController.clear(); setState(() {}); }),
                      filled: true,
                      fillColor: Colors.white,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                    ),
                  ),
                  const SizedBox(height: 13),
                  Wrap(spacing: 8, runSpacing: 8, children: [
                    FilterChip(label: const Text('Verified pros'), selected: _verifiedOnly, onSelected: (value) => setState(() => _verifiedOnly = value), selectedColor: const Color(0xFFDDE8FF)),
                    FilterChip(label: const Text('Rating 4.5+'), selected: _topRatedOnly, onSelected: (value) => setState(() => _topRatedOnly = value), selectedColor: const Color(0xFFDDE8FF)),
                  ]),
                  const SizedBox(height: 22),
                  Text('${_visibleProfessionals.length} professionals found', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppTheme.brandNavy)),
                  const SizedBox(height: 12),
                  if (_visibleProfessionals.isEmpty) _emptyState() else ..._visibleProfessionals.asMap().entries.map((entry) => FadeSlideIn(delay: Duration(milliseconds: entry.key * 45), child: _professionalCard(entry.value))),
                ],
              ),
            ),
    );
  }

  Widget _professionalCard(Map<String, dynamic> pro) {
    final name = '${pro['firstName'] ?? ''} ${pro['lastName'] ?? ''}'.trim().isEmpty ? 'Professional' : '${pro['firstName'] ?? ''} ${pro['lastName'] ?? ''}'.trim();
    final id = pro['id'];
    final avatar = (pro['avatarUrl'] ?? '').toString();
    final verified = pro['isVerified'] == true || pro['isVerified'] == 1;
    final rating = (double.tryParse((pro['averageRating'] ?? 0).toString()) ?? 0).toStringAsFixed(1);
    final rate = pro['hourlyRate'] ?? 0;
    return Container(
      margin: const EdgeInsets.only(bottom: 13),
      padding: const EdgeInsets.all(17),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), border: Border.all(color: const Color(0xFFE5EAF2))),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          CircleAvatar(radius: 25, backgroundColor: const Color(0xFFEAF0FF), backgroundImage: avatar.startsWith('http') ? NetworkImage(avatar) : null, child: avatar.startsWith('http') ? null : const Icon(Icons.person_outline, color: AppTheme.brandBlue)),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [Expanded(child: Text(name, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: AppTheme.brandNavy))), if (verified) const Icon(Icons.verified_rounded, color: Color(0xFF2450B8), size: 19)]),
            const SizedBox(height: 3), Text((pro['professionalCategory'] ?? 'Service professional').toString(), style: const TextStyle(color: AppTheme.textGray)),
          ])),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [const Icon(Icons.star_rounded, color: Color(0xFFF59E0B), size: 19), Text(rating, style: const TextStyle(fontWeight: FontWeight.w800, color: AppTheme.brandNavy))]),
        ]),
        if ((pro['companyDescription'] ?? '').toString().trim().isNotEmpty) ...[const SizedBox(height: 13), Text(pro['companyDescription'].toString(), maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: AppTheme.textGray, height: 1.4))],
        const SizedBox(height: 15),
        Row(children: [
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [const Text('STARTING AT', style: TextStyle(fontSize: 10, color: AppTheme.textGray, fontWeight: FontWeight.w800)), Text('\$$rate/hr', style: const TextStyle(fontSize: 18, color: AppTheme.brandNavy, fontWeight: FontWeight.w900))])),
          OutlinedButton(onPressed: id == null ? null : () => context.push('/pro/$id'), child: const Text('View')),
          const SizedBox(width: 8),
          ElevatedButton(onPressed: id == null ? null : () => context.push('/pro/$id'), style: ElevatedButton.styleFrom(backgroundColor: AppTheme.brandBlue, foregroundColor: Colors.white), child: const Text('Hire')),
        ]),
      ]),
    );
  }

  Widget _emptyState() => Container(padding: const EdgeInsets.all(34), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20)), child: const Column(children: [Icon(Icons.person_search_outlined, size: 48, color: AppTheme.textGray), SizedBox(height: 12), Text('No professionals match these filters', style: TextStyle(fontWeight: FontWeight.w700)), SizedBox(height: 5), Text('Try another search or remove a filter.', textAlign: TextAlign.center, style: TextStyle(color: AppTheme.textGray))]));
}
