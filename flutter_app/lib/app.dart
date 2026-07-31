import 'package:flutter/material.dart';
import 'core/theme/app_theme.dart';
import 'core/routes/app_routes.dart';

class ServioApp extends StatelessWidget {
  const ServioApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      debugShowCheckedModeBanner: false,
      title: 'Servio',
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      routerConfig: AppRoutes.router,
    );
  }
}
