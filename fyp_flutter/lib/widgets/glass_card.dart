// ignore_for_file: deprecated_member_use, use_build_context_synchronously
import 'dart:ui';
import 'package:flutter/material.dart';

// -----------------------------------------------------------------
// REUSABLE CARD WIDGET: Glassmorphism Card
// -----------------------------------------------------------------
class GlassCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final double? width;
  final double? height;
  final BorderRadius? borderRadius;
  final Color? color;
  final Color? borderColor;

  const GlassCard({
    super.key,
    required this.child,
    this.padding,
    this.width,
    this.height,
    this.borderRadius,
    this.color,
    this.borderColor,
  });

  @override
  Widget build(BuildContext context) {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    final defaultColor = isDarkMode
        ? const Color(0xFF1E1E1E).withValues(alpha: 0.75)
        : Colors.white.withValues(alpha: 0.75);
    final defaultBorderColor = isDarkMode
        ? const Color(0xFF334155).withValues(alpha: 0.4)
        : Colors.white.withValues(alpha: 0.4);

    final radius = borderRadius ?? BorderRadius.circular(20);
    return ClipRRect(
      borderRadius: radius,
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 8.0, sigmaY: 8.0),
        child: Container(
          width: width,
          height: height,
          padding: padding ?? const EdgeInsets.all(20.0),
          decoration: BoxDecoration(
            color: color ?? defaultColor,
            borderRadius: radius,
            border: Border.all(
              color: borderColor ?? defaultBorderColor,
              width: 1.2,
            ),
          ),
          child: child,
        ),
      ),
    );
  }
}
