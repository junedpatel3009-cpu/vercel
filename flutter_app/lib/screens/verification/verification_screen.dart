import 'package:flutter/material.dart';
import '../../widgets/site_header.dart';
import '../../widgets/site_footer.dart';

class VerificationScreen extends StatelessWidget {
  const VerificationScreen({super.key});

  @override
  Widget build(BuildContext context) {
    const govId = 'passport.pdf';
    const tradeLicense = 'trade-license.pdf';
    const insurance = 'insurance.jpg';
    return Scaffold(
      appBar: const SiteHeaderWidget(),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Verification',
              style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 12),
          const Text(
              'Upload government ID, trade license, and insurance documents.'),
          const SizedBox(height: 12),
          const ListTile(
              leading: Icon(Icons.insert_drive_file),
              title: Text('Government ID'),
              subtitle: Text(govId)),
          const ListTile(
              leading: Icon(Icons.insert_drive_file),
              title: Text('Trade License'),
              subtitle: Text(tradeLicense)),
          const ListTile(
              leading: Icon(Icons.image),
              title: Text('Insurance photo'),
              subtitle: Text(insurance)),
          const Spacer(),
          const SiteFooterWidget(),
        ]),
      ),
    );
  }
}
