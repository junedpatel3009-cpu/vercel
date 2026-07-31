import 'package:local_auth/local_auth.dart';
import 'package:flutter/services.dart';
import 'package:flutter/foundation.dart';

class BiometricService {
  static final BiometricService _instance = BiometricService._internal();
  factory BiometricService() => _instance;
  BiometricService._internal();

  final LocalAuthentication _auth = LocalAuthentication();

  Future<bool> isBiometricAvailable() async {
    try {
      final bool canAuthenticateWithBiometrics = await _auth.canCheckBiometrics;
      final bool canAuthenticate = canAuthenticateWithBiometrics || await _auth.isDeviceSupported();
      return canAuthenticate;
    } on PlatformException catch (e) {
      debugPrint('Biometric avail check failed: $e');
      return false;
    } catch (e) {
      return false;
    }
  }

  Future<bool> authenticate() async {
    try {
      final bool canCheck = await isBiometricAvailable();
      if (!canCheck) return false;

      return await _auth.authenticate(
        localizedReason: 'Please authenticate to sign in to Servio',
        biometricOnly: false,
        persistAcrossBackgrounding: true,
      );
    } on PlatformException catch (e) {
      debugPrint('Biometric error: ${e.code} - ${e.message}');
      return false;
    } catch (e) {
      debugPrint('Unexpected biometric error: $e');
      return false;
    }
  }

  Future<List<BiometricType>> getAvailableBiometrics() async {
    try {
      return await _auth.getAvailableBiometrics();
    } catch (e) {
      return [];
    }
  }
}
