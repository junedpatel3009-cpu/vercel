import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:servio_flutter/app.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';
import 'package:servio_flutter/core/auth/auth_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Restore the bearer token before any protected screen makes an API call.
  await AuthService().getAccessToken();

  // Initialize sqflite for desktop (Windows/Linux)
  if (!kIsWeb && (Platform.isWindows || Platform.isLinux)) {
    sqfliteFfiInit();
    databaseFactory = databaseFactoryFfi;
  }

  runApp(const ServioApp());
}
