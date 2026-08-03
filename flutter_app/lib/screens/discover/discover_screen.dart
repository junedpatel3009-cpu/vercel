import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/theme/app_theme.dart';
import '../../core/database/database_helper.dart';
import '../../core/auth/auth_service.dart';
import '../../widgets/motion.dart';

class DiscoverScreen extends StatefulWidget {
  const DiscoverScreen({super.key});

  @override
  State<DiscoverScreen> createState() => _DiscoverScreenState();
}

class _DiscoverScreenState extends State<DiscoverScreen> {
  final _searchController = TextEditingController();
  Map<String, dynamic>? _currentUser;
  List<Map<String, dynamic>> _results = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadInitialData();
  }

  Future<void> _loadInitialData() async {
    _currentUser = await AuthService().getUser();
    await _performSearch();
  }

  Future<void> _performSearch({String? query}) async {
    setState(() => _isLoading = true);
    final db = DatabaseHelper();
    
    if (_currentUser?['role'] == 'professional') {
      _results = await db.getJobs(status: 'active', query: query);
    } else {
      _results = await db.searchProfessionals(query: query);
    }

    if (mounted) {
      setState(() {
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.bgLight,
      appBar: _buildAppBar(context),
      body: Stack(
        children: [
          _isLoading 
            ? const AnimatedLoadingIndicator(color: AppTheme.brandBlue)
            : SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: 24),
                    _buildSearchAndFilters(context),
                    const SizedBox(height: 24),
                    _buildFilterChips(context),
                    const SizedBox(height: 32),
                    Text('${_results.length} ${_currentUser?['role'] == 'professional' ? 'jobs' : 'professionals'} found', style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w800, fontSize: 18, color: AppTheme.brandNavy)),
                    const Text('Based on your current search and location', style: TextStyle(color: AppTheme.textGray, fontSize: 12)),
                    const SizedBox(height: 24),
                    _currentUser?['role'] == 'professional' ? _buildJobsList(context) : _buildProList(context),
                    const SizedBox(height: 40),
                    _buildFooter(context),
                    const SizedBox(height: 40),
                  ],
                ),
              ),
          Positioned(
            bottom: 40,
            left: 0,
            right: 0,
            child: Center(
              child: _buildFloatingFilterButton(context),
            ),
          ),
        ],
      ),
    );
  }

  PreferredSizeWidget _buildAppBar(BuildContext context) {
    return AppBar(
      backgroundColor: Colors.white,
      elevation: 0,
      leading: IconButton(
        icon: const Icon(Icons.arrow_back, color: AppTheme.brandNavy),
        onPressed: () {
          if (context.canPop()) {
            context.pop();
          } else {
            context.go('/');
          }
        },
      ),
      title: Text('ProConnect', style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w900, color: AppTheme.brandNavy)),
      actions: [
        if (_currentUser?['role'] != 'professional')
          ElevatedButton(
            onPressed: () => context.push('/post-job'),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.brandNavy,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              minimumSize: Size.zero,
            ),
            child: const Text('Post a Job', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
          ),
        const SizedBox(width: 24),
      ],
    );
  }

  Widget _buildSearchAndFilters(BuildContext context) {
    return Column(
      children: [
        TextField(
          controller: _searchController,
          decoration: InputDecoration(
            hintText: _currentUser?['role'] == 'professional' ? 'Search for jobs (e.g. Flutter, Plumbing)' : 'Search for experts (e.g. UI Designer, Plumber)',
            prefixIcon: const Icon(Icons.search),
            fillColor: Colors.white,
            filled: true,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
          ),
          onSubmitted: (v) => _performSearch(query: v),
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: () {},
                icon: const Icon(Icons.tune, size: 18),
                label: const Text('Filters', style: TextStyle(fontWeight: FontWeight.bold)),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  side: const BorderSide(color: Color(0xFFE2E8F0)),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              flex: 2,
              child: ElevatedButton(
                onPressed: () => _performSearch(query: _searchController.text),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.brandBlue,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: const Text('Search', style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            ),
          ],
        )
      ],
    );
  }

  Widget _buildFilterChips(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          _filterChip('Verified Pros', true),
          _filterChip('Rating 4.5+', false),
          _filterChip('Budget: \$0-200', false),
        ],
      ),
    );
  }

  Widget _filterChip(String label, bool active) {
    return Container(
      margin: const EdgeInsets.only(right: 12),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: active ? AppTheme.brandBlue : Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: active ? AppTheme.brandBlue : const Color(0xFFE2E8F0)),
      ),
      child: Text(label, style: TextStyle(color: active ? Colors.white : AppTheme.brandNavy, fontWeight: FontWeight.bold, fontSize: 12)),
    );
  }

  Widget _buildJobsList(BuildContext context) {
    if (_results.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(40),
        child: const Center(child: Text('No active jobs found match your search.')),
      );
    }
    return Column(
      children: _results.asMap().entries.map((entry) => FadeSlideIn(
        delay: Duration(milliseconds: entry.key < 8 ? entry.key * 45 : 360),
        child: _buildJobCard(context, entry.value),
      )).toList(),
    );
  }

  Widget _buildJobCard(BuildContext context, Map<String, dynamic> job) {
    return Container(
      margin: const EdgeInsets.only(bottom: 24),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFF1F5F9)),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.02), blurRadius: 10, offset: const Offset(0, 4))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: const Color(0xFFEEF2FF), borderRadius: BorderRadius.circular(16)),
                child: const Icon(Icons.work_outline, color: Color(0xFF1E40AF)),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(job['title'] ?? 'Job Title', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                    Text('${job['city'] ?? 'Remote'} • ${job['service_type'] ?? 'One-time'}', style: const TextStyle(color: AppTheme.textGray, fontSize: 12)),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(color: const Color(0xFFEEF2FF), borderRadius: BorderRadius.circular(8)),
                child: Text('\$${job['min_budget']}', style: const TextStyle(color: Color(0xFF1E40AF), fontWeight: FontWeight.bold, fontSize: 12)),
              )
            ],
          ),
          const SizedBox(height: 16),
          Text(job['description'] ?? '', style: const TextStyle(color: AppTheme.textGray, fontSize: 13, height: 1.5), maxLines: 2, overflow: TextOverflow.ellipsis),
          const SizedBox(height: 20),
          ElevatedButton(
            onPressed: () => context.push('/job/${job['id']}'),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.brandBlue,
              minimumSize: const Size(double.infinity, 50),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: const Text('View Details & Apply', style: TextStyle(fontWeight: FontWeight.bold)),
          )
        ],
      ),
    );
  }

  Widget _buildProList(BuildContext context) {
    if (_results.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(40),
        child: const Center(child: Text('No professionals found match your search.')),
      );
    }
    return Column(
      children: _results.asMap().entries.map((entry) => FadeSlideIn(
        delay: Duration(milliseconds: entry.key < 8 ? entry.key * 45 : 360),
        child: _buildProCard(context, entry.value),
      )).toList(),
    );
  }

  Widget _buildProCard(BuildContext context, Map<String, dynamic> pro) {
    return Container(
      margin: const EdgeInsets.only(bottom: 24),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFF1F5F9)),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.02), blurRadius: 10, offset: const Offset(0, 4))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Stack(
                children: [
                  CircleAvatar(radius: 28, backgroundImage: NetworkImage(pro['profile_photo'] ?? 'https://i.pravatar.cc/100?u=${pro['user_id']}')),
                  if (pro['verification_status'] == 'verified')
                    Positioned(
                      bottom: 0,
                      right: 0,
                      child: Container(
                        padding: const EdgeInsets.all(2),
                        decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
                        child: const Icon(Icons.verified, color: AppTheme.brandBlue, size: 16),
                      ),
                    )
                ],
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(pro['full_name'] ?? 'Professional', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                    Text(pro['profession'] ?? 'Service Provider', style: const TextStyle(color: AppTheme.textGray, fontSize: 13)),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Row(children: [const Icon(Icons.star, color: AppTheme.brandOrange, size: 14), const SizedBox(width: 4), Text('${pro['average_rating'] ?? 0.0}', style: const TextStyle(fontWeight: FontWeight.bold))]),
                  Text('${pro['total_reviews'] ?? 0} reviews', style: const TextStyle(color: AppTheme.textGray, fontSize: 10)),
                ],
              )
            ],
          ),
          const SizedBox(height: 16),
          if (pro['skills'] != null)
            Wrap(
              spacing: 8,
              children: (pro['skills'] as String).split(',').take(3).map((s) => Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(color: AppTheme.bgLight, borderRadius: BorderRadius.circular(8)),
                child: Text(s.trim(), style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppTheme.textGray)),
              )).toList(),
            ),
          const SizedBox(height: 16),
          Text(pro['about'] ?? 'No description provided.', style: const TextStyle(color: AppTheme.textGray, fontSize: 13, height: 1.5), maxLines: 2, overflow: TextOverflow.ellipsis),
          const SizedBox(height: 20),
          const Divider(color: Color(0xFFF1F5F9)),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Starting at', style: TextStyle(color: AppTheme.textGray, fontSize: 10, fontWeight: FontWeight.bold)),
                  Text('\$${pro['hourly_rate'] ?? 0}/hr', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: AppTheme.brandNavy)),
                ],
              ),
              ElevatedButton(
                onPressed: () => context.push('/pro/${pro['user_id']}'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.brandNavy,
                  padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                child: const Text('Hire', style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            ],
          )
        ],
      ),
    );
  }

  Widget _buildFloatingFilterButton(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
      decoration: BoxDecoration(
        color: AppTheme.brandNavy,
        borderRadius: BorderRadius.circular(30),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.2), blurRadius: 20, offset: const Offset(0, 10))],
      ),
      child: const Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.tune, color: Colors.white, size: 20),
          SizedBox(width: 12),
          Text('Adjust Filters', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }

  Widget _buildFooter(BuildContext context) {
    return const Column(
      children: [
        Divider(color: Color(0xFFE2E8F0)),
        SizedBox(height: 40),
        Text('© 2024 ProConnect Marketplace. All rights reserved.', style: TextStyle(color: AppTheme.textGray, fontSize: 12)),
        SizedBox(height: 12),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text('Privacy Policy', style: TextStyle(color: Color(0xFF2563EB), fontSize: 12)),
            SizedBox(width: 16),
            Text('Terms of Service', style: TextStyle(color: Color(0xFF2563EB), fontSize: 12)),
            SizedBox(width: 16),
            Text('Trust & Safety', style: TextStyle(color: Color(0xFF2563EB), fontSize: 12)),
          ],
        ),
      ],
    );
  }
}
