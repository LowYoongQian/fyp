import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../widgets/glass_card.dart';

class LoginScreen extends StatefulWidget {
  final String portalType; // 'student' or 'staff'
  final bool isSyncing;
  final Function(String, String, String) onLogin; // (emailOrId, password, portalType)
  final VoidCallback onBackPressed;

  const LoginScreen({
    super.key,
    required this.portalType,
    required this.isSyncing,
    required this.onLogin,
    required this.onBackPressed,
  });

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailOrIdController = TextEditingController();
  final _passwordController = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  @override
  void dispose() {
    _emailOrIdController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void submit() {
    if (_formKey.currentState!.validate()) {
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

    final Color primaryColor = isStudent ? const Color(0xFF2563EB) : const Color(0xFF800000);
    final String portalTitle = isStudent ? "Student Login" : "Staff Login";
    final String idLabel = isStudent ? "Student ID / Email Address" : "Staff ID / Email Address";
    final String idHint = isStudent ? "eg. ST2510091 or email" : "eg. T000001 or email";

    final primaryTextColor = isDarkMode ? Colors.white : const Color(0xFF0F172A);
    final secondaryTextColor = isDarkMode ? const Color(0xFF94A3B8) : const Color(0xFF64748B);
    final cardBgColor = isDarkMode ? const Color(0xFF1E293B).withValues(alpha: 0.9) : Colors.white.withValues(alpha: 0.85);
    final borderColor = isDarkMode ? const Color(0xFF334155) : const Color(0xFFE2E8F0);

    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 24.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Custom Header with back arrow & lock icon
            Row(
              children: [
                IconButton(
                  onPressed: widget.onBackPressed,
                  icon: Icon(Icons.arrow_back, color: primaryTextColor, size: 20),
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
                Text(
                  portalTitle,
                  style: GoogleFonts.spaceGrotesk(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: primaryTextColor,
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
                    color: Colors.black.withValues(alpha: isDarkMode ? 0.2 : 0.04),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  )
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
                      border: Border.all(color: primaryColor.withValues(alpha: 0.3), width: 1.5),
                    ),
                    child: Center(
                      child: Icon(
                        isStudent ? Icons.lock_person : Icons.admin_panel_settings,
                        color: primaryColor,
                        size: 26,
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    portalTitle.toUpperCase(),
                    style: GoogleFonts.spaceGrotesk(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: primaryTextColor,
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    isStudent
                        ? "Secure Attendance Student Terminal"
                        : "Attendance Gateway Administration Console",
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
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      idLabel,
                      style: GoogleFonts.spaceGrotesk(
                        fontSize: 11.5,
                        fontWeight: FontWeight.bold,
                        color: primaryTextColor,
                      ),
                    ),
                    const SizedBox(height: 6),
                    TextFormField(
                      controller: _emailOrIdController,
                      style: GoogleFonts.inter(fontSize: 12, color: primaryTextColor),
                      decoration: _buildInputDecoration(
                        context: context,
                        hintText: idHint,
                        prefixIcon: isStudent ? Icons.school_outlined : Icons.badge_outlined,
                      ),
                      validator: (v) {
                        if (v == null || v.trim().isEmpty) {
                          return isStudent ? "Student ID or Email is required" : "Staff ID or Email is required";
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 16),

                    Text(
                      "Password",
                      style: GoogleFonts.spaceGrotesk(
                        fontSize: 11.5,
                        fontWeight: FontWeight.bold,
                        color: primaryTextColor,
                      ),
                    ),
                    const SizedBox(height: 6),
                    TextFormField(
                      controller: _passwordController,
                      obscureText: true,
                      style: GoogleFonts.inter(fontSize: 12, color: primaryTextColor),
                      decoration: _buildInputDecoration(
                        context: context,
                        hintText: "••••••••",
                        prefixIcon: Icons.key_outlined,
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
                          ? const SizedBox(
                              height: 18,
                              width: 18,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                            )
                          : Text(
                              "LOGIN",
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
          ],
        ),
      ),
    );
  }

  InputDecoration _buildInputDecoration({
    required BuildContext context,
    required String hintText,
    required IconData prefixIcon,
  }) {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    final inputBg = isDarkMode ? const Color(0xFF0F172A) : const Color(0xFFF8FAFC);
    final borderColor = isDarkMode ? const Color(0xFF334155) : const Color(0xFFE2E8F0);
    final iconColor = isDarkMode ? const Color(0xFF94A3B8) : const Color(0xFF64748B);

    return InputDecoration(
      hintText: hintText,
      hintStyle: GoogleFonts.inter(color: iconColor, fontSize: 12),
      prefixIcon: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12.0),
        child: Icon(prefixIcon, color: iconColor, size: 18),
      ),
      prefixIconConstraints: const BoxConstraints(minWidth: 40, minHeight: 0),
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
          color: widget.portalType == 'student' ? const Color(0xFF2563EB) : const Color(0xFF800000),
          width: 1.5,
        ),
      ),
      errorStyle: const TextStyle(fontSize: 9),
    );
  }
}
