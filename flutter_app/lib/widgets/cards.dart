import 'package:flutter/material.dart';

class AppCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;

  const AppCard(
      {super.key,
      required this.child,
      this.padding = const EdgeInsets.all(16)});

  @override
  Widget build(BuildContext context) {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      elevation: 2,
      child: Padding(padding: padding, child: child),
    );
  }
}

class JobCard extends StatelessWidget {
  final String title;
  final String subtitle;
  final String price;
  final VoidCallback? onTap;

  const JobCard(
      {super.key,
      required this.title,
      required this.subtitle,
      required this.price,
      this.onTap});

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: InkWell(
        onTap: onTap,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 6),
          Text(subtitle, style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: 12),
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Text(price, style: const TextStyle(fontWeight: FontWeight.bold)),
            ElevatedButton(onPressed: () {}, child: const Text('Apply'))
          ]),
        ]),
      ),
    );
  }
}
