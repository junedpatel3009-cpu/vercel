import 'package:flutter/material.dart';
import '../../widgets/site_header.dart';
import '../../widgets/site_footer.dart';

class AdminScreen extends StatelessWidget {
  const AdminScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const SiteHeaderWidget(),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(children: [
          Text('Admin', style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 12),
          const Text('Admin tools and dashboards.'),
          const Spacer(),
          const SiteFooterWidget(),
        ]),
      ),
    );
  }
}
