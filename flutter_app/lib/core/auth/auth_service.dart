import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';
import '../api/api_client.dart';

class AuthService {
  static final AuthService _instance = AuthService._internal();
  factory AuthService() => _instance;
  AuthService._internal();

  static const String _userKey = 'user_session';
  static const String _accessTokenKey = 'access_token';
  static const String _biometricUserKey = 'biometric_user_data';
  static const String _biometricTokenKey = 'biometric_access_token';
  static const String _biometricTypeKey = 'biometric_type';
  static const String _welcomeSeenKey = 'welcome_screen_seen';

  Future<bool> hasSeenWelcome() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_welcomeSeenKey) ?? false;
  }

  Future<void> markWelcomeSeen() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_welcomeSeenKey, true);
  }

  Future<void> saveUser(Map<String, dynamic> user) async {
    final prefs = await SharedPreferences.getInstance();
    final userJson = jsonEncode(user);
    await prefs.setString(_userKey, userJson);
    
    // If biometric is enabled for this user, remember them specifically for biometric login
    if (user['biometric_enabled'] == 1 || user['biometric_enabled'] == true) {
      await prefs.setString(_biometricUserKey, userJson);
    }
  }

  Future<void> saveSession(Map<String, dynamic> user, String accessToken,
      {bool isProfileComplete = false}) async {
    final normalizedUser = Map<String, dynamic>.from(user);
    normalizedUser['role'] = normalizedUser['role'].toString().toLowerCase();
    normalizedUser['profile_completed'] = isProfileComplete;
    await saveUser(normalizedUser);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_accessTokenKey, accessToken);
    ApiClient.instance.setAccessToken(accessToken);
  }

  Future<Map<String, dynamic>?> getBiometricUser() async {
    final prefs = await SharedPreferences.getInstance();
    final userStr = prefs.getString(_biometricUserKey);
    if (userStr != null) return jsonDecode(userStr);
    return null;
  }

  Future<Map<String, dynamic>?> getUser() async {
    final prefs = await SharedPreferences.getInstance();
    final userStr = prefs.getString(_userKey);
    if (userStr != null) return jsonDecode(userStr);
    return null;
  }

  Future<String?> getAccessToken() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString(_accessTokenKey);
    ApiClient.instance.setAccessToken(token);
    return token;
  }

  /// Restores the locally saved session before the router is created.
  /// This keeps a signed-in user on the app home after closing and reopening
  /// the app; signing out is the only action that clears this session.
  Future<bool> restoreSession() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString(_accessTokenKey);
    final userJson = prefs.getString(_userKey);

    if (token == null || token.trim().isEmpty || userJson == null || userJson.trim().isEmpty) {
      ApiClient.instance.setAccessToken(null);
      return false;
    }

    try {
      final user = jsonDecode(userJson);
      if (user is! Map) {
        ApiClient.instance.setAccessToken(null);
        return false;
      }
      ApiClient.instance.setAccessToken(token);
      await prefs.setBool(_welcomeSeenKey, true);
      return true;
    } catch (_) {
      ApiClient.instance.setAccessToken(null);
      return false;
    }
  }

  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    // A biometric-enabled user may re-open the session only after the device
    // confirms fingerprint/face authentication on the login screen.
    if (prefs.getBool('biometric_enabled') == true) {
      final token = prefs.getString(_accessTokenKey);
      if (token != null && token.isNotEmpty) {
        await prefs.setString(_biometricTokenKey, token);
      }
    }
    await prefs.remove(_userKey);
    await prefs.remove(_accessTokenKey);
    ApiClient.instance.setAccessToken(null);
    // We DON'T remove _biometricUserKey here so they can log back in with biometrics
  }

  Future<bool> isLoggedIn() async {
    final user = await getUser();
    return user != null && user.isNotEmpty;
  }

  Future<void> setBiometricPreference(bool enabled, String? type) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('biometric_enabled', enabled);
    if (type != null) {
      await prefs.setString(_biometricTypeKey, type);
    } else {
      await prefs.remove(_biometricTypeKey);
    }
    if (enabled) {
      final user = prefs.getString(_userKey);
      final token = prefs.getString(_accessTokenKey);
      if (user != null) await prefs.setString(_biometricUserKey, user);
      if (token != null && token.isNotEmpty) await prefs.setString(_biometricTokenKey, token);
    } else {
      await prefs.remove(_biometricUserKey);
      await prefs.remove(_biometricTokenKey);
    }
  }

  /// Restores a locally remembered session only after the device biometric
  /// prompt has succeeded. This is deliberately never called at app startup.
  Future<Map<String, dynamic>?> restoreBiometricSession() async {
    final prefs = await SharedPreferences.getInstance();
    final userJson = prefs.getString(_biometricUserKey);
    final token = prefs.getString(_biometricTokenKey);
    if (userJson == null || token == null || token.isEmpty) return null;
    try {
      final user = Map<String, dynamic>.from(jsonDecode(userJson) as Map);
      await prefs.setString(_userKey, userJson);
      await prefs.setString(_accessTokenKey, token);
      ApiClient.instance.setAccessToken(token);
      return user;
    } catch (_) {
      return null;
    }
  }

  // Alias for compatibility
  Future<void> setBiometricEnabled(bool enabled) async {
    await setBiometricPreference(enabled, null);
  }

  Future<bool> isBiometricEnabled() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool('biometric_enabled') ?? false;
  }

  Future<String?> getBiometricType() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_biometricTypeKey);
  }

  Future<Map<String, dynamic>?> login(String identifier, String password) async {
    final result = await ApiClient.instance.post('/api/v1/auth/login',
        data: {'email': identifier, 'password': password}, authenticated: false);
    final user = Map<String, dynamic>.from(result['user'] as Map);
    await saveSession(user, result['accessToken'] as String,
        isProfileComplete: result['isProfileComplete'] == true);
    return getUser();
  }

  Future<Map<String, dynamic>?> register(Map<String, dynamic> userData, {Map<String, dynamic>? profileData}) async {
    final fullName = (userData['full_name'] ?? '').toString().trim().split(RegExp(r'\s+'));
    final result = await ApiClient.instance.post('/api/v1/auth/register', data: {
      'role': userData['role'].toString().toUpperCase(),
      'firstName': fullName.isEmpty ? '' : fullName.first,
      'lastName': fullName.length > 1 ? fullName.skip(1).join(' ') : '-',
      'email': userData['email'],
      'phone': userData['phone'],
      'password': userData['password_hash'],
    }, authenticated: false);
    final user = Map<String, dynamic>.from(result['user'] as Map);
    await saveSession(user, result['accessToken'] as String);
    return getUser();
  }

  Future<bool> checkProfileCompletion(int userId, String role) async {
    final user = await getUser();
    return user?['profile_completed'] == true || user?['profile_completed'] == 1;
  }
}
