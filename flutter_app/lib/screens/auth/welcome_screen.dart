import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_service.dart';

/// The first-install experience. Its seen state is stored locally, so it is
/// shown only once for each app installation.
class WelcomeScreen extends StatefulWidget {
  const WelcomeScreen({super.key});

  @override
  State<WelcomeScreen> createState() => _WelcomeScreenState();
}

class _WelcomeScreenState extends State<WelcomeScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    )..forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _continueTo(String route) async {
    await AuthService().markWelcomeSeen();
    if (mounted) context.go(route);
  }

  @override
  Widget build(BuildContext context) {
    final entrance = CurvedAnimation(
      parent: _controller,
      curve: Curves.easeOutCubic,
    );
    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFF),
      body: SafeArea(
        child: FadeTransition(
          opacity: entrance,
          child: SlideTransition(
            position: Tween<Offset>(
              begin: const Offset(0, .04),
              end: Offset.zero,
            ).animate(entrance),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(28, 18, 28, 22),
              child: Column(
                children: [
                  const Spacer(),
                  const _MarketplaceArtwork(),
                  const SizedBox(height: 38),
                  const Text(
                    'Unlock premium service\nmarketplace access',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Color(0xFF102A5C),
                      fontSize: 27,
                      height: 1.16,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -.6,
                    ),
                  ),
                  const SizedBox(height: 15),
                  const Text(
                    'Connect with verified experts and trusted clients\nin one professional workspace.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Color(0xFF667085),
                      fontSize: 15,
                      height: 1.45,
                    ),
                  ),
                  const SizedBox(height: 34),
                  SizedBox(
                    width: double.infinity,
                    height: 54,
                    child: ElevatedButton(
                      onPressed: () => _continueTo('/signup'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF0F49A7),
                        foregroundColor: Colors.white,
                        elevation: 5,
                        shadowColor: const Color(0x550F49A7),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(15),
                        ),
                      ),
                      child: const Text(
                        'Create account',
                        style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
                      ),
                    ),
                  ),
                  const SizedBox(height: 13),
                  SizedBox(
                    width: double.infinity,
                    height: 54,
                    child: OutlinedButton(
                      onPressed: () => _continueTo('/login'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFF0F49A7),
                        side: const BorderSide(color: Color(0xFFB9C9ED)),
                        backgroundColor: const Color(0xFFF0F4FF),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(15),
                        ),
                      ),
                      child: const Text(
                        'Log in',
                        style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
                      ),
                    ),
                  ),
                  const SizedBox(height: 25),
                  const Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: [
                      Text('How it works', style: TextStyle(fontSize: 12, color: Color(0xFF98A2B3))),
                      Text('Trust & safety', style: TextStyle(fontSize: 12, color: Color(0xFF98A2B3))),
                      Text('Privacy', style: TextStyle(fontSize: 12, color: Color(0xFF98A2B3))),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _MarketplaceArtwork extends StatelessWidget {
  const _MarketplaceArtwork();

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 270,
      width: 290,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Positioned(
            right: 4,
            bottom: 0,
            child: Transform.rotate(
              angle: -.16,
              child: Container(
                height: 168,
                width: 210,
                decoration: BoxDecoration(
                  color: const Color(0xFFF4771C),
                  borderRadius: BorderRadius.circular(28),
                ),
              ),
            ),
          ),
          Container(
            height: 244,
            width: 270,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(32),
              boxShadow: const [
                BoxShadow(color: Color(0x160F172A), blurRadius: 28, offset: Offset(0, 14)),
              ],
            ),
            child: Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(23),
                gradient: const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [Color(0xFFEAF3FF), Color(0xFFF9FBFF)],
                ),
              ),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  const Icon(Icons.handshake_rounded, size: 94, color: Color(0xFF1649A3)),
                  Positioned(
                    top: 18,
                    right: 16,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(18),
                        boxShadow: const [BoxShadow(color: Color(0x1A0F172A), blurRadius: 10)],
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.verified_rounded, color: Color(0xFF0F49A7), size: 16),
                          SizedBox(width: 5),
                          Text('Verified professionals', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
