import 'package:flutter/material.dart';
import '../../widgets/site_header.dart';
import '../../widgets/site_footer.dart';
import '../../widgets/misc.dart';

class PricingScreen extends StatelessWidget {
  const PricingScreen({super.key});

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
                      Text('Simple, Transparent Pricing', style: Theme.of(context).textTheme.headlineLarge?.copyWith(fontSize: 40)),
                      const SizedBox(height: 20),
                      const Text('Choose the plan that fits your business needs', style: TextStyle(fontSize: 18, color: Colors.grey)),
                    ],
                  ),
                ),
              ],
            ),

            Container(
              padding: const EdgeInsets.symmetric(vertical: 60, horizontal: 24),
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 1200),
                  child: Wrap(
                    spacing: 24,
                    runSpacing: 24,
                    alignment: WrapAlignment.center,
                    children: [
                      _pricingCard(
                        context,
                        'Starter',
                        '0',
                        'Perfect for individuals getting started',
                        ['10 Job proposals/mo', 'Basic profile', 'Standard support'],
                      ),
                      _pricingCard(
                        context,
                        'Professional',
                        '49',
                        'Boost your business with pro features',
                        ['Unlimited proposals', 'Featured profile', 'Priority support', 'Analytics'],
                        isPopular: true,
                      ),
                      _pricingCard(
                        context,
                        'Business',
                        '99',
                        'Advanced tools for larger teams',
                        ['Team management', 'API access', 'Dedicated manager', 'Custom branding'],
                      ),
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

  Widget _pricingCard(BuildContext context, String title, String price, String desc, List<String> features, {bool isPopular = false}) {
    return Container(
      width: 350,
      padding: const EdgeInsets.all(32),
      decoration: BoxDecoration(
        color: isPopular ? const Color(0xFF0F172A) : Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: isPopular ? Colors.transparent : Colors.grey[200]!),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 20, offset: const Offset(0, 10))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (isPopular)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              decoration: BoxDecoration(color: const Color(0xFF3B82F6), borderRadius: BorderRadius.circular(20)),
              child: const Text('Most Popular', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
            ),
          const SizedBox(height: 16),
          Text(title, style: TextStyle(color: isPopular ? Colors.white : Colors.black, fontSize: 24, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          Text(desc, style: TextStyle(color: isPopular ? Colors.white70 : Colors.grey)),
          const SizedBox(height: 32),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text('\$$price', style: TextStyle(color: isPopular ? Colors.white : Colors.black, fontSize: 40, fontWeight: FontWeight.bold)),
              Padding(
                padding: const EdgeInsets.only(bottom: 8, left: 4),
                child: Text('/mo', style: TextStyle(color: isPopular ? Colors.white70 : Colors.grey)),
              ),
            ],
          ),
          const SizedBox(height: 32),
          ...features.map((f) => Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Row(
              children: [
                const Icon(Icons.check_circle, color: Color(0xFF10B981), size: 18),
                const SizedBox(width: 12),
                Text(f, style: TextStyle(color: isPopular ? Colors.white70 : Colors.black87)),
              ],
            ),
          )).toList(),
          const SizedBox(height: 32),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () {},
              style: ElevatedButton.styleFrom(
                backgroundColor: isPopular ? const Color(0xFF3B82F6) : Colors.black,
                padding: const EdgeInsets.symmetric(vertical: 20),
              ),
              child: const Text('Choose Plan'),
            ),
          ),
        ],
      ),
    );
  }
}
