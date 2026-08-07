import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../widgets/site_header.dart';
import '../../widgets/site_footer.dart';
import '../../core/auth/auth_service.dart';
import '../../core/api/api_client.dart';
import '../../core/auth/biometric_service.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  bool _obscurePassword = true;
  bool _isLoading = false;
  String? _loginError;
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final BiometricService _biometricService = BiometricService();

  @override
  void initState() {
    super.initState();
    _checkAutoBiometric();
  }

  Future<void> _checkAutoBiometric() async {
    final isEnabled = await AuthService().isBiometricEnabled();
    if (isEnabled) {
      Future.delayed(const Duration(milliseconds: 800), () {
        if (mounted) _handleBiometricLogin();
      });
    }
  }

  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) {
      _showError('Please enter a valid email address and password.');
      return;
    }
    setState(() {
      _isLoading = true;
      _loginError = null;
    });
    try {
      final user = await AuthService().login(
        _emailController.text.trim(), _passwordController.text.trim());
      if (user != null) {
        if (mounted) _navigateUser(user);
      }
    } on ApiException catch (e) {
      _showError(e.message);
    } catch (e) {
      _showError('Service is temporarily unavailable. Please try again later.');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _handleBiometricLogin() async {
    try {
      final success = await _biometricService.authenticate();
      if (success) {
        // The device prompt succeeded. Restore the user and bearer token that
        // were saved specifically for biometric login.
        var user = await AuthService().restoreBiometricSession();
        user ??= await AuthService().getUser();

        if (user != null && mounted) {
          _navigateUser(user);
        } else if (mounted) {
          _showError('No account found for biometric login. Please sign in with your password first.');
        }
      }
    } catch (e) {
      debugPrint('Biometric login error: $e');
    }
  }

  void _navigateUser(Map<String, dynamic> user) async {
    final role = user['role'] ?? 'client';
    final isComplete = await AuthService().checkProfileCompletion(user['id'], role);
    if (mounted) {
      if (isComplete) {
        context.go('/');
      } else {
        context.go('/setup/$role');
      }
    }
  }

  void _showError(String msg) {
    if (mounted) setState(() => _loginError = msg);
  }

  @override
  void dispose() { _emailController.dispose(); _passwordController.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: const SiteHeaderWidget(),
      body: TweenAnimationBuilder<double>(
        duration: const Duration(milliseconds: 420),
        curve: Curves.easeOutCubic,
        tween: Tween(begin: 0, end: 1),
        builder: (context, value, child) => Opacity(
          opacity: value,
          child: Transform.translate(
            offset: Offset(0, 20 * (1 - value)),
            child: child,
          ),
        ),
        child: SingleChildScrollView(
          child: Column(
          children: [
            Container(
              constraints: const BoxConstraints(minHeight: 600),
              padding: const EdgeInsets.symmetric(vertical: 60, horizontal: 24),
              child: Center(
                child: Container(
                  constraints: const BoxConstraints(maxWidth: 450),
                  padding: const EdgeInsets.all(32),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: Colors.grey[200]!),
                    boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 20, offset: const Offset(0, 10))],
                  ),
                  child: Form(
                    key: _formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Welcome back', style: theme.textTheme.headlineMedium),
                        const SizedBox(height: 8),
                        const Text('Enter your details to sign in to your account'),
                        AnimatedSwitcher(
                          duration: const Duration(milliseconds: 220),
                          child: _loginError == null
                              ? const SizedBox.shrink()
                              : Container(
                                  key: ValueKey(_loginError),
                                  width: double.infinity,
                                  margin: const EdgeInsets.only(top: 20),
                                  padding: const EdgeInsets.all(14),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFFFF7ED),
                                    borderRadius: BorderRadius.circular(12),
                                    border: Border.all(color: const Color(0xFFFED7AA)),
                                  ),
                                  child: Row(
                                    children: [
                                      const Icon(Icons.info_outline, color: Color(0xFFC2410C), size: 20),
                                      const SizedBox(width: 10),
                                      Expanded(
                                        child: Text(
                                          _loginError!,
                                          style: const TextStyle(color: Color(0xFF9A3412), fontSize: 13, fontWeight: FontWeight.w600),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                        ),
                        const SizedBox(height: 32),
                        _buildField('Email Address', _emailController, 'name@gmail.com', icon: Icons.email_outlined),
                        const SizedBox(height: 20),
                        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [const Text('Password', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)), TextButton(onPressed: () => context.push('/forgot-password'), child: const Text('Forgot password?', style: TextStyle(fontSize: 13)))]),
                        const SizedBox(height: 8),
                        TextFormField(
                          controller: _passwordController,
                          obscureText: _obscurePassword,
                          decoration: InputDecoration(
                            hintText: '••••••••',
                            prefixIcon: const Icon(Icons.lock_outline, size: 20),
                            suffixIcon: IconButton(icon: Icon(_obscurePassword ? Icons.visibility_off_outlined : Icons.visibility_outlined, size: 20), onPressed: () => setState(() => _obscurePassword = !_obscurePassword)),
                          ),
                          validator: (v) => (v == null || v.isEmpty) ? 'Please enter your password' : null,
                        ),
                        const SizedBox(height: 32),
                        _buildButton(),
                        const SizedBox(height: 16),
                        FutureBuilder<bool>(
                          future: _biometricService.isBiometricAvailable(),
                          builder: (context, snapshot) {
                            if (snapshot.data == true) {
                              return Center(
                                child: TextButton.icon(
                                  onPressed: _handleBiometricLogin,
                                  icon: const Icon(Icons.fingerprint),
                                  label: const Text('Sign in with Biometrics'),
                                ),
                              );
                            }
                            return const SizedBox.shrink();
                          },
                        ),
                        const SizedBox(height: 24),
                        Row(mainAxisAlignment: MainAxisAlignment.center, children: [const Text("Don't have an account? "), GestureDetector(onTap: () => context.push('/signup'), child: Text('Sign up', style: TextStyle(color: theme.colorScheme.primary, fontWeight: FontWeight.bold)))]),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            const SiteFooterWidget(),
          ],
          ),
        ),
      ),
    );
  }

  Widget _buildField(String label, TextEditingController controller, String hint, {IconData? icon}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
        const SizedBox(height: 8),
        TextFormField(
          controller: controller,
          decoration: InputDecoration(hintText: hint, prefixIcon: icon != null ? Icon(icon, size: 20) : null),
          validator: (v) {
            if (v == null || v.isEmpty) return 'Please enter your ${label.toLowerCase()}';
            if (label == 'Email Address' && !RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$').hasMatch(v)) return 'Please enter a valid email';
            return null;
          },
        ),
      ],
    );
  }

  Widget _buildButton() {
    return _AnimatedButton(onPressed: _isLoading ? null : _handleLogin, isLoading: _isLoading, child: const Text('Sign in'));
  }
}

class _AnimatedButton extends StatefulWidget {
  final VoidCallback? onPressed;
  final Widget child;
  final bool isLoading;
  const _AnimatedButton({this.onPressed, required this.child, required this.isLoading});
  @override
  State<_AnimatedButton> createState() => _AnimatedButtonState();
}

class _AnimatedButtonState extends State<_AnimatedButton> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scale;
  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: const Duration(milliseconds: 100));
    _scale = Tween<double>(begin: 1.0, end: 0.95).animate(_controller);
  }
  @override
  void dispose() { _controller.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) {
    final isDisabled = widget.onPressed == null || widget.isLoading;
    return GestureDetector(
      onTapDown: (_) => !isDisabled ? _controller.forward() : null,
      onTapUp: (_) { if (!isDisabled) { _controller.reverse(); widget.onPressed!(); } },
      onTapCancel: () => _controller.reverse(),
      child: ScaleTransition(
        scale: _scale, 
        child: SizedBox(
          width: double.infinity, 
          height: 54, 
          child: ElevatedButton(
            onPressed: null, 
            style: ElevatedButton.styleFrom(
              disabledBackgroundColor: isDisabled ? Colors.grey[300] : Theme.of(context).colorScheme.primary,
              disabledForegroundColor: Colors.white,
            ),
            child: widget.isLoading ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : widget.child,
          ),
        ),
      ),
    );
  }
}
