import 'package:flutter/material.dart';
import '../../widgets/site_header.dart';
import '../../widgets/site_footer.dart';

class MessagesScreen extends StatelessWidget {
  const MessagesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const SiteHeaderWidget(),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(children: [
          Text('Messages', style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 12),
          const Text('Conversation list will appear here.'),
          const Spacer(),
          const SiteFooterWidget(),
        ]),
      ),
    );
  }
}
