import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../../core/theme/app_theme.dart';
import '../../core/database/database_helper.dart';
import '../../core/auth/auth_service.dart';
import '../../widgets/motion.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  List<Map<String, dynamic>> _notifications = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadNotifications();
  }

  Future<void> _loadNotifications() async {
    final user = await AuthService().getUser();
    if (user != null) {
      final db = DatabaseHelper();
      final notes = await db.getNotifications(user['id']);
      if (mounted) {
        setState(() {
          _notifications = notes;
          _isLoading = false;
        });
      }
    } else {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.bgLight,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: Text('Notifications', style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w900, color: AppTheme.brandNavy)),
        actions: [
          TextButton(onPressed: () {}, child: const Text('Mark all read')),
          const SizedBox(width: 8),
        ],
      ),
      body: _isLoading 
        ? const AnimatedLoadingIndicator(color: AppTheme.brandBlue)
        : _notifications.isEmpty
          ? _buildEmptyState()
          : ListView.builder(
              padding: const EdgeInsets.all(24),
              itemCount: _notifications.length,
              itemBuilder: (context, index) => FadeSlideIn(
                delay: Duration(milliseconds: index < 8 ? index * 45 : 360),
                child: _buildNotificationItem(_notifications[index]),
              ),
            ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.notifications_none, size: 64, color: Colors.grey[300]),
          const SizedBox(height: 16),
          const Text('You have no notifications', style: TextStyle(color: AppTheme.textGray, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }

  Widget _buildNotificationItem(Map<String, dynamic> note) {
    final isRead = note['is_read'] == 1;
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isRead ? Colors.white : AppTheme.brandBlue.withValues(alpha: 0.02),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: isRead ? const Color(0xFFF1F5F9) : AppTheme.brandBlue.withValues(alpha: 0.1)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: const BoxDecoration(color: AppTheme.bgLight, shape: BoxShape.circle),
            child: Icon(_getIcon(note['type']), color: AppTheme.brandBlue, size: 20),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(note['title'] ?? 'Notification', style: TextStyle(fontWeight: isRead ? FontWeight.bold : FontWeight.w800)),
                const SizedBox(height: 4),
                Text(note['message'] ?? '', style: const TextStyle(color: AppTheme.textGray, fontSize: 13, height: 1.4)),
                const SizedBox(height: 8),
                Text(DateFormat.jm().add_yMMMd().format(DateTime.parse(note['created_at'])), style: const TextStyle(color: AppTheme.textGray, fontSize: 10)),
              ],
            ),
          ),
          if (!isRead)
            Container(width: 8, height: 8, decoration: const BoxDecoration(color: AppTheme.brandOrange, shape: BoxShape.circle)),
        ],
      ),
    );
  }

  IconData _getIcon(String? type) {
    switch (type) {
      case 'job_alert': return Icons.work_outline;
      case 'proposal': return Icons.assignment_outlined;
      case 'payment': return Icons.account_balance_wallet_outlined;
      default: return Icons.notifications_none;
    }
  }
}
