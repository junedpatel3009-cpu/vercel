import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';

import '../../core/api/api_client.dart';
import '../../core/auth/auth_service.dart';
import '../../core/theme/app_theme.dart';

class EarningsScreen extends StatefulWidget {
  const EarningsScreen({super.key});

  @override
  State<EarningsScreen> createState() => _EarningsScreenState();
}

class _EarningsScreenState extends State<EarningsScreen> {
  Map<String, dynamic>? _user;
  List<Map<String, dynamic>> _transactions = [];
  Map<String, dynamic> _totals = {};
  bool _isClient = false;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final user = await AuthService().getUser();
    if (user == null) {
      if (mounted) setState(() => _isLoading = false);
      return;
    }

    final isClient = user['role'].toString().toLowerCase() == 'client';
    try {
      if (isClient) {
        final finance = await ApiClient.instance.get('/api/v1/client/finance');
        final payments = (finance['payments'] as List? ?? [])
            .map((item) => Map<String, dynamic>.from(item as Map))
            .toList();
        if (mounted) {
          setState(() {
            _user = user;
            _isClient = true;
            _transactions = payments;
            _totals = Map<String, dynamic>.from(finance['totals'] as Map? ?? {});
          });
        }
      } else {
        final earnings = await ApiClient.instance.get('/api/v1/professional/earnings');
        final transactions = (earnings['transactions'] as List? ?? [])
            .whereType<Map>()
            .map((item) => Map<String, dynamic>.from(item))
            .toList();
        final totalEarnings = transactions.fold<double>(
          0,
          (total, transaction) => total + _amount(transaction['amount']),
        );
        if (mounted) {
          setState(() {
            _user = user;
            _transactions = transactions;
            _totals = {'earned': totalEarnings};
          });
        }
      }
    } on ApiException catch (error) {
      if (mounted && error.statusCode != 401) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
      }
    } finally {
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
        title: Text(_isClient ? 'Project spending' : 'Wallet & Earnings', style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w900, color: AppTheme.brandNavy)),
      ),
      body: RefreshIndicator(
        onRefresh: _loadData,
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            _isClient ? _buildClientSummary() : _buildProfessionalBalance(),
            const SizedBox(height: 30),
            Text(_isClient ? 'Payment activity' : 'Recent transactions', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
            const SizedBox(height: 16),
            _transactions.isEmpty ? _buildEmptyState() : Column(children: _transactions.map(_buildTransactionItem).toList()),
          ],
        ),
      ),
    );
  }

  Widget _buildClientSummary() {
    final paid = _amount(_totals['paid']);
    final pending = _amount(_totals['pending']);
    final committed = _amount(_totals['projectBudget'] ?? _totals['committed']);
    return Container(
      padding: const EdgeInsets.all(25),
      decoration: BoxDecoration(
        gradient: const LinearGradient(colors: [Color(0xFF1E3A8A), Color(0xFF2450B8)]),
        borderRadius: BorderRadius.circular(26),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('TOTAL PROJECT SPEND', style: TextStyle(color: Colors.white.withValues(alpha: .72), fontWeight: FontWeight.w800, fontSize: 12, letterSpacing: 1)),
        const SizedBox(height: 8),
        Text('\$${paid.toStringAsFixed(2)}', style: const TextStyle(color: Colors.white, fontSize: 35, fontWeight: FontWeight.w900)),
        const SizedBox(height: 22),
        Row(children: [
          _summaryValue('Committed', committed),
          const SizedBox(width: 28),
          _summaryValue('Pending', pending),
        ]),
        const SizedBox(height: 22),
        OutlinedButton.icon(
          onPressed: () => context.push('/projects'),
          icon: const Icon(Icons.business_center_outlined),
          label: const Text('View projects'),
          style: OutlinedButton.styleFrom(foregroundColor: Colors.white, side: const BorderSide(color: Colors.white54)),
        ),
      ]),
    );
  }

  Widget _summaryValue(String label, double amount) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label.toUpperCase(), style: TextStyle(color: Colors.white.withValues(alpha: .66), fontSize: 10, fontWeight: FontWeight.w700)),
        const SizedBox(height: 3),
        Text('\$${amount.toStringAsFixed(0)}', style: const TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w800)),
      ]);

  Widget _buildProfessionalBalance() {
    final earnings = _amount(_totals['earned']);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(28),
      decoration: BoxDecoration(gradient: const LinearGradient(colors: [Color(0xFF1E3A8A), Color(0xFF1E40AF)]), borderRadius: BorderRadius.circular(26)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('TOTAL EARNINGS', style: TextStyle(color: Colors.white.withValues(alpha: .72), fontWeight: FontWeight.bold, fontSize: 12, letterSpacing: 1)),
        const SizedBox(height: 8),
        Text('\$${earnings.toStringAsFixed(2)}', style: const TextStyle(color: Colors.white, fontSize: 35, fontWeight: FontWeight.w900)),
      ]),
    );
  }

  Widget _buildEmptyState() => Container(
        padding: const EdgeInsets.all(38),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22), border: Border.all(color: const Color(0xFFF1F5F9))),
        child: const Column(children: [
          Icon(Icons.receipt_long_outlined, size: 46, color: Color(0xFF94A3B8)),
          SizedBox(height: 13),
          Text('No payments recorded yet', style: TextStyle(color: AppTheme.textGray, fontWeight: FontWeight.bold)),
        ]),
      );

  Widget _buildTransactionItem(Map<String, dynamic> tx) {
    final status = (tx['status'] ?? '').toString().toUpperCase();
    final isCredit = !_isClient && (tx['type'] ?? '').toString().toUpperCase() != 'DEBIT';
    final isPaid = status == 'COMPLETED';
    final dateText = (tx['createdAt'] ?? tx['created_at'] ?? '').toString();
    DateTime? date = DateTime.tryParse(dateText);
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(17),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18), border: Border.all(color: const Color(0xFFE9EEF5))),
      child: Row(children: [
        Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(color: (isPaid ? Colors.green : Colors.orange).withValues(alpha: .12), borderRadius: BorderRadius.circular(11)),
          child: Icon(_isClient ? Icons.payments_outlined : (isCredit ? Icons.add : Icons.remove), color: isPaid ? Colors.green : Colors.orange),
        ),
        const SizedBox(width: 14),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text((tx['projectTitle'] ?? tx['jobTitle'] ?? tx['description'] ?? 'Project payment').toString(), style: const TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 3),
          Text(date == null ? status : '${DateFormat.yMMMd().format(date)}  •  $status', style: const TextStyle(color: AppTheme.textGray, fontSize: 12)),
        ])),
        Text('${_isClient ? '-' : (isCredit ? '+' : '-')}\$${_amount(tx['amount']).toStringAsFixed(2)}', style: TextStyle(fontWeight: FontWeight.w900, color: _isClient ? AppTheme.brandNavy : (isCredit ? Colors.green : Colors.red))),
      ]),
    );
  }

  double _amount(dynamic value) => double.tryParse((value ?? 0).toString()) ?? 0;
}
