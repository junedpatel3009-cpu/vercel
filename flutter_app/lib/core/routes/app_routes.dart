import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../screens/landing/landing_screen.dart';
import '../../screens/auth/login_screen.dart';
import '../../screens/auth/signup_screen.dart';
import '../../screens/dashboard/dashboard_screen.dart';
import '../../screens/dashboard/client_reports_screen.dart';
import '../../screens/dashboard/client_find_pros_screen.dart';
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
import '../../screens/project/client_projects_screen.dart';
import '../../screens/project/project_screen.dart';
import '../../screens/project/track_project_screen.dart';
import '../../screens/professional/professional_workspace_screen.dart';
import '../../screens/job/job_screen.dart';
import '../../screens/job/jobs_screen.dart';
import '../../screens/job/saved_jobs_screen.dart';
import '../../screens/misc/database_view_screen.dart';
import '../../screens/auth/setup/profile_setup_screen.dart';
import '../../screens/auth/welcome_screen.dart';
import '../auth/auth_service.dart';
import '../../widgets/client_workspace_menu.dart';

class AppRoutes {
  static CustomTransitionPage<void> _page(GoRouterState state, Widget child) {
    return CustomTransitionPage<void>(
      key: state.pageKey,
      child: child,
      transitionDuration: const Duration(milliseconds: 340),
      reverseTransitionDuration: const Duration(milliseconds: 260),
      transitionsBuilder: (context, animation, secondaryAnimation, child) {
        final curve = CurvedAnimation(parent: animation, curve: Curves.easeOutCubic);
        return FadeTransition(
          opacity: curve,
          child: SlideTransition(
            position: Tween<Offset>(
              begin: const Offset(0.025, 0.02),
              end: Offset.zero,
            ).animate(curve),
            child: child,
          ),
        );
      },
    );
  }

  static GoRoute _route(
    String path,
    Widget Function(BuildContext context, GoRouterState state) screen,
  ) {
    return GoRoute(
      path: path,
      pageBuilder: (context, state) => _page(
        state,
        ClientWorkspaceMenu(
          location: state.matchedLocation,
          child: screen(context, state),
        ),
      ),
    );
  }

  static final GoRouter router = GoRouter(
    initialLocation: '/',
    redirect: (context, state) async {
      final isLoggedIn = await AuthService().isLoggedIn();
      final hasSeenWelcome = await AuthService().hasSeenWelcome();
      final location = state.matchedLocation;
      if (isLoggedIn && !hasSeenWelcome) {
        await AuthService().markWelcomeSeen();
      }
      if (location == '/welcome' && hasSeenWelcome) return '/';
      if (location == '/' && !hasSeenWelcome && !isLoggedIn) return '/welcome';
      final needsAuth = state.matchedLocation == '/dashboard' || 
                        state.matchedLocation == '/profile' ||
                        state.matchedLocation == '/post-job' ||
                        state.matchedLocation.startsWith('/project-track/');

      // Do not force the login page on app start or after a restored-session
      // race. Guests can browse the home screen and choose to sign in when
      // they use an action that needs an account.
      if (needsAuth && !isLoggedIn) return '/';
      return null;
    },
    routes: [
      _route('/', (context, state) => const LandingScreen()),
      _route('/welcome', (context, state) => const WelcomeScreen()),
      _route('/setup/:role', (context, state) => ProfileSetupScreen(role: state.pathParameters['role']!)),
      _route('/login', (context, state) => LoginScreen(
        initialError: state.uri.queryParameters['sessionExpired'] == '1'
            ? 'Your session has expired. Please sign in again.'
            : null,
      )),
      _route('/signup', (context, state) => const SignupScreen()),
      _route('/dashboard', (context, state) => const DashboardScreen()),
      _route('/reports', (context, state) => const ClientReportsScreen()),
      _route('/client/find-pros', (context, state) => const ClientFindProsScreen()),
      _route('/services', (context, state) => const ServicesScreen()),
      _route('/jobs', (context, state) => const JobsScreen()),
      _route('/projects', (context, state) => const ClientProjectsScreen()),
      _route('/saved-jobs', (context, state) => const SavedJobsScreen()),
      _route('/messages', (context, state) => MessagesScreen(
            initialProfessionalId: state.uri.queryParameters['proId'],
            initialProfessionalName: state.uri.queryParameters['name'],
            initialProfessionalAvatar: state.uri.queryParameters['avatar'],
          )),
      _route('/notifications', (context, state) => const NotificationsScreen()),
      _route('/profile', (context, state) => const _ProfileDestination()),
      _route('/discover', (context, state) => const DiscoverScreen()),
      _route('/post-job', (context, state) => const PostJobScreen()),
      _route('/pricing', (context, state) => const PricingScreen()),
      _route('/how-it-works', (context, state) => const HowItWorksScreen()),
      _route('/forgot-password', (context, state) => const ForgotPasswordScreen()),
      _route('/faq', (context, state) => const FaqScreen()),
      _route('/for-clients', (context, state) => const ForClientsScreen()),
      _route('/for-professionals', (context, state) => const ForProfessionalsScreen()),
      _route('/verification', (context, state) => const VerificationScreen()),
      _route('/verify', (context, state) => const VerifyScreen()),
      _route('/admin', (context, state) => const AdminScreen()),
      _route('/earnings', (context, state) => const EarningsScreen()),
      _route('/professional-workspace', (context, state) => const ProfessionalWorkspaceScreen()),
      _route('/services/:proId', (context, state) => ProScreen(proId: state.pathParameters['proId']!)),
      _route('/pro/:proId', (context, state) => ProScreen(proId: state.pathParameters['proId']!)),
      _route('/project/:projectId', (context, state) => ProjectScreen(projectId: state.pathParameters['projectId']!)),
      _route('/project-track/:trackingId', (context, state) => TrackProjectScreen(trackingId: state.pathParameters['trackingId']!)),
      _route('/job/:jobId', (context, state) => JobScreen(jobId: state.pathParameters['jobId'])),
      _route('/db-view', (context, state) => const DatabaseViewScreen()),
    ],
  );
}

/// Resolves the saved user only once. Creating a Future directly inside a
/// route builder restarts it whenever GoRouter rebuilds the route, which made
/// the profile screen repeatedly show its loading state.
class _ProfileDestination extends StatefulWidget {
  const _ProfileDestination();

  @override
  State<_ProfileDestination> createState() => _ProfileDestinationState();
}

class _ProfileDestinationState extends State<_ProfileDestination> {
  late final Future<Map<String, dynamic>?> _user = AuthService().getUser();

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>?>(
      future: _user,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Scaffold(body: Center(child: CircularProgressIndicator()));
        }

        final role = (snapshot.data?['role'] ?? 'client').toString();
        return role.toLowerCase() == 'client'
            ? const DashboardScreen()
            : const ProfessionalWorkspaceScreen();
      },
    );
  }
}
