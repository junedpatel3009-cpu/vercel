import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

/// The client's home screen. Shares the same visual language as the
/// professional's home screen (gradient hero, stat tiles, quick-action
/// cards, section feeds) but in the client's blue palette and with
/// client-only actions like posting a job and browsing professionals.
class ClientHomeScreen extends StatelessWidget {
  const ClientHomeScreen({
    super.key,
    required this.user,
    required this.stats,
    required this.recommendedPros,
    required this.publicJobs,
    required this.focusItems,
    required this.latestUpdate,
  });

  final Map<String, dynamic> user;
  final Map<String, dynamic> stats;
  final List<Map<String, dynamic>> recommendedPros;
  final List<Map<String, dynamic>> publicJobs;
  final List<Map<String, dynamic>> focusItems;
  final Map<String, dynamic>? latestUpdate;

  String get _firstName =>
      (user['full_name'] ?? user['firstName'] ?? 'there').toString().trim().split(RegExp(r'\s+')).first;

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
          _sectionHeader(context, 'Recommended for you', onViewAll: () => context.push('/discover')),
          const SizedBox(height: 14),
          _recommendedList(context),
          const SizedBox(height: 34),
          _sectionHeader(context, 'Latest jobs', onViewAll: () => context.push('/jobs')),
          const SizedBox(height: 14),
          _latestJobsList(context),
          const SizedBox(height: 34),
          _sectionHeader(context, 'Current focus', onViewAll: () => context.push('/projects')),
          const SizedBox(height: 14),
          _currentFocusList(context),
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
          colors: [Color(0xFF0B1220), Color(0xFF15337A), Color(0xFF2563EB)],
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
                        Icon(Icons.workspace_premium_outlined, size: 13, color: Color(0xFF93C5FD)),
                        SizedBox(width: 5),
                        Text('CLIENT WORKSPACE', style: TextStyle(color: Color(0xFF93C5FD), fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: 0.6)),
                      ]),
                    ),
                    const SizedBox(height: 14),
                    Text('Hello, $_firstName', style: GoogleFonts.plusJakartaSans(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w800)),
                    const SizedBox(height: 6),
                    const Text('What professional service do you need today?', style: TextStyle(color: Color(0xFFB9C6DC), fontSize: 13)),
                  ],
                ),
              ),
              InkWell(
                onTap: () => context.push('/dashboard'),
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
            onTap: () => context.push('/discover'),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
              child: const Row(children: [
                Icon(Icons.search, color: Color(0xFF64748B)),
                SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Search for experts (e.g. UI Designer, Plumber)',
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
      _StatTileData('${stats['active_jobs'] ?? 0}', 'Active projects', Icons.check_box_outlined, const Color(0xFF2563EB), () => context.push('/projects')),
      _StatTileData('${stats['total_jobs_posted'] ?? 0}', 'Total posted', Icons.assignment_outlined, const Color(0xFF7C3AED), () => context.push('/dashboard')),
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
        decoration: BoxDecoration(color: const Color(0xFFEFF4FF), borderRadius: BorderRadius.circular(20), border: Border.all(color: const Color(0xFFBFD1F4))),
        child: Row(children: [
          Container(padding: const EdgeInsets.all(10), decoration: const BoxDecoration(color: Color(0xFF2563EB), shape: BoxShape.circle), child: const Icon(Icons.notifications_active_outlined, color: Colors.white, size: 18)),
          const SizedBox(width: 14),
          Expanded(child: Text(latestUpdate?['message'] ?? '', style: const TextStyle(fontWeight: FontWeight.w700, color: Color(0xFF15337A)))),
          const Icon(Icons.chevron_right, color: Color(0xFF2563EB)),
        ]),
      ),
    );
  }

  Widget _quickActions(BuildContext context) {
    final actions = [
      {'name': 'Post a Job', 'icon': Icons.add_circle_outline, 'route': '/post-job'},
      {'name': 'Search', 'icon': Icons.search_outlined, 'route': '/discover'},
      {'name': 'Categories', 'icon': Icons.grid_view_outlined, 'route': '/services'},
      {'name': 'Saved jobs', 'icon': Icons.bookmark_outline, 'route': '/saved-jobs'},
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
                  Container(padding: const EdgeInsets.all(10), decoration: const BoxDecoration(color: Color(0xFFEEF2FF), shape: BoxShape.circle), child: Icon(actions[index]['icon'] as IconData, color: const Color(0xFF2563EB), size: 20)),
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
            icon: const Text('View all', style: TextStyle(color: Color(0xFF2563EB), fontWeight: FontWeight.bold)),
            label: const Icon(Icons.open_in_new, size: 14, color: Color(0xFF2563EB)),
          ),
      ],
    );
  }

  Widget _recommendedList(BuildContext context) {
    if (recommendedPros.isEmpty) {
      return Container(
        height: 150,
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(24), border: Border.all(color: const Color(0xFFF1F5F9))),
        child: const Center(child: Text('No experts found yet.')),
      );
    }
    return SizedBox(
      height: 210,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: recommendedPros.length,
        separatorBuilder: (context, index) => const SizedBox(width: 14),
        itemBuilder: (context, index) {
          final pro = recommendedPros[index];
          return GestureDetector(
            onTap: () => context.push('/pro/${pro['user_id']}'),
            child: Container(
              width: 190,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22), border: Border.all(color: const Color(0xFFF1F5F9)), boxShadow: const [BoxShadow(color: Color(0x0A0F172A), blurRadius: 12, offset: Offset(0, 5))]),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(width: 44, height: 44, decoration: const BoxDecoration(color: Color(0xFFEEF2FF), shape: BoxShape.circle), child: const Icon(Icons.person_outline, color: Color(0xFF2563EB))),
                  const SizedBox(height: 14),
                  Text((pro['full_name'] ?? 'Expert').toString(), maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                  const SizedBox(height: 4),
                  Text((pro['profession'] ?? 'Service Professional').toString(), maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Color(0xFF64748B), fontSize: 12)),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _latestJobsList(BuildContext context) {
    if (publicJobs.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(32),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(24), border: Border.all(color: const Color(0xFFF1F5F9))),
        child: const Center(child: Text('No open jobs yet.')),
      );
    }
    return Column(
      children: publicJobs.take(3).map((job) {
        return Padding(
          padding: const EdgeInsets.only(bottom: 14),
          child: GestureDetector(
            onTap: () => context.push('/job/${job['id']}'),
            child: Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22), border: const Border(left: BorderSide(color: Color(0xFF2563EB), width: 4)), boxShadow: const [BoxShadow(color: Color(0x0A0F172A), blurRadius: 14, offset: Offset(0, 6))]),
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

  Widget _currentFocusList(BuildContext context) {
    if (focusItems.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(24), border: Border.all(color: const Color(0xFFF1F5F9))),
        child: const Center(child: Text('No active focuses right now.')),
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
                Container(width: 44, height: 44, decoration: const BoxDecoration(color: Color(0xFFEEF2FF), borderRadius: BorderRadius.all(Radius.circular(12))), child: const Icon(Icons.rocket_launch_outlined, color: Color(0xFF2563EB), size: 22)),
                const SizedBox(width: 14),
                Expanded(child: Text((job['title'] ?? 'Job').toString(), maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15))),
                Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6), decoration: BoxDecoration(color: (isCompleted ? const Color(0xFF0F8C77) : const Color(0xFF2563EB)).withValues(alpha: 0.12), borderRadius: BorderRadius.circular(8)), child: Text(isCompleted ? 'DONE' : 'RECRUITING', style: TextStyle(color: isCompleted ? const Color(0xFF0F8C77) : const Color(0xFF2563EB), fontSize: 10, fontWeight: FontWeight.w900))),
              ]),
              const SizedBox(height: 16),
              Stack(children: [
                Container(height: 6, decoration: BoxDecoration(color: const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(10))),
                FractionallySizedBox(widthFactor: isCompleted ? 1.0 : 0.4, child: Container(height: 6, decoration: BoxDecoration(color: const Color(0xFF2563EB), borderRadius: BorderRadius.circular(10)))),
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
