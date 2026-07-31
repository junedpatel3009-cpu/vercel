import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/app_theme.dart';
import '../../core/database/database_helper.dart';

class ServicesScreen extends StatefulWidget {
  const ServicesScreen({super.key});

  @override
  State<ServicesScreen> createState() => _ServicesScreenState();
}

class _ServicesScreenState extends State<ServicesScreen> {
  List<Map<String, dynamic>> _categories = [];
  Map<int, List<Map<String, dynamic>>> _subcategories = {};
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final db = DatabaseHelper();
    final cats = await db.getCategories();
    for (var cat in cats) {
      final subs = await db.getSubcategories(cat['id']);
      _subcategories[cat['id']] = subs;
    }
    if (mounted) {
      setState(() {
        _categories = cats;
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.bgLight,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: Text('Service Categories', style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w900, color: AppTheme.brandNavy)),
      ),
      body: _isLoading 
        ? const Center(child: CircularProgressIndicator())
        : ListView.builder(
            padding: const EdgeInsets.all(24),
            itemCount: _categories.length,
            itemBuilder: (context, index) {
              final cat = _categories[index];
              final subs = _subcategories[cat['id']] ?? [];
              return _buildCategorySection(cat, subs);
            },
          ),
    );
  }

  Widget _buildCategorySection(Map<String, dynamic> cat, List<Map<String, dynamic>> subs) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(color: AppTheme.brandBlue.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(10)),
              child: Icon(_getIcon(cat['icon']), color: AppTheme.brandBlue, size: 20),
            ),
            const SizedBox(width: 12),
            Text(cat['name'] ?? '', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppTheme.brandNavy)),
          ],
        ),
        const SizedBox(height: 16),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            crossAxisSpacing: 16,
            mainAxisSpacing: 16,
            childAspectRatio: 2.5,
          ),
          itemCount: subs.length,
          itemBuilder: (context, index) {
            final sub = subs[index];
            return GestureDetector(
              onTap: () => context.push('/discover?category=${cat['id']}&subcategory=${sub['id']}'),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFFF1F5F9))),
                child: Center(
                  child: Text(
                    sub['name'] ?? '',
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                    textAlign: TextAlign.center,
                  ),
                ),
              ),
            );
          },
        ),
        const SizedBox(height: 32),
      ],
    );
  }

  IconData _getIcon(String? iconName) {
    switch (iconName) {
      case 'home': return Icons.home_outlined;
      case 'computer': return Icons.computer_outlined;
      case 'brush': return Icons.brush_outlined;
      case 'edit': return Icons.edit_note_outlined;
      case 'person': return Icons.person_outline;
      default: return Icons.grid_view_outlined;
    }
  }
}
