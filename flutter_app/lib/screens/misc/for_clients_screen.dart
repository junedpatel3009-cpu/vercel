import 'package:flutter/material.dart';
import '../../widgets/site_header.dart';
import '../../widgets/site_footer.dart';

class ForClientsScreen extends StatelessWidget {
  const ForClientsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const SiteHeaderWidget(),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('For Clients', style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 12),
          const Text('Information tailored to clients.'),
          const Spacer(),
          const SiteFooterWidget(),
        ]),
      ),
    );
  }
}
