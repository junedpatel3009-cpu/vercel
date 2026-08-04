import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_client.dart';
import '../../core/theme/app_theme.dart';
import '../../widgets/motion.dart';

class JobsScreen extends StatefulWidget {
  const JobsScreen({super.key});

  @override
  State<JobsScreen> createState() => _JobsScreenState();
}

class _JobsScreenState extends State<JobsScreen> {
  List<Map<String, dynamic>> _jobs = [];
  bool _loading = true;
  String _query = '';

  List<Map<String, dynamic>> get _visibleJobs {
    final query = _query.trim().toLowerCase();
    if (query.isEmpty) return _jobs;
    return _jobs.where((job) {
      final searchable = [
        job['title'],
        job['description'],
        job['category'],
        job['locationLabel'],
        job['locationAddress'],
        job['workMode'],
        job['urgency'],
        job['timingType'],
      ].whereType<Object>().join(' ').toLowerCase();
      return searchable.contains(query);
    }).toList();
  }

  @override
  void initState() {
    super.initState();
    _loadJobs();
  }

  Future<void> _loadJobs() async {
    try {
      final jobs = await ApiClient.instance.getList('/api/v1/jobs', authenticated: false);
      if (mounted) setState(() => _jobs = jobs);
    } on ApiException catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.bgLight,
      appBar: AppBar(
        title: const Text('Jobs'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          tooltip: 'Back',
          onPressed: () {
            if (Navigator.of(context).canPop()) {
              Navigator.of(context).pop();
            } else {
              context.go('/');
            }
          },
        ),
      ),
      body: _loading
          ? const AnimatedLoadingIndicator(color: AppTheme.brandBlue)
          : Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(24, 16, 24, 8),
                  child: TextField(
                    onChanged: (value) => setState(() => _query = value),
                    decoration: InputDecoration(
                      hintText: 'Search jobs, category, location, or skills',
                      prefixIcon: const Icon(Icons.search),
                      suffixIcon: _query.isEmpty
                          ? null
                          : IconButton(
                              icon: const Icon(Icons.clear),
                              onPressed: () => setState(() => _query = ''),
                            ),
                    ),
                  ),
                ),
                Expanded(
                  child: RefreshIndicator(
                    onRefresh: _loadJobs,
                    child: _visibleJobs.isEmpty
                        ? ListView(
                            children: [
                              const SizedBox(height: 220),
                              Center(child: Text(_query.isEmpty ? 'No open jobs right now.' : 'No jobs match your search.')),
                            ],
                          )
                        : ListView.builder(
                            padding: const EdgeInsets.all(24),
                            itemCount: _visibleJobs.length,
                            itemBuilder: (context, index) {
                              final job = _visibleJobs[index];
                              return FadeSlideIn(
                                delay: Duration(milliseconds: index < 8 ? index * 45 : 360),
                                child: Padding(
                                  padding: const EdgeInsets.only(bottom: 16),
                                  child: Card(
                                    child: InkWell(
                                      borderRadius: BorderRadius.circular(24),
                                      onTap: () => context.push('/job/${job['id']}'),
                                      child: Padding(
                                        padding: const EdgeInsets.all(20),
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(job['title'] ?? 'Untitled Job', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
                                            const SizedBox(height: 8),
                                            if ((job['category'] ?? '').toString().isNotEmpty)
                                              Padding(
                                                padding: const EdgeInsets.only(bottom: 8),
                                                child: Chip(label: Text(job['category'].toString()), visualDensity: VisualDensity.compact),
                                              ),
                                            Text(
                                              job['locationLabel'] ?? (job['workMode'] == 'REMOTE' ? 'Remote' : 'Location not specified'),
                                              style: const TextStyle(color: AppTheme.textGray),
                                            ),
                                            const SizedBox(height: 14),
                                            Row(
                                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                              children: [
                                                Text(
                                                  '\$${job['budgetMin'] ?? 0} - \$${job['budgetMax'] ?? 0}',
                                                  style: const TextStyle(color: AppTheme.brandBlue, fontWeight: FontWeight.w800),
                                                ),
                                                const Icon(Icons.chevron_right, color: AppTheme.textGray),
                                              ],
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                              );
                            },
                          ),
                  ),
                ),
              ],
            ),
    );
  }
}
