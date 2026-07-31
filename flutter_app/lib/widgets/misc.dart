import 'package:flutter/material.dart';

class LoadingWidget extends StatelessWidget {
  const LoadingWidget({super.key});

  @override
  Widget build(BuildContext context) {
    return const Center(child: CircularProgressIndicator());
  }
}

class EmptyState extends StatelessWidget {
  final String message;

  const EmptyState({super.key, this.message = 'No items found.'});

  @override
  Widget build(BuildContext context) {
    return Center(
        child: Text(message, style: Theme.of(context).textTheme.bodyLarge));
  }
}

class ErrorWidgetSimple extends StatelessWidget {
  final String message;

  const ErrorWidgetSimple({super.key, this.message = 'Unable to complete your request. Please try again.'});

  @override
  Widget build(BuildContext context) {
    return Center(
        child: Text(message,
            style: Theme.of(context)
                .textTheme
                .bodyLarge
                ?.copyWith(color: Colors.red)));
  }
}

class GridPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = const Color(0xFFF1F5F9)
      ..strokeWidth = 1.0;

    const double gap = 40.0;
    
    for (double x = 0; x < size.width; x += gap) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }
    
    for (double y = 0; y < size.height; y += gap) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

