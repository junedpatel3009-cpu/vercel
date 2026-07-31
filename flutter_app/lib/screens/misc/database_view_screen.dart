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
  final List<String> tables = [
    'users',
    'clients',
    'professionals',
    'job_categories',
    'jobs',
    'proposals',
    'hired_professionals',
    'project_milestones',
    'work_proofs',
    'reviews',
    'disputes',
    'notifications',
    'favourite_jobs',
    'favourite_professionals',
    'earnings',
    'payouts',
    'transactions',
    'invoices',
    'verification_documents',
    'otp_verifications',
  ];

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    try {
      final db = await DatabaseHelper().database;
      final data = await db.query(selectedTable);
      setState(() {
        tableData = data;
      });
    } catch (e) {
      debugPrint('Error fetching data: $e');
      if (mounted) {
        setState(() {
          tableData = [];
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
      body: tableData.isEmpty
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
