import 'dart:io';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../widgets/site_header.dart';
import '../../widgets/site_footer.dart';
import '../../core/auth/email_service.dart';
import '../../core/database/database_helper.dart';

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _emailController = TextEditingController();
  final _otpController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  
  int _step = 1; // 1: Email, 2: OTP, 3: New Password
  bool _isLoading = false;
  String? _sentOtp;

  Future<void> _sendOtp() async {
    final email = _emailController.text.trim();
    
    // 1. Check if empty
    if (email.isEmpty) {
      _showFriendlyMsg('Please enter your email address.');
      return;
    }
    
    // 2. Check format
    if (!RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$').hasMatch(email)) {
      _showFriendlyMsg('Please enter a valid email address.');
      return;
    }

    setState(() => _isLoading = true);
    try {
      // 4. Check if email exists in database
      final exists = await DatabaseHelper().checkUserExists(email, '');
      if (!exists) {
        _showFriendlyMsg('No account was found with this email address.');
        return;
      }

      // 5. Send OTP
      final otp = await EmailService().sendOtpEmail(email);
      if (otp != null) {
        _sentOtp = otp;
        await DatabaseHelper().database.then((db) => db.insert('otp_verifications', {
          'email': email,
          'otp': otp,
          'expires_at': DateTime.now().add(const Duration(minutes: 10)).toIso8601String(),
        }));
        setState(() => _step = 2);
        _showFriendlyMsg('Verification code sent successfully.');
      } else {
        _showFriendlyMsg('Service is temporarily unavailable. Please try again later.');
      }
    } catch (e) {
      _showFriendlyMsg('Service is temporarily unavailable. Please try again later.');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _verifyOtp() {
    if (_otpController.text.trim().isEmpty) {
      _showFriendlyMsg('Please enter the verification code.');
      return;
    }
    if (_otpController.text.trim() == _sentOtp && _sentOtp != null) {
      setState(() => _step = 3);
      _showFriendlyMsg('Code verified! Please set your new password.');
    } else {
      _showFriendlyMsg('Invalid verification code. Please check and try again.');
    }
  }

  Future<void> _resetPassword() async {
    final pass = _newPasswordController.text;
    final confirm = _confirmPasswordController.text;

    if (pass.isEmpty) {
      _showFriendlyMsg('Please enter a new password.');
      return;
    }
    if (pass.length < 8) {
      _showFriendlyMsg('Password must be at least 8 characters long.');
      return;
    }
    if (pass != confirm) {
      _showFriendlyMsg('Passwords do not match.');
      return;
    }

    setState(() => _isLoading = true);
    try {
      final db = await DatabaseHelper().database;
      await db.update(
        'users',
        {'password_hash': pass, 'updated_at': DateTime.now().toIso8601String()},
        where: 'email = ?',
        whereArgs: [_emailController.text.trim()],
      );
      if (!mounted) return;
      _showFriendlyMsg('Your password has been reset successfully!');
      context.go('/login');
    } catch (e) {
      _showFriendlyMsg('Unable to reset your password. Please try again later.');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _showFriendlyMsg(String msg) {
    if (mounted) {
      ScaffoldMessenger.of(context).hideCurrentSnackBar();
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
    }
  }

  @override
  void dispose() {
    _emailController.dispose();
    _otpController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: const SiteHeaderWidget(),
      body: SingleChildScrollView(
        child: Column(
          children: [
            Container(
              constraints: const BoxConstraints(minHeight: 500),
              padding: const EdgeInsets.symmetric(vertical: 80, horizontal: 24),
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
                  child: _buildStepContent(),
                ),
              ),
            ),
            const SiteFooterWidget(),
          ],
        ),
      ),
    );
  }

  Widget _buildStepContent() {
    switch (_step) {
      case 1:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Reset Password', style: Theme.of(context).textTheme.headlineMedium),
            const SizedBox(height: 8),
            const Text('Enter your email to receive a 6-digit verification code.'),
            const SizedBox(height: 32),
            _buildField('Email Address', _emailController, 'name@example.com'),
            const SizedBox(height: 32),
            _buildButton(onPressed: _isLoading ? null : _sendOtp, text: 'Send Code'),
          ],
        );
      case 2:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Verify Code', style: Theme.of(context).textTheme.headlineMedium),
            const SizedBox(height: 8),
            Text('Enter the code sent to ${_emailController.text}'),
            const SizedBox(height: 32),
            _buildField('Verification Code', _otpController, '123456', type: TextInputType.number),
            const SizedBox(height: 32),
            _buildButton(onPressed: _isLoading ? null : _verifyOtp, text: 'Verify'),
          ],
        );
      case 3:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('New Password', style: Theme.of(context).textTheme.headlineMedium),
            const SizedBox(height: 8),
            const Text('Set a new, secure password for your account.'),
            const SizedBox(height: 32),
            _buildField('New Password', _newPasswordController, '••••••••', obscure: true),
            const SizedBox(height: 16),
            _buildField('Confirm Password', _confirmPasswordController, '••••••••', obscure: true),
            const SizedBox(height: 32),
            _buildButton(onPressed: _isLoading ? null : _resetPassword, text: 'Reset Password'),
          ],
        );
      default:
        return const SizedBox();
    }
  }

  Widget _buildField(String label, TextEditingController controller, String hint, {bool obscure = false, TextInputType type = TextInputType.text}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
        const SizedBox(height: 8),
        TextField(
          controller: controller, 
          obscureText: obscure, 
          keyboardType: type, 
          decoration: InputDecoration(hintText: hint)
        ),
      ],
    );
  }

  Widget _buildButton({required VoidCallback? onPressed, required String text}) {
    return _AnimatedButton(onPressed: onPressed, text: text, isLoading: _isLoading);
  }
}

class _AnimatedButton extends StatefulWidget {
  final VoidCallback? onPressed;
  final String text;
  final bool isLoading;
  const _AnimatedButton({this.onPressed, required this.text, required this.isLoading});

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
          height: 54,
          child: ElevatedButton(
            onPressed: null,
            style: ElevatedButton.styleFrom(
              disabledBackgroundColor: isDisabled ? Colors.grey[300] : Theme.of(context).colorScheme.primary,
              disabledForegroundColor: Colors.white,
            ),
            child: widget.isLoading ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)) : Text(widget.text),
          ),
        ),
      ),
    );
  }
}
