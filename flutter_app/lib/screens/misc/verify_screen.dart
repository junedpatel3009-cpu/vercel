import 'package:flutter/material.dart';
import '../../widgets/site_header.dart';
import '../../widgets/site_footer.dart';

class VerifyScreen extends StatelessWidget {
  const VerifyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const SiteHeaderWidget(),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(children: [
          Text('Verify', style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 12),
          const Text('Verification process and status.'),
          const Spacer(),
          const SiteFooterWidget(),
        ]),
      ),
    );
  }
}
