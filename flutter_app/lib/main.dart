import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:servio_flutter/app.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';
import 'package:servio_flutter/core/api/api_client.dart';
import 'package:servio_flutter/core/auth/auth_service.dart';
import 'package:servio_flutter/core/routes/app_routes.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Restore the saved sign-in before the router is built. The user should not
  // have to log in again merely because they closed the app.
  await AuthService().restoreSession();

  // Any authenticated request that comes back 401 (expired token, including a
  // restored biometric session older than the server's 24h token lifetime)
  // clears the stale session and sends the user back to login instead of
  // leaving them on a signed-in-looking screen with silently broken data.
  ApiClient.onUnauthorized = () {
    AuthService().handleSessionExpired().then((_) {
      AppRoutes.router.go('/login?sessionExpired=1');
    });
  };

  // Initialize sqflite for desktop (Windows/Linux)
  if (!kIsWeb && (Platform.isWindows || Platform.isLinux)) {
    sqfliteFfiInit();
    databaseFactory = databaseFactoryFfi;
  }

  runApp(const ServioApp());
}
