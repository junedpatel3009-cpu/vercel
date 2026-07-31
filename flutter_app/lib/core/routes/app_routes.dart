import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../screens/landing/landing_screen.dart';
import '../../screens/auth/login_screen.dart';
import '../../screens/auth/signup_screen.dart';
import '../../screens/dashboard/dashboard_screen.dart';
import '../../screens/services/services_screen.dart';
import '../../screens/messages/messages_screen.dart';
import '../../screens/notifications/notifications_screen.dart';
import '../../screens/discover/discover_screen.dart';
import '../../screens/post_job/post_job_screen.dart';
import '../../screens/misc/pricing_screen.dart';
import '../../screens/misc/how_it_works_screen.dart';
import '../../screens/misc/forgot_password_screen.dart';
import '../../screens/misc/faq_screen.dart';
import '../../screens/misc/for_clients_screen.dart';
import '../../screens/misc/for_professionals_screen.dart';
import '../../screens/verification/verification_screen.dart';
import '../../screens/misc/verify_screen.dart';
import '../../screens/admin/admin_screen.dart';
import '../../screens/misc/earnings_screen.dart';
import '../../screens/pro/pro_screen.dart';
import '../../screens/project/project_screen.dart';
import '../../screens/job/job_screen.dart';
import '../../screens/misc/database_view_screen.dart';
import '../../screens/auth/setup/profile_setup_screen.dart';
import '../auth/auth_service.dart';

class AppRoutes {
  static final GoRouter router = GoRouter(
    initialLocation: '/',
    redirect: (context, state) async {
      final isLoggedIn = await AuthService().isLoggedIn();
      final needsAuth = state.matchedLocation == '/dashboard' || 
                        state.matchedLocation == '/profile' ||
                        state.matchedLocation == '/post-job';

      if (needsAuth && !isLoggedIn) return '/login';
      return null;
    },
    routes: [
      GoRoute(path: '/', builder: (context, state) => const LandingScreen()),
      GoRoute(path: '/setup/:role', builder: (context, state) => ProfileSetupScreen(role: state.pathParameters['role']!)),
      GoRoute(path: '/login', builder: (context, state) => const LoginScreen()),
      GoRoute(path: '/signup', builder: (context, state) => const SignupScreen()),
      GoRoute(path: '/dashboard', builder: (context, state) => const DashboardScreen()),
      GoRoute(path: '/services', builder: (context, state) => const ServicesScreen()),
      GoRoute(path: '/jobs', builder: (context, state) => const DashboardScreen()),
      GoRoute(path: '/messages', builder: (context, state) => const MessagesScreen()),
      GoRoute(path: '/notifications', builder: (context, state) => const NotificationsScreen()),
      GoRoute(
        path: '/profile', 
        builder: (context, state) {
          return FutureBuilder<Map<String, dynamic>?>(
            future: AuthService().getUser(),
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting) {
                return const Scaffold(body: Center(child: CircularProgressIndicator()));
              }
              final user = snapshot.data;
              final role = user?['role'] ?? 'client';
              return ProfileSetupScreen(role: role);
            },
          );
        },
      ),
      GoRoute(path: '/discover', builder: (context, state) => const DiscoverScreen()),
      GoRoute(path: '/post-job', builder: (context, state) => const PostJobScreen()),
      GoRoute(path: '/pricing', builder: (context, state) => const PricingScreen()),
      GoRoute(path: '/how-it-works', builder: (context, state) => const HowItWorksScreen()),
      GoRoute(path: '/forgot-password', builder: (context, state) => const ForgotPasswordScreen()),
      GoRoute(path: '/faq', builder: (context, state) => const FaqScreen()),
      GoRoute(path: '/for-clients', builder: (context, state) => const ForClientsScreen()),
      GoRoute(path: '/for-professionals', builder: (context, state) => const ForProfessionalsScreen()),
      GoRoute(path: '/verification', builder: (context, state) => const VerificationScreen()),
      GoRoute(path: '/verify', builder: (context, state) => const VerifyScreen()),
      GoRoute(path: '/admin', builder: (context, state) => const AdminScreen()),
      GoRoute(path: '/earnings', builder: (context, state) => const EarningsScreen()),
      GoRoute(path: '/services/:proId', builder: (context, state) => ProScreen(proId: state.pathParameters['proId']!)),
      GoRoute(path: '/pro/:proId', builder: (context, state) => ProScreen(proId: state.pathParameters['proId']!)),
      GoRoute(path: '/project/:projectId', builder: (context, state) => ProjectScreen(projectId: state.pathParameters['projectId']!)),
      GoRoute(path: '/job/:jobId', builder: (context, state) => JobScreen(jobId: state.pathParameters['jobId'])),
      GoRoute(path: '/db-view', builder: (context, state) => const DatabaseViewScreen()),
    ],
  );
}
