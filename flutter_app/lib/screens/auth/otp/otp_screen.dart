import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:pinput/pinput.dart';
import '../../../widgets/site_header.dart';
import '../../../widgets/site_footer.dart';

class OtpScreen extends StatefulWidget {
  final String role;
  const OtpScreen({super.key, required this.role});

  @override
  State<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends State<OtpScreen> {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isMobile = MediaQuery.of(context).size.width < 600;

    final defaultPinTheme = PinTheme(
      width: 56,
      height: 56,
      textStyle: const TextStyle(fontSize: 20, color: Color.fromRGBO(30, 60, 87, 1), fontWeight: FontWeight.w600),
      decoration: BoxDecoration(
        border: Border.all(color: const Color(0xFFE2E8F0)),
        borderRadius: BorderRadius.circular(12),
      ),
    );

    return Scaffold(
      appBar: const SiteHeaderWidget(),
      body: SingleChildScrollView(
        child: Column(
          children: [
            Container(
              constraints: const BoxConstraints(minHeight: 500),
              padding: EdgeInsets.symmetric(
                vertical: 80,
                horizontal: isMobile ? 20 : 40,
              ),
              child: Center(
                child: Container(
                  constraints: const BoxConstraints(maxWidth: 450),
                  padding: const EdgeInsets.all(32),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: const Color(0xFFF1F5F9)),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.05),
                        blurRadius: 20,
                        offset: const Offset(0, 10),
                      ),
                    ],
                  ),
                  child: Column(
                    children: [
                      const Icon(Icons.mark_email_unread_outlined, size: 48, color: Color(0xFF1E40AF)),
                      const SizedBox(height: 24),
                      Text(
                        'Verify your email',
                        style: theme.textTheme.headlineMedium,
                      ),
                      const SizedBox(height: 12),
                      const Text(
                        'We sent a 6-digit code to your email. Enter it below to continue.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: Colors.grey),
                      ),
                      const SizedBox(height: 40),
                      Pinput(
                        length: 6,
                        defaultPinTheme: defaultPinTheme,
                        focusedPinTheme: defaultPinTheme.copyDecorationWith(
                          border: Border.all(color: const Color(0xFF1E40AF)),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        onCompleted: (pin) => context.go('/setup/${widget.role}'),
                      ),
                      const SizedBox(height: 40),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: () => context.go('/setup/${widget.role}'),
                          child: const Text('Verify Account'),
                        ),
                      ),
                      const SizedBox(height: 24),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Text("Didn't receive the code? "),
                          TextButton(
                            onPressed: () {},
                            child: const Text('Resend', style: TextStyle(fontWeight: FontWeight.bold)),
                          ),
                        ],
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
}
