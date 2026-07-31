import 'package:flutter/material.dart';
import '../../widgets/site_header.dart';
import '../../widgets/site_footer.dart';

class ForProfessionalsScreen extends StatelessWidget {
  const ForProfessionalsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const SiteHeaderWidget(),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('For Professionals',
              style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 12),
          const Text('Information for pros about earning and onboarding.'),
          const Spacer(),
          const SiteFooterWidget(),
        ]),
      ),
    );
  }
}
