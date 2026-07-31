import 'package:flutter/material.dart';

class SiteFooterWidget extends StatelessWidget {
  const SiteFooterWidget({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    
    return Container(
      color: isDark ? theme.colorScheme.surface : const Color(0xFF0F172A),
      padding: const EdgeInsets.symmetric(vertical: 60, horizontal: 24),
      child: Column(
        children: [
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 1200),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 32,
                          height: 32,
                          decoration: BoxDecoration(
                            color: theme.colorScheme.primary,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Icon(Icons.work, color: Colors.white, size: 18),
                        ),
                        const SizedBox(width: 10),
                        const Text(
                          'Servio',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                            letterSpacing: -0.5,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      'The world\'s work marketplace',
                      style: TextStyle(color: Color(0xFF94A3B8)),
                    ),
                  ],
                ),
                Row(
                  children: [
                    _socialIcon(Icons.facebook),
                    _socialIcon(Icons.link),
                    _socialIcon(Icons.camera_alt),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 40),
          const Divider(color: Color(0xFF1E293B)),
          const SizedBox(height: 24),
          const Text(
            '© 2026 Servio Global Inc. Built with Flutter.',
            style: TextStyle(color: Color(0xFF64748B), fontSize: 12),
          ),
        ],
      ),
    );
  }

  Widget _socialIcon(IconData icon) {
    return IconButton(
      onPressed: () {},
      icon: Icon(icon, color: const Color(0xFF94A3B8)),
    );
  }
}

