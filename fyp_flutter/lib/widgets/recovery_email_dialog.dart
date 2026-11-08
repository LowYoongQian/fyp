import '../i18n/tr.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

const _blue = Color(0xFF2563EB);
const _badge = [Color(0xFF2563EB), Color(0xFF06B6D4), Color(0xFF8B5CF6)];

/// The first-sign-in prompt for a personal recovery email, then its 6-digit code. [request] sends the code, [verify] checks it;
/// both throw on failure and their message is shown in the dialog. The student can skip after a warning.
Future<void> showRecoveryEmailDialog(
  BuildContext context, {
  required Future<void> Function(String email) request,
  required Future<void> Function(String code) verify,
}) =>
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (_) => _RecoveryEmailDialog(request: request, verify: verify),
    );

/// The same rules as before the redesign: a well-formed personal address (never a school one), then exactly six digits.
String? recoveryEmailProblem(String email) {
  if (email.length > 254 ||
      email.split('@').first.length > 64 ||
      !RegExp(r"^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$").hasMatch(email)) {
    return 'Enter a valid email address.';
  }
  if (RegExp(r'@([^@]+\.)?school\.edu$').hasMatch(email)) return 'Use a personal email, not a school address.';
  return null;
}

class _RecoveryEmailDialog extends StatefulWidget {
  final Future<void> Function(String) request, verify;
  const _RecoveryEmailDialog({required this.request, required this.verify});

  @override
  State<_RecoveryEmailDialog> createState() => _RecoveryEmailDialogState();
}

class _RecoveryEmailDialogState extends State<_RecoveryEmailDialog> {
  final _email = TextEditingController();
  final _code = TextEditingController();
  String? _error;
  String _sentTo = '';
  bool _codeSent = false, _busy = false;

  @override
  void dispose() {
    _email.dispose();
    _code.dispose();
    super.dispose();
  }

  Future<void> _run(Future<void> Function() work) async {
    if (_busy) return;   // one request at a time, however fast the taps
    setState(() { _busy = true; _error = null; });
    try {
      await work();
    } catch (failure) {
      if (mounted) setState(() => _error = failure.toString().replaceAll('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _sendCode() => _run(() async {
        final email = _email.text.trim().toLowerCase();
        final problem = recoveryEmailProblem(email);
        if (problem != null) throw Exception(problem);
        await widget.request(email);
        if (mounted) setState(() { _codeSent = true; _sentTo = email; _code.clear(); });
      });

  Future<void> _verify() => _run(() async {
        final code = _code.text.trim();
        if (!RegExp(r'^\d{6}$').hasMatch(code)) throw Exception('Enter the 6-digit code.');
        await widget.verify(code);
        if (mounted) Navigator.pop(context);
      });

  Future<void> _resend() => _run(() async {
        await widget.request(_sentTo);
        if (mounted) {
          ScaffoldMessenger.maybeOf(context)?.showSnackBar(SnackBar(content: Text(tr('A new code is on its way.'))));
        }
      });

  Future<void> _skip() async {
    final leave = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (warning) => _SkipWarning(onChoice: (value) => Navigator.pop(warning, value)),
    );
    if (leave == true && mounted) Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final dark = theme.brightness == Brightness.dark;
    final primary = dark ? Colors.white : const Color(0xFF0F172A);
    final secondary = dark ? const Color(0xFFA0A0A0) : const Color(0xFF64748B);
    final field = dark ? const Color(0xFF2D2D2D) : const Color(0xFFF1F5F9);
    return Dialog(
      backgroundColor: dark ? const Color(0xFF222222) : Colors.white,
      surfaceTintColor: Colors.transparent,
      insetPadding: const EdgeInsets.symmetric(horizontal: 22, vertical: 24),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(22, 24, 22, 18),
        child: AnimatedSize(
          duration: const Duration(milliseconds: 220),
          curve: Curves.easeOutCubic,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 60,
                  height: 60,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: const LinearGradient(colors: _badge, begin: Alignment.topLeft, end: Alignment.bottomRight),
                    boxShadow: [BoxShadow(color: _blue.withValues(alpha: .3), blurRadius: 18, offset: const Offset(0, 8))],
                  ),
                  child: Icon(_codeSent ? Icons.mark_email_read_rounded : Icons.alternate_email_rounded, color: Colors.white, size: 28),
                ),
              ),
              const SizedBox(height: 14),
              _Steps(second: _codeSent, dark: dark),
              const SizedBox(height: 14),
              Text(tr(_codeSent ? 'Check your inbox' : 'Add a recovery email'), textAlign: TextAlign.center,
                  style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800, color: primary)),
              const SizedBox(height: 6),
              Text(
                _codeSent ? tr('Enter the 6-digit code we sent to {email}.', {'email': _sentTo}) : tr('Get password resets and notices here; you still sign in with your school email.'),
                textAlign: TextAlign.center,
                style: theme.textTheme.bodyMedium?.copyWith(color: secondary, height: 1.4),
              ),
              const SizedBox(height: 18),
              TextField(
                key: ValueKey(_codeSent),
                controller: _codeSent ? _code : _email,
                autofocus: true,
                enabled: !_busy,
                keyboardType: _codeSent ? TextInputType.number : TextInputType.emailAddress,
                autofillHints: _codeSent ? const [AutofillHints.oneTimeCode] : const [AutofillHints.email],
                textAlign: _codeSent ? TextAlign.center : TextAlign.start,
                maxLength: _codeSent ? 6 : null,
                inputFormatters: _codeSent ? [FilteringTextInputFormatter.digitsOnly] : null,
                onChanged: (_) { if (_error != null) setState(() => _error = null); },
                onSubmitted: (_) => _codeSent ? _verify() : _sendCode(),
                style: _codeSent
                    ? theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800, letterSpacing: 10, color: primary)
                    : theme.textTheme.bodyLarge?.copyWith(color: primary),
                decoration: InputDecoration(
                  counterText: '',
                  labelText: _codeSent ? 'Verification code' : 'Personal email',
                  hintText: _codeSent ? '000000' : 'yourname@example.com',
                  prefixIcon: _codeSent ? null : const Icon(Icons.mail_outline_rounded),
                  filled: true,
                  fillColor: field,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(16),
                    borderSide: BorderSide(color: _error != null ? const Color(0xFFDC2626) : Colors.transparent),
                  ),
                  focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: _blue, width: 1.6)),
                ),
              ),
              if (_error != null) ...[
                const SizedBox(height: 10),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    color: const Color(0xFFDC2626).withValues(alpha: dark ? .16 : .08),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.error_outline_rounded, size: 18, color: Color(0xFFDC2626)),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(tr(_error!), style: theme.textTheme.bodySmall?.copyWith(color: dark ? const Color(0xFFFCA5A5) : const Color(0xFFB91C1C), fontWeight: FontWeight.w600)),
                      ),
                    ],
                  ),
                ),
              ],
              if (!_codeSent) ...[
                const SizedBox(height: 12),
                Row(
                  children: [
                    Icon(Icons.verified_user_outlined, size: 16, color: secondary),
                    const SizedBox(width: 6),
                    Expanded(child: Text(tr('Only a verified address receives reset links.'), style: theme.textTheme.bodySmall?.copyWith(color: secondary))),
                  ],
                ),
              ],
              const SizedBox(height: 18),
              FilledButton(
                onPressed: _busy ? null : (_codeSent ? _verify : _sendCode),
                style: FilledButton.styleFrom(
                  backgroundColor: _blue,
                  foregroundColor: Colors.white,
                  disabledBackgroundColor: _blue.withValues(alpha: .55),
                  disabledForegroundColor: Colors.white,
                  minimumSize: const Size.fromHeight(50),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  textStyle: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
                ),
                child: _busy
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white))
                    : Text(tr(_codeSent ? 'Verify email' : 'Send code')),
              ),
              const SizedBox(height: 6),
              Wrap(
                alignment: WrapAlignment.center,
                children: [
                  if (_codeSent) ...[
                    TextButton(onPressed: _busy ? null : _resend, child: Text(tr('Resend code'))),
                    TextButton(onPressed: _busy ? null : () => setState(() { _codeSent = false; _error = null; }), child: Text(tr('Change email'))),
                  ],
                  TextButton(
                    onPressed: _busy ? null : _skip,
                    style: TextButton.styleFrom(foregroundColor: secondary),
                    child: Text(tr('Not now')),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Steps extends StatelessWidget {
  final bool second, dark;
  const _Steps({required this.second, required this.dark});

  @override
  Widget build(BuildContext context) {
    final off = dark ? const Color(0xFF333333) : const Color(0xFFE2E8F0);
    Widget dot(int number, String label, bool on, bool done) => Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 220),
              width: 22,
              height: 22,
              decoration: BoxDecoration(color: on ? _blue : off, shape: BoxShape.circle),
              child: Center(
                child: done
                    ? const Icon(Icons.check_rounded, size: 14, color: Colors.white)
                    : Text('$number', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: on ? Colors.white : const Color(0xFF94A3B8))),
              ),
            ),
            const SizedBox(width: 6),
            Text(tr(label), style: Theme.of(context).textTheme.labelMedium?.copyWith(fontWeight: FontWeight.w700, color: on ? _blue : const Color(0xFF94A3B8))),
          ],
        );
    return Semantics(
      label: second ? 'Step 2 of 2: enter the code' : 'Step 1 of 2: your email',
      excludeSemantics: true,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          dot(1, 'Email', true, second),
          Container(width: 34, height: 2, margin: const EdgeInsets.symmetric(horizontal: 8), color: second ? _blue : off),
          dot(2, 'Code', second, false),
        ],
      ),
    );
  }
}

class _SkipWarning extends StatelessWidget {
  final ValueChanged<bool> onChoice;
  const _SkipWarning({required this.onChoice});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final dark = theme.brightness == Brightness.dark;
    return Dialog(
      backgroundColor: dark ? const Color(0xFF222222) : Colors.white,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(26)),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(22, 24, 22, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 54,
                height: 54,
                decoration: BoxDecoration(color: const Color(0xFFF59E0B).withValues(alpha: dark ? .2 : .12), shape: BoxShape.circle),
                child: const Icon(Icons.warning_amber_rounded, color: Color(0xFFF59E0B), size: 28),
              ),
            ),
            const SizedBox(height: 12),
            Text(tr('Account recovery is not set'), textAlign: TextAlign.center,
                style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800, color: dark ? Colors.white : const Color(0xFF0F172A))),
            const SizedBox(height: 6),
            Text(tr('Without a verified personal email you cannot reset a lost password yourself.'), textAlign: TextAlign.center,
                style: theme.textTheme.bodyMedium?.copyWith(color: dark ? const Color(0xFFA0A0A0) : const Color(0xFF64748B), height: 1.4)),
            const SizedBox(height: 18),
            FilledButton(
              onPressed: () => onChoice(false),
              style: FilledButton.styleFrom(backgroundColor: _blue, foregroundColor: Colors.white, minimumSize: const Size.fromHeight(48), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
              child: Text(tr('Go back')),
            ),
            const SizedBox(height: 6),
            TextButton(
              onPressed: () => onChoice(true),
              style: TextButton.styleFrom(foregroundColor: const Color(0xFFDC2626), minimumSize: const Size.fromHeight(44)),
              child: Text(tr('Skip for now')),
            ),
          ],
        ),
      ),
    );
  }
}
