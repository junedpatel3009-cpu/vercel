import 'package:flutter/material.dart';
import '../../widgets/site_header.dart';
import '../../widgets/site_footer.dart';
import '../../widgets/misc.dart';

class FaqScreen extends StatelessWidget {
  const FaqScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const SiteHeaderWidget(),
      body: SingleChildScrollView(
        child: Column(
          children: [
            Stack(
              children: [
                Positioned.fill(child: CustomPaint(painter: GridPainter())),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 80, horizontal: 24),
                  child: Column(
                    children: [
                      Text('Frequently Asked Questions', style: Theme.of(context).textTheme.headlineLarge?.copyWith(fontSize: 40)),
                      const SizedBox(height: 20),
                      const Text('Everything you need to know about Servio', style: TextStyle(fontSize: 18, color: Colors.grey)),
                    ],
                  ),
                ),
              ],
            ),

            Container(
              padding: const EdgeInsets.symmetric(vertical: 60, horizontal: 24),
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 800),
                  child: Column(
                    children: [
                      _faqItem('How do I hire a professional?', 'Search for the service you need, review pro profiles and ratings, and click "Hire" to start a conversation.'),
                      _faqItem('Is my payment secure?', 'Yes, all payments are held in escrow and only released to the professional once you confirm the job is completed.'),
                      _faqItem('What if I\'m not happy with the work?', 'Our Money-back Guarantee covers you. If the work doesn\'t meet the agreed standards, we\'ll help resolve the issue or provide a refund.'),
                      _faqItem('How do I become a professional on Servio?', 'Click "Become a Professional" in the footer or menu, complete your profile, and undergo our verification process.'),
                      _faqItem('Are there any fees for clients?', 'Posting a job is free. We only charge a small service fee once a project is successfully completed.'),
                    ],
                  ),
                ),
              ),
            ),

            const SiteFooterWidget(),
          ],
        ),
      ),
    );
  }

  Widget _faqItem(String question, String answer) {
    return Container(
      margin: const EdgeInsets.only(bottom: 20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey[200]!),
      ),
      child: ExpansionTile(
        title: Text(question, style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF1E3A8A))),
        childrenPadding: const EdgeInsets.all(20),
        expandedAlignment: Alignment.topLeft,
        children: [
          Text(answer, style: const TextStyle(color: Colors.grey, height: 1.6)),
        ],
      ),
    );
  }
}

