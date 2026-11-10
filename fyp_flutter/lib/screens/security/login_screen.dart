import '../../i18n/tr.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../widgets/glass_card.dart';

class LoginScreen extends StatefulWidget {
  final String portalType; // 'student' or 'staff'
  final bool isSyncing;
  final Function(String, String, String)
  onLogin; // (email or staff ID, password, portalType)
  final VoidCallback onBackPressed;
  /// Why the last sign-in on this portal failed; shown at the top of the card until the next try or dismissed.
  final String? error;
  final VoidCallback? onDismissError;

  const LoginScreen({
    super.key,
    required this.portalType,
    required this.isSyncing,
    required this.onLogin,
    required this.onBackPressed,
    this.error,
    this.onDismissError,
  });

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailOrIdController = TextEditingController();
  final _passwordController = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _hidePassword = true;

  @override
  void dispose() {
    _emailOrIdController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void submit() {
    if (widget.isSyncing) return;
    if (_formKey.currentState!.validate()) {
      FocusScope.of(context).unfocus();
      widget.onLogin(
        _emailOrIdController.text.trim(),
        _passwordController.text.trim(),
        widget.portalType,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final bool isStudent = widget.portalType == 'student';
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;

    // One brand blue for both portals (the staff dashboard and notification center are blue too).
    const Color primaryColor = Color(0xFF2563EB);
    final String portalTitle = isStudent ? "Student Login" : "Staff Login";
    final String idLabel = isStudent
        ? "School email"
        : "Staff ID / Email Address";
    final String idHint = isStudent
        ? "name@student.school.edu"
        : "eg. T000001 or email";

    final primaryTextColor = isDarkMode
        ? Colors.white
        : const Color(0xFF0F172A);
    final secondaryTextColor = isDarkMode
        ? const Color(0xFFA0A0A0)
        : const Color(0xFF64748B);
    final cardBgColor = isDarkMode
        ? const Color(0xFF222222).withValues(alpha: 0.9)
        : Colors.white.withValues(alpha: 0.85);
    final borderColor = isDarkMode
        ? const Color(0xFF333333)
        : const Color(0xFFE2E8F0);

    return Center(
      child: SingleChildScrollView(
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        padding: const EdgeInsets.symmetric(horizontal: 24.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Custom Header with back arrow & lock icon
            Row(
              children: [
                IconButton(
                  onPressed: widget.isSyncing ? null : widget.onBackPressed,
                  tooltip: tr('Back'),
                  icon: Icon(
                    Icons.arrow_back,
                    color: primaryTextColor,
                    size: 20,
                  ),
                  style: IconButton.styleFrom(
                    backgroundColor: cardBgColor,
                    padding: const EdgeInsets.all(8),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                      side: BorderSide(color: borderColor),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Icon(Icons.lock_outline, color: secondaryTextColor, size: 18),
                const SizedBox(width: 8),
                Flexible(
                  child: Text(
                    tr(portalTitle),
                    style: GoogleFonts.spaceGrotesk(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: primaryTextColor,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),

            // Branded Portal Badge Header
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
              width: double.infinity,
              decoration: BoxDecoration(
                color: cardBgColor,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: borderColor),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(
                      alpha: isDarkMode ? 0.2 : 0.04,
                    ),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                children: [
                  Container(
                    height: 52,
                    width: 52,
                    decoration: BoxDecoration(
                      color: primaryColor.withValues(alpha: 0.15),
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: primaryColor.withValues(alpha: 0.3),
                        width: 1.5,
                      ),
                    ),
                    child: Center(
                      child: Icon(
                        isStudent
                            ? Icons.lock_person
                            : Icons.admin_panel_settings,
                        color: primaryColor,
                        size: 26,
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    tr(portalTitle.toUpperCase()),
                    style: GoogleFonts.spaceGrotesk(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: primaryTextColor,
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    tr(isStudent
                        ? "Secure Attendance Student Terminal"
                        : "Attendance Gateway Administration Console"),
                    textAlign: TextAlign.center,
                    style: GoogleFonts.inter(
                      fontSize: 10,
                      color: secondaryTextColor,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Form container
            GlassCard(
              child: AutofillGroup(
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // The reason the last sign-in failed, right where the user will try again.
                      AnimatedSize(
                        duration: Duration(milliseconds: MediaQuery.disableAnimationsOf(context) ? 0 : 220),
                        curve: Curves.easeOutCubic,
                        alignment: Alignment.topCenter,
                        child: widget.error == null
                            ? const SizedBox(width: double.infinity)
                            : Padding(
                                padding: const EdgeInsets.only(bottom: 16),
                                child: _LoginError(message: widget.error!, isDark: isDarkMode, onDismiss: widget.onDismissError),
                              ),
                      ),
                      Text(
                        tr(idLabel),
                        style: GoogleFonts.spaceGrotesk(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          color: primaryTextColor,
                        ),
                      ),
                      const SizedBox(height: 6),
                      TextFormField(
                        controller: _emailOrIdController,
                        enabled: !widget.isSyncing,
                        autofillHints: const [AutofillHints.username],
                        keyboardType: isStudent
                            ? TextInputType.emailAddress
                            : TextInputType.text,
                        textInputAction: TextInputAction.next,
                        autocorrect: false,
                        enableSuggestions: false,
                        style: GoogleFonts.inter(
                          fontSize: 14,
                          color: primaryTextColor,
                        ),
                        decoration: _buildInputDecoration(
                          context: context,
                          hintText: idHint,
                          prefixIcon: isStudent
                              ? Icons.school_outlined
                              : Icons.badge_outlined,
                        ),
                        validator: (v) {
                          if (v == null || v.trim().isEmpty) {
                            return isStudent
                                ? "School email is required"
                                : "Staff ID or Email is required";
                          }
                          if (isStudent && !v.contains('@')) {
                            return "Use your school email";
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: 16),

                      Text(
                        tr('Password'),
                        style: GoogleFonts.spaceGrotesk(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          color: primaryTextColor,
                        ),
                      ),
                      const SizedBox(height: 6),
                      TextFormField(
                        controller: _passwordController,
                        enabled: !widget.isSyncing,
                        obscureText: _hidePassword,
                        enableSuggestions: false,
                        autocorrect: false,
                        autofillHints: const [AutofillHints.password],
                        textInputAction: TextInputAction.done,
                        onFieldSubmitted: (_) {
                          if (!widget.isSyncing) submit();
                        },
                        style: GoogleFonts.inter(
                          fontSize: 14,
                          color: primaryTextColor,
                        ),
                        decoration: _buildInputDecoration(
                          context: context,
                          hintText: "••••••••",
                          prefixIcon: Icons.key_outlined,
                          suffixIcon: IconButton(
                            onPressed: widget.isSyncing
                                ? null
                                : () => setState(
                                    () => _hidePassword = !_hidePassword,
                                  ),
                            tooltip: _hidePassword
                                ? 'Show password'
                                : 'Hide password',
                            icon: Icon(
                              _hidePassword
                                  ? Icons.visibility_outlined
                                  : Icons.visibility_off_outlined,
                              size: 19,
                            ),
                          ),
                        ),
                        validator: (v) {
                          if (v == null || v.trim().isEmpty) {
                            return "Password is required";
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: 24),

                      ElevatedButton(
                        onPressed: widget.isSyncing ? null : submit,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: primaryColor,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                          ),
                          elevation: 3,
                        ),
                        child: widget.isSyncing
                            ? SizedBox(
                                height: 18,
                                width: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                  semanticsLabel: tr('Signing in'),
                                ),
                              )
                            : Text(
                                tr('LOGIN'),
                                style: GoogleFonts.spaceGrotesk(
                                  fontSize: 13,
                                  fontWeight: FontWeight.bold,
                                  letterSpacing: 1.0,
                                ),
                              ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  InputDecoration _buildInputDecoration({
    required BuildContext context,
    required String hintText,
    required IconData prefixIcon,
    Widget? suffixIcon,
  }) {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    final inputBg = isDarkMode
        ? const Color(0xFF181818)
        : const Color(0xFFF8FAFC);
    final borderColor = isDarkMode
        ? const Color(0xFF333333)
        : const Color(0xFFE2E8F0);
    final iconColor = isDarkMode
        ? const Color(0xFFA0A0A0)
        : const Color(0xFF64748B);

    return InputDecoration(
      hintText: hintText,
      hintStyle: GoogleFonts.inter(color: iconColor, fontSize: 12),
      prefixIcon: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12.0),
        child: Icon(prefixIcon, color: iconColor, size: 18),
      ),
      prefixIconConstraints: const BoxConstraints(minWidth: 40, minHeight: 0),
      suffixIcon: suffixIcon == null
          ? null
          : IconTheme(
              data: IconThemeData(color: iconColor),
              child: suffixIcon,
            ),
      suffixIconConstraints: const BoxConstraints(minWidth: 48, minHeight: 48),
      filled: true,
      fillColor: inputBg,
      contentPadding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: borderColor, width: 1.0),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: borderColor, width: 1.0),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(
          color: const Color(0xFF2563EB),
          width: 1.5,
        ),
      ),
      errorStyle: const TextStyle(fontSize: 12),
      errorMaxLines: 3,
    );
  }
}

/// The sign-in error card: a red-tinted box with the reason and a dismiss button, read out once by screen readers.
class _LoginError extends StatelessWidget {
  final String message;
  final bool isDark;
  final VoidCallback? onDismiss;
  const _LoginError({required this.message, required this.isDark, this.onDismiss});

  @override
  Widget build(BuildContext context) {
    final ink = isDark ? const Color(0xFFFECACA) : const Color(0xFF991B1B);
    return Semantics(
      liveRegion: true,
      container: true,
      child: Container(
        padding: const EdgeInsets.fromLTRB(12, 10, 4, 10),
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF3B1414) : const Color(0xFFFEF2F2),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: isDark ? const Color(0xFF7F1D1D) : const Color(0xFFFECACA)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.only(top: 1),
              child: Icon(Icons.error_outline_rounded, size: 20, color: isDark ? const Color(0xFFF87171) : const Color(0xFFDC2626)),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(tr('Sign-in failed'), style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: ink)),
                  const SizedBox(height: 2),
                  Text(tr(message), style: TextStyle(fontSize: 12.5, height: 1.35, color: ink)),
                ],
              ),
            ),
            if (onDismiss != null)
              IconButton(
                onPressed: onDismiss,
                tooltip: tr('Dismiss'),
                visualDensity: VisualDensity.compact,
                icon: Icon(Icons.close_rounded, size: 18, color: ink),
              ),
          ],
        ),
      ),
    );
  }
}
