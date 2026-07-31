import 'package:flutter/material.dart';
import '../../widgets/app_shell.dart';
import '../../widgets/pro_card.dart';
import '../../core/database/database_helper.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  List<Map<String, dynamic>> _professionals = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final results = await DatabaseHelper().searchProfessionals();
    if (mounted) {
      setState(() {
        _professionals = results;
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return AppShell(
      title: 'Discover',
      child: _isLoading 
        ? const Center(child: CircularProgressIndicator())
        : SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Available Professionals',
                  style: Theme.of(context).textTheme.headlineMedium,
                ),
                const SizedBox(height: 8),
                Text(
                  'Browse and hire top-rated experts for your next project.',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: 24),
                _professionals.isEmpty
                  ? const Center(child: Text('No professionals found.'))
                  : LayoutBuilder(
                      builder: (context, constraints) {
                        int crossAxisCount = 1;
                        if (constraints.maxWidth > 900) {
                          crossAxisCount = 3;
                        } else if (constraints.maxWidth > 600) {
                          crossAxisCount = 2;
                        }

                        return GridView.builder(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: crossAxisCount,
                            mainAxisSpacing: 16,
                            crossAxisSpacing: 16,
                            childAspectRatio: 0.8,
                          ),
                          itemCount: _professionals.length,
                          itemBuilder: (context, index) =>
                              ProCardWidget(pro: _professionals[index]),
                        );
                      },
                    ),
              ],
            ),
          ),
    );
  }
}
