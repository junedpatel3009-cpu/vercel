import 'package:mailer/mailer.dart';
import 'package:mailer/smtp_server.dart';
import 'package:flutter/foundation.dart';
import 'dart:math';

class EmailService {
  static final EmailService _instance = EmailService._internal();
  factory EmailService() => _instance;
  EmailService._internal();

  final String _email = 'junedpatel3009@gmail.com';
  final String _password = 'jeug rvdq cixt bilw';

  Future<String?> sendOtpEmail(String recipientEmail) async {
    final otp = (100000 + Random().nextInt(900000)).toString();
    
    // Check if password is still a placeholder or contains spaces (App Passwords shouldn't have spaces, though mailer handles them)
    final cleanPassword = _password.replaceAll(' ', '');
    final smtpServer = gmail(_email, cleanPassword);

    final message = Message()
      ..from = Address(_email, 'Servio Support')
      ..recipients.add(recipientEmail)
      ..subject = 'Your Servio Verification Code'
      ..html = _buildEmailTemplate(otp);

    try {
      debugPrint('Sending email to $recipientEmail using $_email');
      final sendReport = await send(message, smtpServer);
      debugPrint('Email sent successfully: $sendReport');
      return otp;
    } on MailerException catch (e) {
      debugPrint('Mailer Error: ${e.message}');
      for (var p in e.problems) {
        debugPrint('Problem: ${p.code}: ${p.msg}');
      }
      return null;
    } catch (e) {
      debugPrint('Unexpected email error: $e');
      return null;
    }
  }

  String _buildEmailTemplate(String otp) {
    return '''
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
      <h2 style="color: #1e3a8a; text-align: center;">Verify Your Account</h2>
      <p style="color: #4b5563; font-size: 16px;">Hello,</p>
      <p style="color: #4b5563; font-size: 16px;">Use the verification code below to complete your registration or password reset on Servio:</p>
      <div style="background-color: #f3f4f6; padding: 20px; text-align: center; border-radius: 8px; margin: 30px 0;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #1e40af;">$otp</span>
      </div>
      <p style="color: #6b7280; font-size: 14px; text-align: center;">This code will expire in 10 minutes.</p>
      <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 30px 0;">
      <p style="color: #9ca3af; font-size: 12px; text-align: center;">If you didn't request this, you can safely ignore this email.</p>
    </div>
    ''';
  }
}
