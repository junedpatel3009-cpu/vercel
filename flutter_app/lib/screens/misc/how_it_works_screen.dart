import 'package:flutter/material.dart';
import '../../widgets/site_header.dart';
import '../../widgets/site_footer.dart';
import '../../widgets/misc.dart';

class HowItWorksScreen extends StatelessWidget {
  const HowItWorksScreen({super.key});

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
                      Text('How Servio Works', style: Theme.of(context).textTheme.headlineLarge?.copyWith(fontSize: 40)),
                      const SizedBox(height: 20),
                      const Text('The simplest way to hire and manage professional services', style: TextStyle(fontSize: 18, color: Colors.grey)),
                    ],
                  ),
                ),
              ],
            ),
            
            _buildSection(
              context,
              'For Clients',
              'Hire the best talent for your projects',
              [
                _step(Icons.edit_note, 'Post your requirements', 'Describe your job in detail. The more info you give, the better the quotes you\'ll get.'),
                _step(Icons.people_outline, 'Review profiles', 'Check ratings, reviews, and previous work samples of interested pros.'),
                _step(Icons.task_alt, 'Hire & Get started', 'Choose your favorite pro and start your project with secure payments.'),
              ],
            ),

            Container(color: const Color(0xFFF8FAFC), child: _buildSection(
              context,
              'For Professionals',
              'Grow your business with Servio',
              [
                _step(Icons.search, 'Find opportunities', 'Browse thousands of jobs in your area and field of expertise.'),
                _step(Icons.send, 'Send quotes', 'Pitch your services and set your own rates for each project.'),
                _step(Icons.payments_outlined, 'Get paid safely', 'Secure payment system ensures you get paid for every milestone.'),
              ],
              isReversed: true,
            )),

            const SiteFooterWidget(),
          ],
        ),
      ),
    );
  }

  Widget _buildSection(BuildContext context, String title, String subtitle, List<Widget> steps, {bool isReversed = false}) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 100, horizontal: 24),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1200),
          child: Column(
            children: [
              Text(title, style: const TextStyle(color: Color(0xFF2563EB), fontWeight: FontWeight.bold, letterSpacing: 1.5)),
              const SizedBox(height: 12),
              Text(subtitle, style: Theme.of(context).textTheme.headlineMedium),
              const SizedBox(height: 60),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: steps,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _step(IconData icon, String title, String desc) {
    return Expanded(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
                boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 20, offset: const Offset(0, 10))],
              ),
              child: Icon(icon, color: const Color(0xFF2563EB), size: 32),
            ),
            const SizedBox(height: 24),
            Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18), textAlign: TextAlign.center),
            const SizedBox(height: 12),
            Text(desc, textAlign: TextAlign.center, style: const TextStyle(color: Colors.grey, height: 1.5)),
          ],
        ),
      ),
    );
  }
}

