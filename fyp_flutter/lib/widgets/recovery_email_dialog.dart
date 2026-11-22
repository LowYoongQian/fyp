import 'dart:async';
import 'dart:io';

import '../i18n/tr.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;

const _blue = Color(0xFF2563EB);
const _codeLength = 6;
const _resendSeconds = 60;   // the server's pause between codes (RECOVERY_RESEND_SECONDS)
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
  final _codeFocus = FocusNode();
  String? _error;
  String _sentTo = '';
  String _refused = '';   // the last code the server rejected; it is not sent again until a digit changes
  bool _codeSent = false, _busy = false;
  int _waitLeft = 0;   // seconds until another code may be asked for
  Timer? _tick;

  @override
  void dispose() {
    _tick?.cancel();
    _email.dispose();
    _code.dispose();
    _codeFocus.dispose();
    super.dispose();
  }

  void _startWait() {
    _waitLeft = _resendSeconds;
    _tick?.cancel();
    _tick = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return timer.cancel();
      setState(() => _waitLeft--);
      if (_waitLeft <= 0) timer.cancel();
    });
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
        if (mounted) {
          setState(() { _codeSent = true; _sentTo = email; _code.clear(); _refused = ''; });
          _startWait();
        }
      });

  /// One request at a time, whether the sixth digit, Enter or the button finished the code; a refused code waits for a change.
  Future<void> _verify() async {
    final code = _code.text;
    if (_busy || code.length != _codeLength || code == _refused) return;
    setState(() { _busy = true; _error = null; });
    try {
      await widget.verify(code);
      if (mounted) Navigator.pop(context);
    } catch (failure) {
      if (!mounted) return;
      // A wrong or expired code is refused by the server; a lost connection can be retried with the same digits.
      final network = failure is TimeoutException || failure is SocketException || failure is http.ClientException;
      setState(() { _error = failure.toString().replaceAll('Exception: ', ''); if (!network) _refused = code; });
      _code.selection = TextSelection(baseOffset: 0, extentOffset: code.length);
      _codeFocus.requestFocus();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _codeChanged(String code) {
    setState(() { if (code != _refused) _error = null; });
    if (code.length == _codeLength) _verify();
  }

  Future<void> _resend() => _run(() async {
        await widget.request(_sentTo);
        if (mounted) {
          setState(() { _code.clear(); _refused = ''; });
          _startWait();
          _codeFocus.requestFocus();
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
              Text(tr(_codeSent ? 'Check your email' : 'Add a recovery email'), textAlign: TextAlign.center,
                  style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800, color: primary)),
              const SizedBox(height: 6),
              Text(
                _codeSent ? tr('Enter the 6-digit code we sent to {email}.', {'email': _sentTo}) : tr('Get password resets and notices here; you still sign in with your school email.'),
                textAlign: TextAlign.center,
                style: theme.textTheme.bodyMedium?.copyWith(color: secondary, height: 1.4),
              ),
              const SizedBox(height: 18),
              if (_codeSent) ...[
                _CodeBoxes(
                  controller: _code,
                  focus: _codeFocus,
                  enabled: !_busy,
                  invalid: _error != null && _code.text == _refused,
                  onChanged: _codeChanged,
                  onSubmitted: _verify,
                ),
                const SizedBox(height: 6),
                Center(
                  child: TextButton(
                    onPressed: _busy || _waitLeft > 0 ? null : _resend,
                    child: Text(_waitLeft > 0 ? tr('Resend code in {seconds}s', {'seconds': _waitLeft}) : tr('Resend code')),
                  ),
                ),
              ] else
                TextField(
                  controller: _email,
                  autofocus: true,
                  enabled: !_busy,
                  keyboardType: TextInputType.emailAddress,
                  autofillHints: const [AutofillHints.email],
                  onChanged: (_) { if (_error != null) setState(() => _error = null); },
                  onSubmitted: (_) => _sendCode(),
                  style: theme.textTheme.bodyLarge?.copyWith(color: primary),
                  decoration: InputDecoration(
                    labelText: 'Personal email',
                    hintText: 'yourname@example.com',
                    prefixIcon: const Icon(Icons.mail_outline_rounded),
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
                onPressed: _busy || (_codeSent && (_code.text.length != _codeLength || _code.text == _refused)) ? null : (_codeSent ? _verify : _sendCode),
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
                    ? Row(mainAxisSize: MainAxisSize.min, children: [
                        const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white)),
                        if (_codeSent) ...[const SizedBox(width: 10), Text(tr('Verifying…'))],
                      ])
                    : Text(tr(_codeSent ? 'Verify email' : 'Send code')),
              ),
              const SizedBox(height: 6),
              Wrap(
                alignment: WrapAlignment.center,
                children: [
                  if (_codeSent)
                    TextButton(onPressed: _busy ? null : () => setState(() { _codeSent = false; _error = null; }), child: Text(tr('Change email'))),
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

/// Six code boxes drawn over ONE real text field, so the numeric keyboard, one-time-code autofill, paste, Backspace and screen readers all
/// work as in a normal field. Tapping a filled box selects its digit (typing replaces it); an empty box puts the caret at the end.
class _CodeBoxes extends StatefulWidget {
  final TextEditingController controller;
  final FocusNode focus;
  final bool enabled, invalid;
  final ValueChanged<String> onChanged;
  final VoidCallback onSubmitted;
  const _CodeBoxes({required this.controller, required this.focus, required this.enabled, required this.invalid, required this.onChanged, required this.onSubmitted});

  @override
  State<_CodeBoxes> createState() => _CodeBoxesState();
}

class _CodeBoxesState extends State<_CodeBoxes> {
  void _redraw() { if (mounted) setState(() {}); }

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_redraw);
    widget.focus.addListener(_redraw);
  }

  @override
  void dispose() {
    widget.controller.removeListener(_redraw);
    widget.focus.removeListener(_redraw);
    super.dispose();
  }

  void _tapBox(Offset at, double width) {
    if (!widget.enabled) return;
    final text = widget.controller.text;
    final cell = (at.dx / (width / _codeLength)).floor().clamp(0, _codeLength - 1);
    widget.controller.selection = cell < text.length
        ? TextSelection(baseOffset: cell, extentOffset: cell + 1)
        : TextSelection.collapsed(offset: text.length);
    widget.focus.requestFocus();
    SystemChannels.textInput.invokeMethod<void>('TextInput.show');
  }

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final text = widget.controller.text;
    final selection = widget.controller.selection;
    final focused = widget.focus.hasFocus && widget.enabled;
    bool active(int index) {
      if (!focused || !selection.isValid) return false;
      return selection.isCollapsed ? index == selection.start.clamp(0, _codeLength - 1) : index >= selection.start && index < selection.end;
    }

    return LayoutBuilder(
      builder: (context, constraints) => Stack(
        children: [
          Positioned.fill(
            child: Opacity(
              opacity: 0,
              alwaysIncludeSemantics: true,   // the invisible field is still what screen readers announce and type into
              child: TextField(
                controller: widget.controller,
                focusNode: widget.focus,
                enabled: widget.enabled,
                autofocus: true,
                keyboardType: TextInputType.number,
                autofillHints: const [AutofillHints.oneTimeCode],
                inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(_codeLength)],
                showCursor: false,
                enableInteractiveSelection: false,
                onChanged: widget.onChanged,
                onSubmitted: (_) => widget.onSubmitted(),
                decoration: const InputDecoration(border: InputBorder.none, counterText: '', labelText: 'Verification code'),
              ),
            ),
          ),
          GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTapDown: (details) => _tapBox(details.localPosition, constraints.maxWidth),
            child: ExcludeSemantics(
              child: Row(
                children: List.generate(_codeLength, (index) {
                  final digit = index < text.length ? text[index] : '';
                  final on = active(index);
                  final border = widget.invalid
                      ? const Color(0xFFDC2626)
                      : on
                          ? _blue
                          : (dark ? const Color(0xFF3A3A3A) : const Color(0xFFCBD5E1));
                  return Expanded(
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 140),
                      height: 54,
                      margin: EdgeInsets.only(left: index == 0 ? 0 : 7),
                      decoration: BoxDecoration(
                        color: on && !selection.isCollapsed
                            ? _blue.withValues(alpha: dark ? .22 : .08)
                            : (dark ? const Color(0xFF2D2D2D) : Colors.white),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: border, width: on || widget.invalid ? 2 : 1.2),
                        boxShadow: on ? [BoxShadow(color: _blue.withValues(alpha: .18), blurRadius: 8)] : null,
                      ),
                      alignment: Alignment.center,
                      child: digit.isNotEmpty
                          ? Text(digit, style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: dark ? Colors.white : const Color(0xFF0F172A)))
                          : on
                              ? Container(width: 2, height: 22, color: _blue)
                              : Container(width: 6, height: 6, decoration: BoxDecoration(color: dark ? const Color(0xFF4B5563) : const Color(0xFFCBD5E1), shape: BoxShape.circle)),
                    ),
                  );
                }),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
