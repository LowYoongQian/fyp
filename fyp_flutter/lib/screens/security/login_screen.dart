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

  void handleDemoFill() {
    setState(() {
      if (widget.portalType == 'student') {
        _emailOrIdController.text = 'TP061111'; // student 'low'
        _passwordController.text = 'password123';
      } else {
        _emailOrIdController.text = 'L999'; // lecturer 'Dr. Wong'
        _passwordController.text = 'password123';
      }
    });
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
    final Color primaryColor = isStudent ? const Color(0xFF2563EB) : const Color(0xFF800000);
    final String portalTitle = isStudent ? "Student Login" : "Staff Login";
    final String idLabel = isStudent ? "Student ID / Email Address" : "Staff ID / Email Address";
    final String idHint = isStudent ? "eg. TP061111 or email" : "eg. L999 or email";

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
                  icon: const Icon(Icons.arrow_back, color: Color(0xFF334155), size: 20),
                  style: IconButton.styleFrom(
                    backgroundColor: Colors.white.withValues(alpha: 0.5),
                    padding: const EdgeInsets.all(8),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                      side: BorderSide(color: const Color(0xFFE2E8F0).withValues(alpha: 0.5)),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                const Icon(Icons.lock_outline, color: Color(0xFF475569), size: 18),
                const SizedBox(width: 8),
                Text(
                  portalTitle,
                  style: GoogleFonts.spaceGrotesk(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: const Color(0xFF0F172A),
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
                color: Colors.white.withValues(alpha: 0.7),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: const Color(0xFFE2E8F0)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.02),
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
                      color: primaryColor.withValues(alpha: 0.1),
                      shape: BoxShape.circle,
                      border: Border.all(color: primaryColor.withValues(alpha: 0.2), width: 1.5),
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
                      color: const Color(0xFF0F172A),
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
                      color: const Color(0xFF64748B),
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
                        color: const Color(0xFF334155),
                      ),
                    ),
                    const SizedBox(height: 6),
                    TextFormField(
                      controller: _emailOrIdController,
                      style: const TextStyle(fontSize: 12),
                      decoration: _buildInputDecoration(
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
                        color: const Color(0xFF334155),
                      ),
                    ),
                    const SizedBox(height: 6),
                    TextFormField(
                      controller: _passwordController,
                      obscureText: true,
                      style: const TextStyle(fontSize: 12),
                      decoration: _buildInputDecoration(
                        hintText: "••••••••",
                        prefixIcon: Icons.key_outlined,
                      ),
                      validator: (v) => (v == null || v.length < 4) ? "Password must be at least 4 characters" : null,
                    ),
                    const SizedBox(height: 24),

                    Container(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: isStudent 
                              ? [const Color(0xFF2563EB), const Color(0xFF3B82F6)] 
                              : [const Color(0xFF800000), const Color(0xFFA02020)],
                        ),
                        borderRadius: BorderRadius.circular(14),
                        boxShadow: [
                          BoxShadow(
                            color: primaryColor.withValues(alpha: 0.3),
                            blurRadius: 12,
                            offset: const Offset(0, 4),
                          )
                        ],
                      ),
                      child: ElevatedButton(
                        onPressed: widget.isSyncing ? null : submit,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.transparent,
                          foregroundColor: Colors.white,
                          shadowColor: Colors.transparent,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                          ),
                        ),
                        child: Text(
                          "LOGIN",
                          style: GoogleFonts.spaceGrotesk(
                            fontSize: 13,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 1.0,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),

            // Demo Fill Panel
            Text(
              "QUICK DEMO INITIAL FILL",
              style: GoogleFonts.inter(
                fontSize: 9,
                fontWeight: FontWeight.w600,
                color: const Color(0xFF94A3B8),
                letterSpacing: 1.0,
              ),
            ),
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: handleDemoFill,
              icon: Icon(Icons.flash_on, size: 12, color: primaryColor),
              label: Text(
                isStudent ? "Student Profile (Low)" : "Staff Profile (Dr. Wong)",
                style: const TextStyle(fontSize: 10),
              ),
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFF334155),
                backgroundColor: Colors.white.withValues(alpha: 0.5),
                side: BorderSide(color: const Color(0xFFE2E8F0).withValues(alpha: 0.8)),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  InputDecoration _buildInputDecoration({
    required String hintText,
    required IconData prefixIcon,
  }) {
    return InputDecoration(
      hintText: hintText,
      hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
      prefixIcon: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12.0),
        child: Icon(prefixIcon, color: const Color(0xFF64748B), size: 18),
      ),
      prefixIconConstraints: const BoxConstraints(minWidth: 40, minHeight: 0),
      filled: true,
      fillColor: const Color(0xFFF8FAFC).withValues(alpha: 0.9),
      contentPadding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: Color(0xFFE2E8F0), width: 1.0),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: Color(0xFFE2E8F0), width: 1.0),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: widget.portalType == 'student' ? const Color(0xFF2563EB) : const Color(0xFF800000), width: 1.5),
      ),
      errorStyle: const TextStyle(fontSize: 9),
    );
  }
}
