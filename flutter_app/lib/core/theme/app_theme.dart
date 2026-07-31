import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  // Brand Palette from Screenshots
  static const Color brandNavy = Color(0xFF0F172A);
  static const Color brandBlue = Color(0xFF1E40AF);
  static const Color brandOrange = Color(0xFFF97316);
  static const Color bgLight = Color(0xFFF8FAFC); // Very light lavender/gray
  static const Color surfaceWhite = Colors.white;
  static const Color alertPeach = Color(0xFFFFF7ED);
  static const Color textMain = Color(0xFF1E293B);
  static const Color textGray = Color(0xFF64748B);

  static final ThemeData lightTheme = ThemeData(
    useMaterial3: true,
    scaffoldBackgroundColor: bgLight,
    colorScheme: ColorScheme.fromSeed(
      seedColor: brandBlue,
      primary: brandBlue,
      secondary: brandOrange,
      surface: surfaceWhite,
      background: bgLight,
      outline: const Color(0xFFE2E8F0),
    ),
    pageTransitionsTheme: const PageTransitionsTheme(
      builders: {
        TargetPlatform.android: FadeUpwardsPageTransitionsBuilder(),
        TargetPlatform.iOS: FadeUpwardsPageTransitionsBuilder(),
        TargetPlatform.linux: FadeUpwardsPageTransitionsBuilder(),
        TargetPlatform.macOS: FadeUpwardsPageTransitionsBuilder(),
        TargetPlatform.windows: FadeUpwardsPageTransitionsBuilder(),
      },
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: surfaceWhite,
      foregroundColor: brandNavy,
      elevation: 0,
      surfaceTintColor: Colors.transparent,
      centerTitle: false,
    ),
    
    // Modern Card Design
    cardTheme: CardThemeData(
      color: surfaceWhite,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(24),
        side: const BorderSide(color: Color(0xFFF1F5F9)),
      ),
    ),

    // Input Decoration matching "Basic Information" card
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: surfaceWhite,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      hintStyle: const TextStyle(color: Color(0xFF94A3B8)),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: brandBlue, width: 2),
      ),
      prefixIconColor: textGray,
      suffixIconColor: textGray,
    ),

    // Typography
    textTheme: TextTheme(
      headlineLarge: GoogleFonts.plusJakartaSans(
        fontSize: 32,
        fontWeight: FontWeight.w800,
        color: brandNavy,
        letterSpacing: -0.5,
      ),
      headlineMedium: GoogleFonts.plusJakartaSans(
        fontSize: 24,
        fontWeight: FontWeight.w700,
        color: brandNavy,
      ),
      titleLarge: GoogleFonts.plusJakartaSans(
        fontSize: 18,
        fontWeight: FontWeight.w700,
        color: brandNavy,
      ),
      bodyLarge: GoogleFonts.inter(
        fontSize: 16,
        color: textMain,
        height: 1.5,
      ),
      bodyMedium: GoogleFonts.inter(
        fontSize: 14,
        color: textGray,
      ),
    ),

    // Elevated Buttons (Continue/Next)
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: brandBlue,
        foregroundColor: Colors.white,
        elevation: 0,
        minimumSize: const Size(0, 52),
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        animationDuration: const Duration(milliseconds: 180),
        textStyle: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 16),
      ),
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: brandNavy,
      contentTextStyle: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.w600),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
    ),
    navigationBarTheme: NavigationBarThemeData(
      height: 70,
      labelTextStyle: WidgetStateProperty.all(
        GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w700),
      ),
      indicatorColor: brandBlue.withValues(alpha: 0.12),
    ),
  );

  static final ThemeData darkTheme = lightTheme;
}
