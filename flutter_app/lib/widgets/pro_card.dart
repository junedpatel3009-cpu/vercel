import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:go_router/go_router.dart';
import '../core/theme/app_theme.dart';
import 'motion.dart';

class ProCardWidget extends StatelessWidget {
  final Map<String, dynamic> pro;

  const ProCardWidget({super.key, required this.pro});

  @override
  Widget build(BuildContext context) {
    return FadeSlideIn(
      child: Pressable(
        child: Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFF1F5F9)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AspectRatio(
            aspectRatio: 1.8,
            child: CachedNetworkImage(
              imageUrl: pro['profile_photo'] ?? 'https://i.pravatar.cc/300?u=${pro['user_id']}',
              fit: BoxFit.cover,
              fadeInDuration: AppMotion.standard,
              placeholder: (context, _) => Container(color: Colors.grey[100]),
              errorWidget: (context, _, __) => Container(color: Colors.grey[100]),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        pro['full_name'] ?? 'Professional',
                        style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    Row(
                      children: [
                        const Icon(Icons.star, size: 14, color: AppTheme.brandOrange),
                        const SizedBox(width: 4),
                        Text(
                          '${pro['average_rating'] ?? 0.0}',
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                        ),
                      ],
                    ),
                  ],
                ),
                Text(
                  pro['profession'] ?? 'Service Expert',
                  style: const TextStyle(color: AppTheme.textGray, fontSize: 13),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 16),
                const Divider(color: Color(0xFFF1F5F9)),
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Starting at', style: TextStyle(color: AppTheme.textGray, fontSize: 10, fontWeight: FontWeight.bold)),
                        Text(
                          '\$${pro['hourly_rate'] ?? 0}/hr',
                          style: const TextStyle(
                            color: AppTheme.brandBlue,
                            fontWeight: FontWeight.w900,
                            fontSize: 18,
                          ),
                        ),
                      ],
                    ),
                    ElevatedButton(
                      onPressed: () => context.push('/pro/${pro['user_id']}'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.brandNavy,
                        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      child: const Text('Hire', style: TextStyle(fontWeight: FontWeight.bold)),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
        ),
      ),
    ),
  );
  }
}
