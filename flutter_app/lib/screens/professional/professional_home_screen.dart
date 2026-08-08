import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

/// The professional's home screen. Deliberately built as its own layout
/// (dark gradient hero, job-feed centric sections) instead of reusing the
/// client's light card-grid home page, since professionals browse and apply
/// to work rather than post it.
class ProfessionalHomeScreen extends StatelessWidget {
  const ProfessionalHomeScreen({
    super.key,
    required this.user,
    required this.stats,
    required this.availableJobs,
    required this.focusItems,
    required this.latestUpdate,
  });

  final Map<String, dynamic> user;
  final Map<String, dynamic> stats;
  final List<Map<String, dynamic>> availableJobs;
  final List<Map<String, dynamic>> focusItems;
  final Map<String, dynamic>? latestUpdate;

  String get _firstName =>
      (user['full_name'] ?? user['firstName'] ?? 'there').toString().trim().split(RegExp(r'\s+')).first;

  double _num(dynamic value) => double.tryParse('${value ?? 0}') ?? 0;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 40),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _hero(context),
          const SizedBox(height: 20),
          _statsGrid(context),
          if (latestUpdate != null) ...[const SizedBox(height: 20), _updateBanner(context)],
          const SizedBox(height: 28),
          _quickActions(context),
          const SizedBox(height: 34),
          _sectionHeader(context, 'Jobs for you', onViewAll: () => context.push('/jobs')),
          const SizedBox(height: 14),
          _jobsFeed(context),
          const SizedBox(height: 34),
          _sectionHeader(context, 'Your active work', onViewAll: null),
          const SizedBox(height: 14),
          _activeWork(context),
        ],
      ),
    );
  }

  Widget _hero(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(22, 22, 22, 24),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF0B1220), Color(0xFF123B6B), Color(0xFF0E7C8C)],
        ),
        borderRadius: BorderRadius.circular(28),
        boxShadow: const [BoxShadow(color: Color(0x330B1220), blurRadius: 24, offset: Offset(0, 14))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20)),
                      child: const Row(mainAxisSize: MainAxisSize.min, children: [
                        Icon(Icons.verified_rounded, size: 13, color: Color(0xFF5EEAD4)),
                        SizedBox(width: 5),
                        Text('PROFESSIONAL WORKSPACE', style: TextStyle(color: Color(0xFF5EEAD4), fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: 0.6)),
                      ]),
                    ),
                    const SizedBox(height: 14),
                    Text('Hello, $_firstName', style: GoogleFonts.plusJakartaSans(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w800)),
                    const SizedBox(height: 6),
                    const Text('Ready to find your next job today?', style: TextStyle(color: Color(0xFFB9C6DC), fontSize: 13)),
                  ],
                ),
              ),
              InkWell(
                onTap: () => context.push('/profile'),
                borderRadius: BorderRadius.circular(24),
                child: CircleAvatar(
                  radius: 22,
                  backgroundColor: Colors.white.withValues(alpha: 0.14),
                  backgroundImage: _avatar(),
                  child: _avatar() == null ? const Icon(Icons.person_outline, color: Colors.white) : null,
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          GestureDetector(
            onTap: () => context.push('/jobs'),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
              child: const Row(children: [
                Icon(Icons.search, color: Color(0xFF64748B)),
                SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Search for jobs (e.g. Logo Design, Plumber)',
                    style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13.5),
                    overflow: TextOverflow.ellipsis,
                    maxLines: 1,
                  ),
                ),
              ]),
            ),
          ),
        ],
      ),
    );
  }

  ImageProvider? _avatar() {
    final value = (user['avatarUrl'] ?? user['profile_image'] ?? '').toString();
    return value.startsWith('http') ? NetworkImage(value) : null;
  }

  Widget _statsGrid(BuildContext context) {
    final tiles = [
      _StatTileData('${stats['active_jobs'] ?? 0}', 'Active jobs', Icons.rocket_launch_outlined, const Color(0xFF0E7C8C), () => context.push('/jobs')),
      _StatTileData('${stats['jobs_applied'] ?? 0}', 'Applications sent', Icons.assignment_outlined, const Color(0xFF7C3AED), () => context.push('/jobs')),
      _StatTileData('\$${_num(stats['total_earnings']).toStringAsFixed(0)}', 'Total earned', Icons.payments_outlined, const Color(0xFF0F8C4E), () => context.push('/earnings')),
      _StatTileData(_num(stats['average_rating']) > 0 ? _num(stats['average_rating']).toStringAsFixed(1) : '—', 'Rating', Icons.star_rounded, const Color(0xFFB45309), () => context.push('/profile')),
    ];
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, crossAxisSpacing: 14, mainAxisSpacing: 14, childAspectRatio: 1.5),
      itemCount: tiles.length,
      itemBuilder: (context, index) {
        final tile = tiles[index];
        return InkWell(
          onTap: tile.onTap,
          borderRadius: BorderRadius.circular(20),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), border: Border.all(color: const Color(0xFFF1F5F9)), boxShadow: const [BoxShadow(color: Color(0x0A0F172A), blurRadius: 12, offset: Offset(0, 5))]),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(padding: const EdgeInsets.all(7), decoration: BoxDecoration(color: tile.color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(12)), child: Icon(tile.icon, color: tile.color, size: 16)),
                const SizedBox(height: 10),
                Text(tile.value, maxLines: 1, overflow: TextOverflow.ellipsis, style: GoogleFonts.plusJakartaSans(fontSize: 19, fontWeight: FontWeight.w800, color: const Color(0xFF0F172A))),
                Text(tile.label, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B), fontWeight: FontWeight.w600)),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _updateBanner(BuildContext context) {
    return GestureDetector(
      onTap: () => context.push('/notifications'),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(color: const Color(0xFFECFEFF), borderRadius: BorderRadius.circular(20), border: Border.all(color: const Color(0xFFA5F3FC))),
        child: Row(children: [
          Container(padding: const EdgeInsets.all(10), decoration: const BoxDecoration(color: Color(0xFF0E7C8C), shape: BoxShape.circle), child: const Icon(Icons.notifications_active_outlined, color: Colors.white, size: 18)),
          const SizedBox(width: 14),
          Expanded(child: Text(latestUpdate?['message'] ?? '', style: const TextStyle(fontWeight: FontWeight.w700, color: Color(0xFF0E4F5C)))),
          const Icon(Icons.chevron_right, color: Color(0xFF0E7C8C)),
        ]),
      ),
    );
  }

  Widget _quickActions(BuildContext context) {
    final actions = [
      {'name': 'Find Jobs', 'icon': Icons.travel_explore_outlined, 'route': '/jobs'},
      {'name': 'Saved Jobs', 'icon': Icons.bookmark_outline, 'route': '/saved-jobs'},
      {'name': 'Messages', 'icon': Icons.chat_bubble_outline, 'route': '/messages'},
      {'name': 'Earnings', 'icon': Icons.account_balance_wallet_outlined, 'route': '/earnings'},
    ];
    return LayoutBuilder(
      builder: (context, constraints) {
        final columns = constraints.maxWidth >= 880 ? 4 : 2;
        return GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: columns, crossAxisSpacing: 14, mainAxisSpacing: 14, childAspectRatio: columns == 4 ? 2.1 : 1.7),
          itemCount: actions.length,
          itemBuilder: (context, index) => InkWell(
            onTap: () => context.push(actions[index]['route'] as String),
            borderRadius: BorderRadius.circular(18),
            child: Ink(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: const Color(0xFFE7EDF6)),
                boxShadow: const [BoxShadow(color: Color(0x0D0F172A), blurRadius: 18, offset: Offset(0, 7))],
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(padding: const EdgeInsets.all(10), decoration: const BoxDecoration(color: Color(0xFFE6F6F6), shape: BoxShape.circle), child: Icon(actions[index]['icon'] as IconData, color: const Color(0xFF0E7C8C), size: 20)),
                  const SizedBox(width: 10),
                  Text(actions[index]['name'] as String, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF1E293B))),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _sectionHeader(BuildContext context, String title, {VoidCallback? onViewAll}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(title, style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
        if (onViewAll != null)
          TextButton.icon(
            onPressed: onViewAll,
            icon: const Text('View all', style: TextStyle(color: Color(0xFF0E7C8C), fontWeight: FontWeight.bold)),
            label: const Icon(Icons.open_in_new, size: 14, color: Color(0xFF0E7C8C)),
          ),
      ],
    );
  }

  Widget _jobsFeed(BuildContext context) {
    if (availableJobs.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(32),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(24), border: Border.all(color: const Color(0xFFF1F5F9))),
        child: const Center(child: Text('No open jobs match your profile yet.')),
      );
    }
    return Column(
      children: availableJobs.take(4).map((job) {
        final urgency = (job['urgency'] ?? '').toString().toUpperCase();
        final urgencyColor = urgency == 'HIGH' ? const Color(0xFFDC2626) : urgency == 'LOW' ? const Color(0xFF0F8C77) : const Color(0xFFB45309);
        return Padding(
          padding: const EdgeInsets.only(bottom: 14),
          child: GestureDetector(
            onTap: () => context.push('/job/${job['id']}'),
            child: Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22), border: Border(left: BorderSide(color: urgencyColor, width: 4)), boxShadow: const [BoxShadow(color: Color(0x0A0F172A), blurRadius: 14, offset: Offset(0, 6))]),
              child: Row(children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text((job['title'] ?? 'Untitled job').toString(), maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15.5, color: Color(0xFF0F172A))),
                    const SizedBox(height: 5),
                    Text('\$${job['budget'] ?? job['budgetMin'] ?? 'Negotiable'} • ${job['city'] ?? job['locationLabel'] ?? 'Remote'}', style: const TextStyle(color: Color(0xFF64748B), fontSize: 12.5)),
                  ]),
                ),
                const SizedBox(width: 10),
                const Icon(Icons.chevron_right_rounded, color: Color(0xFF94A3B8)),
              ]),
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _activeWork(BuildContext context) {
    if (focusItems.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(24), border: Border.all(color: const Color(0xFFF1F5F9))),
        child: const Center(child: Text('No active jobs right now — browse open jobs above.')),
      );
    }
    return Column(
      children: focusItems.take(2).map((job) {
        final status = (job['status'] ?? '').toString();
        final isCompleted = status == 'completed';
        return Padding(
          padding: const EdgeInsets.only(bottom: 14),
          child: Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22), border: Border.all(color: const Color(0xFFF1F5F9))),
            child: Column(children: [
              Row(children: [
                Container(width: 44, height: 44, decoration: BoxDecoration(color: const Color(0xFFE6F6F6), borderRadius: BorderRadius.circular(12)), child: const Icon(Icons.work_outline, color: Color(0xFF0E7C8C), size: 22)),
                const SizedBox(width: 14),
                Expanded(child: Text((job['title'] ?? 'Job').toString(), maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15))),
                Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6), decoration: BoxDecoration(color: (isCompleted ? const Color(0xFF0F8C77) : const Color(0xFF0E7C8C)).withValues(alpha: 0.12), borderRadius: BorderRadius.circular(8)), child: Text(isCompleted ? 'DONE' : 'IN PROGRESS', style: TextStyle(color: isCompleted ? const Color(0xFF0F8C77) : const Color(0xFF0E7C8C), fontSize: 10, fontWeight: FontWeight.w900))),
              ]),
              const SizedBox(height: 16),
              Stack(children: [
                Container(height: 6, decoration: BoxDecoration(color: const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(10))),
                FractionallySizedBox(widthFactor: isCompleted ? 1.0 : 0.45, child: Container(height: 6, decoration: BoxDecoration(color: const Color(0xFF0E7C8C), borderRadius: BorderRadius.circular(10)))),
              ]),
            ]),
          ),
        );
      }).toList(),
    );
  }
}

class _StatTileData {
  const _StatTileData(this.value, this.label, this.icon, this.color, this.onTap);
  final String value;
  final String label;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;
}
