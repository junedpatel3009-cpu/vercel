import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../../core/theme/app_theme.dart';
import '../../core/database/database_helper.dart';
import '../../core/auth/auth_service.dart';

class EarningsScreen extends StatefulWidget {
  const EarningsScreen({super.key});

  @override
  State<EarningsScreen> createState() => _EarningsScreenState();
}

class _EarningsScreenState extends State<EarningsScreen> {
  Map<String, dynamic>? _user;
  List<Map<String, dynamic>> _transactions = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final user = await AuthService().getUser();
    if (user != null) {
      final db = DatabaseHelper();
      final freshUser = await db.database.then((d) => d.query('users', where: 'id = ?', whereArgs: [user['id']]));
      final txs = await db.getTransactions(user['id']);
      if (mounted) {
        setState(() {
          _user = freshUser.isNotEmpty ? freshUser.first : user;
          _transactions = txs;
          _isLoading = false;
        });
      }
    } else {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    if (_user == null) return const Scaffold(body: Center(child: Text('User session not found')));

    return Scaffold(
      backgroundColor: AppTheme.bgLight,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: Text('Wallet & Earnings', style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w900, color: AppTheme.brandNavy)),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildBalanceCard(),
            const SizedBox(height: 32),
            const Text('Recent Transactions', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
            const SizedBox(height: 16),
            _transactions.isEmpty
              ? _buildEmptyState()
              : Column(children: _transactions.map((tx) => _buildTransactionItem(tx)).toList()),
          ],
        ),
      ),
    );
  }

  Widget _buildBalanceCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(32),
      decoration: BoxDecoration(
        gradient: const LinearGradient(colors: [Color(0xFF1E3A8A), Color(0xFF1E40AF)], begin: Alignment.topLeft, end: Alignment.bottomRight),
        borderRadius: BorderRadius.circular(32),
        boxShadow: [BoxShadow(color: const Color(0xFF1E3A8A).withValues(alpha: 0.3), blurRadius: 20, offset: const Offset(0, 10))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('TOTAL BALANCE', style: GoogleFonts.plusJakartaSans(color: Colors.white.withValues(alpha: 0.7), fontWeight: FontWeight.bold, fontSize: 12, letterSpacing: 1)),
          const SizedBox(height: 8),
          Text('\$${_user!['wallet_balance']?.toStringAsFixed(2) ?? '0.00'}', style: const TextStyle(color: Colors.white, fontSize: 36, fontWeight: FontWeight.w900)),
          const SizedBox(height: 32),
          Row(
            children: [
              Expanded(
                child: ElevatedButton(
                  onPressed: () {},
                  style: ElevatedButton.styleFrom(backgroundColor: Colors.white, foregroundColor: AppTheme.brandBlue, padding: const EdgeInsets.symmetric(vertical: 16), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))),
                  child: const Text('Withdraw', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: OutlinedButton(
                  onPressed: () {},
                  style: OutlinedButton.styleFrom(side: const BorderSide(color: Colors.white), foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(vertical: 16), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))),
                  child: const Text('Add Money', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          )
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return Container(
      padding: const EdgeInsets.all(40),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(24), border: Border.all(color: const Color(0xFFF1F5F9))),
      child: const Center(
        child: Column(
          children: [
            Icon(Icons.history, size: 48, color: Color(0xFF94A3B8)),
            SizedBox(height: 16),
            Text('No transactions yet', style: TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.bold)),
          ],
        ),
      ),
    );
  }

  Widget _buildTransactionItem(Map<String, dynamic> tx) {
    final isCredit = tx['type'] == 'credit';
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), border: Border.all(color: const Color(0xFFF1F5F9))),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: (isCredit ? Colors.green : Colors.red).withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12)),
            child: Icon(isCredit ? Icons.add : Icons.remove, color: isCredit ? Colors.green : Colors.red),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(tx['description'] ?? 'Transaction', style: const TextStyle(fontWeight: FontWeight.bold)),
                Text(DateFormat.yMMMd().format(DateTime.parse(tx['created_at'])), style: const TextStyle(color: AppTheme.textGray, fontSize: 12)),
              ],
            ),
          ),
          Text(
            '${isCredit ? "+" : "-"}\$${tx['amount']}',
            style: TextStyle(fontWeight: FontWeight.w900, color: isCredit ? Colors.green : Colors.red, fontSize: 16),
          )
        ],
      ),
    );
  }
}
