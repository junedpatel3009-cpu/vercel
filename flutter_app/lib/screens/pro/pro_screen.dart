import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/theme/app_theme.dart';
import '../../core/database/database_helper.dart';

class ProScreen extends StatefulWidget {
  final String proId;
  const ProScreen({super.key, required this.proId});

  @override
  State<ProScreen> createState() => _ProScreenState();
}

class _ProScreenState extends State<ProScreen> {
  Map<String, dynamic>? _pro;
  List<Map<String, dynamic>> _reviews = [];
  List<Map<String, dynamic>> _portfolio = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadProData();
  }

  Future<void> _loadProData() async {
    final db = DatabaseHelper();
    int userId = int.tryParse(widget.proId) ?? 0;
    if (userId == 0 && widget.proId.startsWith('p')) {
        // Fallback for legacy mock IDs p1, p2...
        userId = int.tryParse(widget.proId.substring(1)) ?? 0;
    }

    final pro = await db.getProfessionalProfile(userId);
    if (pro != null) {
      final user = await db.database.then((d) => d.query('users', where: 'id = ?', whereArgs: [userId]));
      if (user.isNotEmpty) {
        final reviews = await db.getReviews(userId);
        final portfolio = await db.getPortfolio(userId);
        if (mounted) {
          setState(() {
            _pro = {...user.first, ...pro};
            _reviews = reviews;
            _portfolio = portfolio;
            _isLoading = false;
          });
        }
        return;
      }
    }
    
    if (mounted) setState(() => _isLoading = false);
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    if (_pro == null) return const Scaffold(body: Center(child: Text('Professional not found')));

    return Scaffold(
      backgroundColor: AppTheme.bgLight,
      body: CustomScrollView(
        slivers: [
          _buildSliverAppBar(),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildProfileHeader(),
                  const SizedBox(height: 32),
                  _buildAboutSection(),
                  const SizedBox(height: 32),
                  _buildSkillsSection(),
                  const SizedBox(height: 32),
                  _buildPortfolioSection(),
                  const SizedBox(height: 32),
                  _buildReviewsSection(),
                  const SizedBox(height: 100),
                ],
              ),
            ),
          ),
        ],
      ),
      bottomSheet: _buildBottomAction(),
    );
  }

  Widget _buildSliverAppBar() {
    return SliverAppBar(
      expandedHeight: 300,
      pinned: true,
      flexibleSpace: FlexibleSpaceBar(
        background: Image.network(
          _pro!['profile_photo'] ?? 'https://i.pravatar.cc/600?u=${_pro!['id']}',
          fit: BoxFit.cover,
        ),
      ),
    );
  }

  Widget _buildProfileHeader() {
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(_pro!['full_name'] ?? '', style: GoogleFonts.plusJakartaSans(fontSize: 28, fontWeight: FontWeight.w800, color: AppTheme.brandNavy)),
              Text(_pro!['profession'] ?? '', style: const TextStyle(fontSize: 16, color: AppTheme.textGray)),
            ],
          ),
        ),
        Column(
          children: [
            Text('\$${_pro!['hourly_rate'] ?? 0}', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: AppTheme.brandBlue)),
            const Text('/hr', style: TextStyle(color: AppTheme.textGray, fontSize: 12)),
          ],
        )
      ],
    );
  }

  Widget _buildAboutSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('About', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
        const SizedBox(height: 12),
        Text(_pro!['about'] ?? 'No bio provided.', style: const TextStyle(color: AppTheme.textGray, height: 1.6)),
      ],
    );
  }

  Widget _buildSkillsSection() {
    if (_pro!['skills'] == null) return const SizedBox.shrink();
    final skills = (_pro!['skills'] as String).split(',');
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Skills', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: skills.map((s) => Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFFE2E8F0))),
            child: Text(s.trim(), style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.brandNavy)),
          )).toList(),
        ),
      ],
    );
  }

  Widget _buildPortfolioSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Portfolio', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
        const SizedBox(height: 16),
        _portfolio.isEmpty 
          ? const Text('No portfolio items added yet.', style: TextStyle(color: AppTheme.textGray))
          : SizedBox(
              height: 200,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: _portfolio.length,
                separatorBuilder: (c, i) => const SizedBox(width: 16),
                itemBuilder: (c, i) => Container(
                  width: 280,
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), border: Border.all(color: const Color(0xFFF1F5F9))),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(20),
                    child: Image.network(_portfolio[i]['image_url'] ?? 'https://picsum.photos/400/300', fit: BoxFit.cover),
                  ),
                ),
              ),
            ),
      ],
    );
  }

  Widget _buildReviewsSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text('Reviews', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
            Row(children: [const Icon(Icons.star, color: AppTheme.brandOrange, size: 20), const SizedBox(width: 4), Text('${_pro!['average_rating']}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18))]),
          ],
        ),
        const SizedBox(height: 16),
        _reviews.isEmpty 
          ? const Text('No reviews yet.', style: TextStyle(color: AppTheme.textGray))
          : Column(
              children: _reviews.map((r) => Container(
                margin: const EdgeInsets.only(bottom: 16),
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), border: Border.all(color: const Color(0xFFF1F5F9))),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        CircleAvatar(backgroundImage: NetworkImage(r['profile_photo'] ?? 'https://i.pravatar.cc/100?u=${r['from_user_id']}')),
                        const SizedBox(width: 12),
                        Text(r['full_name'] ?? 'User', style: const TextStyle(fontWeight: FontWeight.bold)),
                        const Spacer(),
                        Row(children: List.generate(5, (i) => Icon(Icons.star, size: 12, color: i < r['rating'] ? AppTheme.brandOrange : Colors.grey[300]))),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Text(r['comment'] ?? '', style: const TextStyle(color: AppTheme.textGray)),
                  ],
                ),
              )).toList(),
            ),
      ],
    );
  }

  Widget _buildBottomAction() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: const BoxDecoration(color: Colors.white, border: Border(top: BorderSide(color: Color(0xFFF1F5F9)))),
      child: Row(
        children: [
          IconButton(
            onPressed: () {},
            icon: const Icon(Icons.chat_bubble_outline),
            style: IconButton.styleFrom(padding: const EdgeInsets.all(16), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: const BorderSide(color: Color(0xFFE2E8F0)))),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: ElevatedButton(
              onPressed: () {},
              style: ElevatedButton.styleFrom(backgroundColor: AppTheme.brandNavy, padding: const EdgeInsets.symmetric(vertical: 16), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
              child: const Text('Hire Now', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
          ),
        ],
      ),
    );
  }
}
