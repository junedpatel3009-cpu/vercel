import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/database/database_helper.dart';
import '../../widgets/site_drawer.dart';

class DatabaseViewScreen extends StatefulWidget {
  const DatabaseViewScreen({super.key});

  @override
  State<DatabaseViewScreen> createState() => _DatabaseViewScreenState();
}

class _DatabaseViewScreenState extends State<DatabaseViewScreen> {
  String selectedTable = 'users';
  List<Map<String, dynamic>> tableData = [];
  bool _isLoading = true;
  String? _error;
  final List<String> tables = [
    'users',
    'clients',
    'professionals',
    'categories',
    'subcategories',
    'jobs',
    'job_images',
    'job_documents',
    'proposals',
    'reviews',
    'notifications',
    'portfolios',
    'saved_jobs',
    'favourite_professionals',
    'transactions',
    'otp_verifications',
  ];

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    if (mounted) {
      setState(() {
        _isLoading = true;
        _error = null;
      });
    }
    try {
      final db = await DatabaseHelper().database;
      final data = await db.query(selectedTable);
      if (!mounted) return;
      setState(() {
        tableData = data;
        _isLoading = false;
      });
    } catch (e) {
      debugPrint('Error fetching data: $e');
      if (mounted) {
        setState(() {
          tableData = [];
          _error = 'Could not load $selectedTable: $e';
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Database Viewer'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            if (context.canPop()) {
              context.pop();
            } else {
              context.go('/');
            }
          },
        ),
        actions: [
          DropdownButton<String>(
            value: selectedTable,
            dropdownColor: Colors.blueGrey[900],
            style: const TextStyle(color: Colors.white),
            items: tables.map((String table) {
              return DropdownMenuItem<String>(
                value: table,
                child: Text(table),
              );
            }).toList(),
            onChanged: (String? newValue) {
              if (newValue != null) {
                setState(() {
                  selectedTable = newValue;
                });
                _fetchData();
              }
            },
          ),
          const SizedBox(width: 8),
          Builder(
            builder: (context) => IconButton(
              icon: const Icon(Icons.menu),
              onPressed: () => Scaffold.of(context).openEndDrawer(),
            ),
          ),
          const SizedBox(width: 8),
        ],
      ),
      endDrawer: const SiteDrawer(),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(_error!, textAlign: TextAlign.center)))
          : tableData.isEmpty
          ? const Center(child: Text('No data found in this table'))
          : SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: SingleChildScrollView(
                child: DataTable(
                  columns: tableData.first.keys.map((key) {
                    return DataColumn(label: Text(key, style: const TextStyle(fontWeight: FontWeight.bold)));
                  }).toList(),
                  rows: tableData.map((row) {
                    return DataRow(
                      cells: row.values.map((value) {
                        return DataCell(Text(value?.toString() ?? 'NULL'));
                      }).toList(),
                    );
                  }).toList(),
                ),
              ),
            ),
      floatingActionButton: FloatingActionButton(
        onPressed: _fetchData,
        child: const Icon(Icons.refresh),
      ),
    );
  }
}
