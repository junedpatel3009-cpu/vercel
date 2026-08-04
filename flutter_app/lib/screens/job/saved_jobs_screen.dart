import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_service.dart';
import '../../core/database/database_helper.dart';
import '../../core/theme/app_theme.dart';

class SavedJobsScreen extends StatefulWidget {
  const SavedJobsScreen({super.key});

  @override
  State<SavedJobsScreen> createState() => _SavedJobsScreenState();
}

class _SavedJobsScreenState extends State<SavedJobsScreen> {
  List<Map<String, dynamic>> _jobs = [];
  int? _userId;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadSavedJobs();
  }

  Future<void> _loadSavedJobs() async {
    final user = await AuthService().getUser();
    final userId = user?['id'] is int
        ? user!['id'] as int
        : int.tryParse('${user?['id']}');
    if (userId == null) {
      if (mounted) context.go('/login');
      return;
    }
    final jobs = await DatabaseHelper().getSavedJobs(userId);
    if (mounted) {
      setState(() {
        _userId = userId;
        _jobs = jobs;
        _loading = false;
      });
    }
  }

  Future<void> _removeSavedJob(int jobId) async {
    if (_userId == null) return;
    await DatabaseHelper().toggleSavedJob(_userId!, jobId);
    if (mounted) {
      setState(() => _jobs.removeWhere((job) => job['id'] == jobId));
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Removed from saved jobs')),
      );
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: AppTheme.bgLight,
        appBar: AppBar(
          title: const Text('Saved jobs'),
          leading: IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: () => Navigator.of(context).canPop()
                ? Navigator.of(context).pop()
                : context.go('/jobs'),
          ),
        ),
        body: _loading
            ? const Center(child: CircularProgressIndicator())
            : _jobs.isEmpty
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(32),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.bookmark_border_rounded,
                            size: 60,
                            color: AppTheme.textGray,
                          ),
                          const SizedBox(height: 14),
                          const Text(
                            'No saved jobs yet',
                            style: TextStyle(
                              fontSize: 19,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          const SizedBox(height: 8),
                          const Text(
                            'Save jobs you want to revisit later.',
                            textAlign: TextAlign.center,
                            style: TextStyle(color: AppTheme.textGray),
                          ),
                          const SizedBox(height: 20),
                          ElevatedButton(
                            onPressed: () => context.go('/jobs'),
                            child: const Text('Browse jobs'),
                          ),
                        ],
                      ),
                    ),
                  )
                : RefreshIndicator(
                    onRefresh: _loadSavedJobs,
                    child: ListView.separated(
                      padding: const EdgeInsets.all(20),
                      itemCount: _jobs.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 12),
                      itemBuilder: (context, index) {
                        final job = _jobs[index];
                        final city = job['city'] ?? 'Remote';
                        final minimum = job['min_budget'] ?? 0;
                        final maximum = job['max_budget'] ?? 0;
                        return Card(
                          child: ListTile(
                            contentPadding: const EdgeInsets.all(16),
                            title: Text(
                              job['title'] ?? 'Untitled job',
                              style: const TextStyle(
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            subtitle: Padding(
                              padding: const EdgeInsets.only(top: 7),
                              child: Text('$city • \$$minimum - \$$maximum'),
                            ),
                            trailing: IconButton(
                              icon: const Icon(
                                Icons.bookmark,
                                color: AppTheme.brandBlue,
                              ),
                              onPressed: () => _removeSavedJob(job['id'] as int),
                            ),
                            onTap: () => context.push('/job/${job['id']}'),
                          ),
                        );
                      },
                    ),
                  ),
      );
}
