import 'package:flutter/material.dart';

class PrimaryButton extends StatelessWidget {
  final VoidCallback? onPressed;
  final Widget child;
  final bool small;
  final bool isLoading;

  const PrimaryButton({
    super.key,
    required this.onPressed,
    required this.child,
    this.small = false,
    this.isLoading = false,
  });

  @override
  Widget build(BuildContext context) {
    return ElevatedButton(
      style: ElevatedButton.styleFrom(
        backgroundColor: Theme.of(context).colorScheme.primary,
        foregroundColor: Theme.of(context).colorScheme.onPrimary,
        padding: EdgeInsets.symmetric(
            horizontal: small ? 12 : 16, vertical: small ? 8 : 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        disabledBackgroundColor: Theme.of(context).colorScheme.primary.withValues(alpha: 0.6),
      ),
      onPressed: isLoading ? null : onPressed,
      child: isLoading 
        ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
        : child,
    );
  }
}

class SecondaryButton extends StatelessWidget {
  final VoidCallback? onPressed;
  final Widget child;
  final bool isLoading;

  const SecondaryButton({
    super.key, 
    required this.onPressed, 
    required this.child,
    this.isLoading = false,
  });

  @override
  Widget build(BuildContext context) {
    return OutlinedButton(
      style: OutlinedButton.styleFrom(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
      onPressed: isLoading ? null : onPressed,
      child: isLoading 
        ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
        : child,
    );
  }
}
