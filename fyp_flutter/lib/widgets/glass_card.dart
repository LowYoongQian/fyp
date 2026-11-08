// ignore_for_file: deprecated_member_use, use_build_context_synchronously
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
        // Solid enough that the sky scene behind (sun, clouds, trees) never shows through the content as blurred shapes.
        ? const Color(0xFF222222).withValues(alpha: 0.9)
        : Colors.white.withValues(alpha: 0.9);
    final defaultBorderColor = isDarkMode
        ? const Color(0xFF333333).withValues(alpha: 0.4)
        : Colors.white.withValues(alpha: 0.4);

    final radius = borderRadius ?? BorderRadius.circular(20);
    return ClipRRect(
      borderRadius: radius,
      // No backdrop blur: at 90% opacity it was invisible, yet re-blurred the animated sky behind every card on every frame.
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
    );
  }
}
