import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../i18n/tr.dart';

/// The red notice under the header when the server could not be reached: what is on screen is the saved copy, and Retry
/// asks again. The student and staff dashboards share it so both say it the same way.
class NetworkErrorBanner extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  final bool retrying;
  final EdgeInsetsGeometry margin;
  const NetworkErrorBanner({super.key, required this.message, required this.onRetry, this.retrying = false,
      this.margin = const EdgeInsets.symmetric(horizontal: 16, vertical: 4)});

  @override
  Widget build(BuildContext context) {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    return Semantics(
      liveRegion: true,
      child: Container(
        margin: margin,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: isDarkMode ? const Color(0xFF451A1A) : const Color(0xFFFFF1F2),
          border: Border.all(color: const Color(0xFFF43F5E).withValues(alpha: 0.3)),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            const Icon(Icons.cloud_off, color: Color(0xFFE11D48), size: 16),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                tr(message),
                style: GoogleFonts.inter(
                  fontSize: 10.5,
                  fontWeight: FontWeight.w600,
                  color: isDarkMode ? const Color(0xFFFECDD3) : const Color(0xFFBE123C),
                ),
              ),
            ),
            TextButton(
              onPressed: retrying ? null : onRetry,
              child: retrying
                  ? const SizedBox.square(dimension: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFFF43F5E)))
                  : Text(tr('Retry'), style: const TextStyle(fontSize: 11, color: Color(0xFFF43F5E))),
            ),
          ],
        ),
      ),
    );
  }
}
