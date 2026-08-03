import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../widgets/site_header.dart';
import '../../widgets/site_footer.dart';
import '../../core/auth/auth_service.dart';
import '../../core/api/api_client.dart';
import '../../core/auth/biometric_service.dart';
import '../../core/auth/email_service.dart';

class SignupScreen extends StatefulWidget {
  const SignupScreen({super.key});

  @override
  State<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends State<SignupScreen> {
  final _formKey = GlobalKey<FormState>();
  
  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;
  bool _isLoading = false;
  bool _isSendingOtp = false;
  bool _emailVerified = false;
  bool _biometricEnabled = false;
  String? _biometricType; // 'fingerprint' or 'face'
  
  String _userRole = 'client';
  String? _sentOtp;

  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _emailController = TextEditingController();
  final _otpController = TextEditingController();
  final _phoneController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  bool _acceptTerms = false;

  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    _emailController.dispose();
    _otpController.dispose();
    _phoneController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  // --- OTP Logic ---
  Future<void> _sendOtp() async {
    final email = _emailController.text.trim();
    if (email.isEmpty) {
      _showFriendlySnackBar('Please enter your email address.');
      return;
    }
    if (!RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$').hasMatch(email)) {
      _showFriendlySnackBar('Please enter a valid email address.');
      return;
    }

    setState(() => _isSendingOtp = true);
    try {
      final otp = await EmailService().sendOtpEmail(email);
      if (otp != null) {
        _sentOtp = otp;
        _showFriendlySnackBar('Verification code sent successfully.');
      } else {
        _showFriendlySnackBar('Failed to send verification code. Please check your Gmail App Password.');
      }
    } catch (e) {
      _showFriendlySnackBar('Unexpected error: $e');
    } finally {
      if (mounted) setState(() => _isSendingOtp = false);
    }
  }

  void _verifyOtp() {
    if (_otpController.text.trim() == _sentOtp && _sentOtp != null) {
      setState(() => _emailVerified = true);
      _showFriendlySnackBar('Email verified successfully!');
    } else {
      _showFriendlySnackBar('Invalid verification code. Please check and try again.');
    }
  }

  // ... (keep _handleBiometricToggle as is, it's mostly fine)
  Future<void> _handleBiometricToggle(bool value) async {
    if (!value) {
      setState(() {
        _biometricEnabled = false;
        _biometricType = null;
      });
      return;
    }

    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Enable Biometric Login'),
        content: const Text('Would you like to use biometric authentication for faster and more secure login?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          ElevatedButton(onPressed: () => Navigator.pop(context, true), child: const Text('Continue')),
        ],
      ),
    );

    if (confirm != true) return;
    if (!mounted) return;

    final type = await showModalBottomSheet<String>(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (context) => Container(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Choose your preferred biometric method', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            const SizedBox(height: 12),
            const Text('Note: Your device must support the selected method.', style: TextStyle(fontSize: 12, color: Colors.grey)),
            const SizedBox(height: 24),
            ListTile(
              leading: const Icon(Icons.fingerprint, color: Colors.green),
              title: const Text('Fingerprint Authentication'),
              onTap: () => Navigator.pop(context, 'fingerprint'),
            ),
            const Divider(),
            ListTile(
              leading: const Icon(Icons.face, color: Colors.blue),
              title: const Text('Face / Iris Authentication'),
              onTap: () => Navigator.pop(context, 'face'),
            ),
          ],
        ),
      ),
    );

    if (type == null) return;
    if (!mounted) return;

    // Check if the specific biometric type is available if possible
    final available = await BiometricService().getAvailableBiometrics();
    debugPrint('Available biometrics: $available');
    
    // Some devices might not list them specifically but still support 'authenticate'
    // We will proceed but give a better message if it fails.

    final success = await BiometricService().authenticate();
    if (!mounted) return;
    if (success) {
      setState(() {
        _biometricEnabled = true;
        _biometricType = type;
      });
      _showFriendlySnackBar('Biometric authentication enabled!');
    } else {
      _showFriendlySnackBar('Authentication failed. Please try again.');
      setState(() {
        _biometricEnabled = false;
        _biometricType = null;
      });
    }
  }

  Future<void> _handleSignup() async {
    if (!_formKey.currentState!.validate()) {
      _showFriendlySnackBar('Please complete all required fields correctly.');
      return;
    }
    if (!_emailVerified) {
      _showFriendlySnackBar('Please verify your email address first.');
      return;
    }
    if (!_acceptTerms) {
      _showFriendlySnackBar('Please accept the Terms & Conditions.');
      return;
    }

    setState(() => _isLoading = true);

    try {
      // Check internet for registration too if it were an API, but here it's local DB.
      // For consistency with user request, we'll keep it robust.

      final email = _emailController.text.trim();
      final phone = _phoneController.text.trim();
      final user = {
        'role': _userRole,
        'full_name': '${_firstNameController.text.trim()} ${_lastNameController.text.trim()}',
        'email': email,
        'phone': phone,
        'password_hash': _passwordController.text, 
        'biometric_enabled': _biometricEnabled ? 1 : 0,
        'biometric_type': _biometricType,
        'profile_completed': 0,
        'account_status': 'active',
        'created_at': DateTime.now().toIso8601String(),
        'updated_at': DateTime.now().toIso8601String(),
      };

      final sessionUser = await AuthService().register(user);
      if (sessionUser == null) throw ApiException('Unable to create your account.');
      if (_biometricEnabled) {
        await AuthService().setBiometricPreference(true, _biometricType);
      }

      if (mounted) {
        _showSuccessDialog();
      }
    } on ApiException catch (e) {
      _showFriendlySnackBar(e.message);
    } catch (e) {
      debugPrint('Registration Error: $e');
      _showFriendlySnackBar('Unable to complete your registration: $e');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _showFriendlySnackBar(String message) {
    if (mounted) {
      ScaffoldMessenger.of(context).hideCurrentSnackBar();
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
    }
  }

  void _showSuccessDialog() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.check_circle, color: Colors.green, size: 64),
            const SizedBox(height: 20),
            const Text('Success!', style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            const Text('Your account has been created successfully.', textAlign: TextAlign.center),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () {
                  Navigator.pop(context);
                  context.go('/setup/$_userRole');
                },
                child: const Text('Complete Profile'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isMobile = MediaQuery.of(context).size.width < 600;

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: const SiteHeaderWidget(),
      body: SafeArea(
        child: TweenAnimationBuilder<double>(
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
              Padding(
                padding: EdgeInsets.symmetric(vertical: 60, horizontal: isMobile ? 20 : 40),
                child: Center(
                  child: Container(
                    constraints: const BoxConstraints(maxWidth: 500),
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
                          Text('Create an account', style: theme.textTheme.headlineMedium),
                          const SizedBox(height: 8),
                          const Text('Join thousands of professionals and clients today'),
                          const SizedBox(height: 32),
                          
                          const Text('I want to...', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                          const SizedBox(height: 12),
                          Row(
                            children: [
                              Expanded(child: _roleCard('Hire Talent', 'client', Icons.person_search_outlined)),
                              const SizedBox(width: 16),
                              Expanded(child: _roleCard('Work as a Pro', 'professional', Icons.handyman_outlined)),
                            ],
                          ),
                          const SizedBox(height: 24),

                          Row(
                            children: [
                              Expanded(child: _buildTextField('First Name', _firstNameController, 'John')),
                              const SizedBox(width: 16),
                              Expanded(child: _buildTextField('Last Name', _lastNameController, 'Doe')),
                            ],
                          ),
                          const SizedBox(height: 20),
                          
                          _buildEmailWithOtpSection(),
                          const SizedBox(height: 20),

                          _buildTextField('Phone Number', _phoneController, '9054358668', icon: Icons.phone_outlined, type: TextInputType.phone),
                          const SizedBox(height: 20),
                          
                          _buildTextField('Password', _passwordController, '••••••••', icon: Icons.lock_outline, isPassword: true, obscure: _obscurePassword, onToggle: () => setState(() => _obscurePassword = !_obscurePassword)),
                          const SizedBox(height: 20),
                          _buildTextField('Confirm Password', _confirmPasswordController, '••••••••', icon: Icons.lock_outline, isPassword: true, obscure: _obscureConfirmPassword, onToggle: () => setState(() => _obscureConfirmPassword = !_obscureConfirmPassword)),
                          const SizedBox(height: 32),

                          _buildBiometricSetupSection(),
                          const SizedBox(height: 32),

                          Row(
                            children: [
                              Checkbox(value: _acceptTerms, onChanged: (v) => setState(() => _acceptTerms = v ?? false)),
                              const Expanded(child: Text('I agree to the Terms of Service and Privacy Policy.', style: TextStyle(fontSize: 12))),
                            ],
                          ),
                          const SizedBox(height: 32),
                          
                          _buildAnimatedButton(
                            onPressed: _isLoading ? null : _handleSignup,
                            isLoading: _isLoading,
                            child: const Text('Register'),
                          ),
                          
                          const SizedBox(height: 32),
                          Center(
                            child: Wrap(
                              children: [
                                const Text("Already have an account? "),
                                GestureDetector(
                                  onTap: () => context.push('/login'),
                                  child: Text('Sign in', style: TextStyle(color: theme.colorScheme.primary, fontWeight: FontWeight.bold)),
                                ),
                              ],
                            ),
                          ),
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
      ),
    );
  }

  Widget _buildTextField(String label, TextEditingController controller, String hint, {IconData? icon, bool isPassword = false, bool obscure = false, VoidCallback? onToggle, TextInputType type = TextInputType.text}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
        const SizedBox(height: 8),
        TextFormField(
          controller: controller,
          obscureText: obscure,
          keyboardType: type,
          decoration: InputDecoration(
            hintText: hint,
            prefixIcon: icon != null ? Icon(icon, size: 20) : null,
            suffixIcon: isPassword ? IconButton(icon: Icon(obscure ? Icons.visibility_off_outlined : Icons.visibility_outlined, size: 20), onPressed: onToggle) : null,
          ),
          validator: (value) {
            if (value == null || value.isEmpty) return 'Please enter your ${label.toLowerCase()}';
            if (label == 'Email Address' && !RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$').hasMatch(value)) return 'Please enter a valid email';
            if (label == 'Password' && value.length < 8) return 'Password must be at least 8 characters';
            if (label == 'Confirm Password' && value.trim() != _passwordController.text.trim()) return 'Passwords do not match';
            return null;
          },
        ),
      ],
    );
  }

  Widget _buildEmailWithOtpSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Email Address', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
        const SizedBox(height: 8),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              flex: 2,
              child: TextFormField(
                controller: _emailController,
                readOnly: _emailVerified,
                decoration: InputDecoration(
                  hintText: 'name@gmail.com',
                  prefixIcon: const Icon(Icons.email_outlined, size: 20),
                  suffixIcon: _emailVerified ? const Icon(Icons.check_circle, color: Colors.green) : null,
                ),
                validator: (v) {
                  if (v == null || v.isEmpty) return 'Please enter your email address.';
                  if (!RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$').hasMatch(v)) return 'Please enter a valid email.';
                  return null;
                },
              ),
            ),
            const SizedBox(width: 8),
            SizedBox(
              width: 100,
              height: 48,
              child: _buildAnimatedButton(
                onPressed: _emailVerified || _isSendingOtp ? null : _sendOtp,
                isLoading: _isSendingOtp,
                padding: EdgeInsets.zero,
                child: Text(_emailVerified ? 'Verified' : 'Send OTP', style: const TextStyle(fontSize: 11)),
              ),
            ),
          ],
        ),
        if (!_emailVerified && _sentOtp != null) ...[
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: _buildTextField('OTP Verification', _otpController, 'Enter 6-digit code', type: TextInputType.number)),
              const SizedBox(width: 8),
              Padding(
                padding: const EdgeInsets.only(top: 20),
                child: SizedBox(
                  width: 80,
                  height: 48,
                  child: _buildAnimatedButton(onPressed: _verifyOtp, isLoading: false, child: const Text('Verify', style: TextStyle(fontSize: 11))),
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }

  Widget _buildBiometricSetupSection() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.grey[50],
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey[200]!),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(_biometricType == 'fingerprint' ? Icons.fingerprint : (_biometricType == 'face' ? Icons.face : Icons.security), 
                   color: _biometricType == 'fingerprint' ? Colors.green : (_biometricType == 'face' ? Colors.blue : Colors.grey), size: 20),
              const SizedBox(width: 8),
              const Text('Biometric Login Setup', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
              const Spacer(),
              Switch(
                value: _biometricEnabled,
                onChanged: _handleBiometricToggle,
                activeTrackColor: Colors.blue[100],
                activeColor: Colors.blue[800],
              ),
            ],
          ),
          const SizedBox(height: 4),
          const Text('Enable biometric authentication for faster and more secure login.', style: TextStyle(fontSize: 12, color: Colors.grey)),
        ],
      ),
    );
  }

  Widget _roleCard(String title, String role, IconData icon) {
    final isSelected = _userRole == role;
    final theme = Theme.of(context);
    return GestureDetector(
      onTap: () => setState(() => _userRole = role),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          color: isSelected ? theme.colorScheme.primary.withValues(alpha: 0.05) : Colors.transparent,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: isSelected ? theme.colorScheme.primary : Colors.grey[300]!, width: isSelected ? 2 : 1),
        ),
        child: Column(
          children: [
            Icon(icon, color: isSelected ? theme.colorScheme.primary : Colors.grey, size: 24),
            const SizedBox(height: 8),
            Text(title, style: TextStyle(fontSize: 13, fontWeight: isSelected ? FontWeight.bold : FontWeight.normal, color: isSelected ? theme.colorScheme.primary : Colors.black87)),
          ],
        ),
      ),
    );
  }

  Widget _buildAnimatedButton({required VoidCallback? onPressed, required Widget child, required bool isLoading, EdgeInsets? padding}) {
    return _AnimatedButton(onPressed: onPressed, padding: padding, isLoading: isLoading, child: child);
  }
}

class _AnimatedButton extends StatefulWidget {
  final VoidCallback? onPressed;
  final Widget child;
  final EdgeInsets? padding;
  final bool isLoading;
  const _AnimatedButton({this.onPressed, required this.child, this.padding, required this.isLoading});

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
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDisabled = widget.onPressed == null || widget.isLoading;
    return GestureDetector(
      onTapDown: (_) => !isDisabled ? _controller.forward() : null,
      onTapUp: (_) {
        if (!isDisabled) {
          _controller.reverse();
          widget.onPressed!();
        }
      },
      onTapCancel: () => _controller.reverse(),
      child: ScaleTransition(
        scale: _scale,
        child: SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: null, // Logic handled by GestureDetector
            style: ElevatedButton.styleFrom(
              disabledBackgroundColor: isDisabled ? Colors.grey[300] : Theme.of(context).colorScheme.primary,
              disabledForegroundColor: Colors.white,
              padding: widget.padding,
            ),
            child: widget.isLoading 
              ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : widget.child,
          ),
        ),
      ),
    );
  }
}
