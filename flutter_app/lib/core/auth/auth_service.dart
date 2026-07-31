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
  static const String _biometricTypeKey = 'biometric_type';

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

  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_userKey);
    await prefs.remove(_accessTokenKey);
    ApiClient.instance.setAccessToken(null);
    // We DON'T remove _biometricUserKey here so they can log back in with biometrics
  }

  Future<bool> isLoggedIn() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.containsKey(_userKey);
  }

  Future<void> setBiometricPreference(bool enabled, String? type) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('biometric_enabled', enabled);
    if (type != null) await prefs.setString(_biometricTypeKey, type);
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
