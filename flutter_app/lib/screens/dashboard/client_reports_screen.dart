import 'dart:io';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:share_plus/share_plus.dart';

import '../../core/api/api_client.dart';
import '../../core/theme/app_theme.dart';

class ClientReportsScreen extends StatefulWidget {
  const ClientReportsScreen({super.key});

  @override
  State<ClientReportsScreen> createState() => _ClientReportsScreenState();
}

class _ClientReportsScreenState extends State<ClientReportsScreen> {
  bool _loading = true;
  bool _exporting = false;
  List<Map<String, dynamic>> _jobs = [];
  Map<String, dynamic> _finance = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final responses = await Future.wait([
        _loadProjects(),
        _loadFinance(),
      ]);
      if (mounted) {
        setState(() {
          _jobs = responses[0] as List<Map<String, dynamic>>;
          _finance = Map<String, dynamic>.from(responses[1] as Map);
        });
      }
    } on ApiException catch (error) {
      if (mounted && error.statusCode != 401) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
      }
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  Future<List<Map<String, dynamic>>> _loadProjects() async {
    try {
      return await ApiClient.instance.getList('/api/v1/client/project-board');
    } on ApiException {
      return ApiClient.instance.getList('/api/v1/client/jobs');
    }
  }

  Future<Map<String, dynamic>> _loadFinance() async {
    try {
      return await ApiClient.instance.get('/api/v1/client/finance');
    } on ApiException {
      return <String, dynamic>{'totals': <String, dynamic>{}};
    }
  }

  @override
  Widget build(BuildContext context) {
    final metrics = _metrics;
    return Scaffold(
      backgroundColor: AppTheme.bgLight,
      appBar: AppBar(
        title: const Text('Project reports'),
        leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => context.pop()),
        actions: [
          TextButton.icon(
            onPressed: _loading || _exporting ? null : _showExportOptions,
            icon: _exporting ? const SizedBox(width: 15, height: 15, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.picture_as_pdf_outlined),
            label: Text(_exporting ? 'Preparing' : 'Download'),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(20),
                children: [
                  Container(
                    padding: const EdgeInsets.all(22),
                    decoration: BoxDecoration(gradient: const LinearGradient(colors: [Color(0xFF183D91), Color(0xFF315FC3)]), borderRadius: BorderRadius.circular(24)),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      const Icon(Icons.analytics_outlined, color: Colors.white, size: 30),
                      const SizedBox(height: 15),
                      const Text('Your hiring overview', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: Colors.white)),
                      const SizedBox(height: 7),
                      Text('Export a clean PDF with only the data you select.', style: TextStyle(color: Colors.white.withValues(alpha: .78))),
                      const SizedBox(height: 18),
                      OutlinedButton.icon(onPressed: _showExportOptions, icon: const Icon(Icons.download_rounded), label: const Text('Download report'), style: OutlinedButton.styleFrom(foregroundColor: Colors.white, side: const BorderSide(color: Colors.white54))),
                    ]),
                  ),
                  const SizedBox(height: 23),
                  _metric('Total projects', '${metrics.total}', Icons.business_center_outlined, const Color(0xFF2450B8)),
                  _metric('Running with a pro', '${metrics.running}', Icons.rocket_launch_outlined, const Color(0xFF0F8C77)),
                  _metric('Hiring in progress', '${metrics.hiring}', Icons.person_search_outlined, const Color(0xFFB45309)),
                  _metric('Completed projects', '${metrics.completed}', Icons.task_alt_rounded, const Color(0xFF7C3AED)),
                  _metric('Committed budget', _money(metrics.committed), Icons.account_balance_wallet_outlined, const Color(0xFF0B7285)),
                  _metric('Paid to professionals', _money(metrics.paid), Icons.payments_outlined, const Color(0xFF1E7A45)),
                  const SizedBox(height: 8),
                  OutlinedButton.icon(onPressed: () => context.push('/projects'), icon: const Icon(Icons.list_alt_rounded), label: const Text('Open project workspace')),
                ],
              ),
            ),
    );
  }

  _ReportMetrics get _metrics {
    final running = _jobs.where((job) => job['project'] is Map && ((job['project'] as Map)['status'] ?? '').toString().toUpperCase() == 'ACTIVE').length;
    final completed = _jobs.where((job) => job['project'] is Map && ((job['project'] as Map)['status'] ?? '').toString().toUpperCase() != 'ACTIVE').length;
    final hiring = _jobs.where((job) => job['project'] == null && (job['status'] ?? '').toString().toUpperCase() == 'OPEN').length;
    final totals = Map<String, dynamic>.from(_finance['totals'] as Map? ?? {});
    return _ReportMetrics(_jobs.length, running, hiring, completed, _number(totals['projectBudget'] ?? totals['committed']), _number(totals['paid']));
  }

  Widget _metric(String label, String value, IconData icon, Color color) => Container(
        margin: const EdgeInsets.only(bottom: 11), padding: const EdgeInsets.all(17),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(17), border: Border.all(color: const Color(0xFFE4EAF3))),
        child: Row(children: [Container(padding: const EdgeInsets.all(10), decoration: BoxDecoration(color: color.withValues(alpha: .12), borderRadius: BorderRadius.circular(11)), child: Icon(icon, color: color)), const SizedBox(width: 14), Expanded(child: Text(label, style: const TextStyle(fontWeight: FontWeight.w600, color: AppTheme.textGray))), Text(value, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 19, color: AppTheme.brandNavy))]),
      );

  Future<void> _showExportOptions() async {
    var includeSummary = true;
    var includeBudget = true;
    var includeRunning = true;
    var includeHiring = true;
    var includeCompleted = true;
    var includeDetails = true;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => StatefulBuilder(builder: (context, setSheetState) => Container(
        decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
        padding: EdgeInsets.fromLTRB(24, 14, 24, MediaQuery.of(context).padding.bottom + 24),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Center(child: Container(width: 42, height: 4, decoration: BoxDecoration(color: const Color(0xFFD9E1ED), borderRadius: BorderRadius.circular(10)))),
          const SizedBox(height: 20),
          const Text('Choose PDF data', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: AppTheme.brandNavy)),
          const SizedBox(height: 5),
          const Text('Select exactly what you want in this client report.', style: TextStyle(color: AppTheme.textGray)),
          const SizedBox(height: 12),
          _exportCheck('Dashboard summary', 'Project totals and activity counts', includeSummary, (value) => setSheetState(() => includeSummary = value)),
          _exportCheck('Budget & earnings', 'Committed and paid project amounts', includeBudget, (value) => setSheetState(() => includeBudget = value)),
          _exportCheck('Running projects', 'Current work and hired professionals', includeRunning, (value) => setSheetState(() => includeRunning = value)),
          _exportCheck('Hiring projects', 'Open projects without a hired professional', includeHiring, (value) => setSheetState(() => includeHiring = value)),
          _exportCheck('Completed projects', 'Finished project details', includeCompleted, (value) => setSheetState(() => includeCompleted = value)),
          _exportCheck('Project details', 'Budget, deadline, category, and status', includeDetails, (value) => setSheetState(() => includeDetails = value)),
          const SizedBox(height: 15),
          SizedBox(width: double.infinity, height: 52, child: ElevatedButton.icon(onPressed: () { Navigator.pop(sheetContext); _exportPdf(_ExportOptions(includeSummary, includeBudget, includeRunning, includeHiring, includeCompleted, includeDetails)); }, icon: const Icon(Icons.download_rounded), label: const Text('Create and download PDF'), style: ElevatedButton.styleFrom(backgroundColor: AppTheme.brandBlue, foregroundColor: Colors.white))),
        ]),
      )),
    );
  }

  Widget _exportCheck(String title, String subtitle, bool value, ValueChanged<bool> onChanged) => CheckboxListTile(
        contentPadding: EdgeInsets.zero, value: value, onChanged: (next) => onChanged(next ?? false), activeColor: AppTheme.brandBlue,
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w700)), subtitle: Text(subtitle, style: const TextStyle(fontSize: 12)), controlAffinity: ListTileControlAffinity.leading,
      );

  Future<void> _exportPdf(_ExportOptions options) async {
    if (!options.anySelected) { ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Select at least one report section.'))); return; }
    setState(() => _exporting = true);
    try {
      final metrics = _metrics;
      final document = pw.Document();
      final date = DateFormat('dd MMM yyyy, HH:mm').format(DateTime.now());
      final sections = <pw.Widget>[
        pw.Text('Servio client project report', style: pw.TextStyle(fontSize: 23, fontWeight: pw.FontWeight.bold, color: PdfColors.blue900)),
        pw.SizedBox(height: 5), pw.Text('Generated $date'), pw.Divider(), pw.SizedBox(height: 10),
      ];
      if (options.summary) {
        sections.addAll(_pdfSummary(metrics));
      }
      if (options.budget) {
        sections.addAll(_pdfBudget(metrics));
      }
      if (options.running) {
        sections.addAll(_pdfProjectSection('Running projects', _projectsFor('running'), options.details));
      }
      if (options.hiring) {
        sections.addAll(_pdfProjectSection('Hiring projects', _projectsFor('hiring'), options.details));
      }
      if (options.completed) {
        sections.addAll(_pdfProjectSection('Completed projects', _projectsFor('completed'), options.details));
      }
      document.addPage(pw.MultiPage(pageFormat: PdfPageFormat.a4, margin: const pw.EdgeInsets.all(28), build: (_) => sections));
      final directory = await getApplicationDocumentsDirectory();
      final file = File('${directory.path}/servio-project-report-${DateFormat('yyyyMMdd-HHmm').format(DateTime.now())}.pdf');
      await file.writeAsBytes(await document.save());
      await Share.shareXFiles([XFile(file.path)], text: 'Servio client project report');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('PDF report is ready to save or share.')));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Could not create the PDF. Please try again.')));
      }
    } finally {
      if (mounted) {
        setState(() => _exporting = false);
      }
    }
  }

  List<pw.Widget> _pdfSummary(_ReportMetrics m) => [
        pw.Text('Dashboard summary', style: pw.TextStyle(fontSize: 16, fontWeight: pw.FontWeight.bold)),
        pw.SizedBox(height: 6),
        pw.TableHelper.fromTextArray(headers: const ['Total', 'Running', 'Hiring', 'Completed'], data: [['${m.total}', '${m.running}', '${m.hiring}', '${m.completed}']]),
        pw.SizedBox(height: 16),
      ];
  List<pw.Widget> _pdfBudget(_ReportMetrics m) => [
        pw.Text('Budget & payments', style: pw.TextStyle(fontSize: 16, fontWeight: pw.FontWeight.bold)),
        pw.SizedBox(height: 6),
        pw.TableHelper.fromTextArray(headers: const ['Committed budget', 'Paid to professionals'], data: [[_money(m.committed), _money(m.paid)]]),
        pw.SizedBox(height: 16),
      ];
  List<pw.Widget> _pdfProjectSection(String title, List<Map<String, dynamic>> jobs, bool details) {
    if (jobs.isEmpty) {
      return [
        pw.Text(title, style: pw.TextStyle(fontSize: 16, fontWeight: pw.FontWeight.bold)),
        pw.Text('No projects in this section.'),
        pw.SizedBox(height: 12),
      ];
    }
    final headers = details ? const ['Project', 'Professional', 'Budget', 'Deadline', 'Status'] : const ['Project', 'Professional', 'Status'];
    final data = jobs.map((job) { final project = job['project'] as Map?; final pro = project?['professionalName']?.toString() ?? 'Not hired'; final status = project?['status']?.toString() ?? job['status'].toString(); return details ? [(job['title'] ?? 'Project').toString(), pro, _money(_number(job['budgetMax'] ?? job['budgetMin'])), _date(job['deadline']), status] : [(job['title'] ?? 'Project').toString(), pro, status]; }).toList();
    return [
      pw.Text(title, style: pw.TextStyle(fontSize: 16, fontWeight: pw.FontWeight.bold)),
      pw.SizedBox(height: 6),
      pw.TableHelper.fromTextArray(headers: headers, data: data, headerStyle: pw.TextStyle(fontWeight: pw.FontWeight.bold), cellStyle: const pw.TextStyle(fontSize: 8)),
      pw.SizedBox(height: 16),
    ];
  }
  List<Map<String, dynamic>> _projectsFor(String group) => _jobs.where((job) {
        final project = job['project'] as Map?;
        final active = project != null && (project['status'] ?? '').toString().toUpperCase() == 'ACTIVE';
        if (group == 'running') {
          return active;
        }
        if (group == 'hiring') {
          return project == null && (job['status'] ?? '').toString().toUpperCase() == 'OPEN';
        }
        return project != null && !active;
      }).toList();
  String _money(double value) => '\$${value.toStringAsFixed(2)}';
  double _number(dynamic value) => double.tryParse((value ?? 0).toString()) ?? 0;
  String _date(dynamic value) { final parsed = DateTime.tryParse((value ?? '').toString()); return parsed == null ? 'Not set' : DateFormat('dd MMM yyyy').format(parsed); }
}

class _ReportMetrics { const _ReportMetrics(this.total, this.running, this.hiring, this.completed, this.committed, this.paid); final int total; final int running; final int hiring; final int completed; final double committed; final double paid; }
class _ExportOptions { const _ExportOptions(this.summary, this.budget, this.running, this.hiring, this.completed, this.details); final bool summary; final bool budget; final bool running; final bool hiring; final bool completed; final bool details; bool get anySelected => summary || budget || running || hiring || completed; }
