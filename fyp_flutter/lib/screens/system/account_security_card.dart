import '../../i18n/tr.dart';
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../services/account_security.dart';
import '../../services/mobile_push.dart';
import '../../widgets/shimmer_loading.dart';

class AccountSecurityCard extends StatefulWidget {
  final String authToken, apiBaseUrl;
  const AccountSecurityCard({
    super.key,
    required this.authToken,
    required this.apiBaseUrl,
  });
  @override
  State<AccountSecurityCard> createState() => _AccountSecurityCardState();
}

class _AccountSecurityCardState extends State<AccountSecurityCard> {
  Map<String, dynamic>? _profile;
  List<dynamic> _sessions = [];
  String? _error;
  bool _savingQuiet = false;
  bool _quiet = false;
  TimeOfDay _from = const TimeOfDay(hour: 22, minute: 0),
      _to = const TimeOfDay(hour: 7, minute: 0);
  Future<dynamic> _request(
    String path, {
    Map<String, dynamic>? body,
    String method = 'POST',
  }) => AccountSecurity.request(
    widget.apiBaseUrl,
    widget.authToken,
    path,
    body: body,
    method: method,
  );
  @override
  void initState() {
    super.initState();
    _load();
    unawaited(MobilePush.bind(widget.authToken, widget.apiBaseUrl));
  }

  Future<void> _load() async {
    try {
      final results = await Future.wait([
        _request('/auth/me', method: 'GET'),
        _request('/auth/sessions', method: 'GET'),
      ]);
      if (!mounted) return;
      final profile = Map<String, dynamic>.from(results[0]);
      int minute(String field, int fallback) =>
          profile[field] as int? ?? fallback;
      setState(() {
        _profile = profile;
        _sessions = results[1];
        _error = null;
        _quiet = profile['push_quiet_enabled'] == true;
        final from = minute('push_quiet_start', 1320),
            to = minute('push_quiet_end', 420);
        _from = TimeOfDay(hour: from ~/ 60, minute: from % 60);
        _to = TimeOfDay(hour: to ~/ 60, minute: to % 60);
      });
    } catch (failure) {
      if (mounted) setState(() => _error = failure.toString());
    }
  }

  Future<void> _action(String action) async {
    final password = TextEditingController(), code = TextEditingController();
    Map<String, dynamic>? setup;
    List<dynamic>? codes;
    String? error;
    bool busy = false;
    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (dialog) => StatefulBuilder(
        builder: (context, update) => PopScope(
          canPop: !busy && codes == null,
          child: AlertDialog(
            title: Text(
              tr(codes != null
                  ? 'Save your recovery codes'
                  : action == 'setup'
                  ? 'Set up authenticator'
                  : action == 'logout-all'
                  ? 'Sign out all devices'
                  : 'Verify security change'),
            ),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (codes != null) ...[
                    Text(
                      tr('Shown only once. Save these outside the app; each code can be used once.'),
                    ),
                    const SizedBox(height: 16),
                    SelectableText(
                      tr(codes!.join('\n')),
                      style: const TextStyle(
                        fontFamily: 'monospace',
                        height: 1.8,
                      ),
                    ),
                    TextButton.icon(
                      icon: const Icon(Icons.copy),
                      label: Text(tr('Copy codes')),
                      onPressed: () async {
                        await Clipboard.setData(
                          ClipboardData(text: codes!.join('\n')),
                        );
                        if (dialog.mounted) {
                          ScaffoldMessenger.of(dialog).showSnackBar(
                            SnackBar(
                              content: Text(tr('Recovery codes copied.')),
                            ),
                          );
                        }
                      },
                    ),
                  ] else ...[
                    Text(
                      tr(action == 'logout-all' || action == 'disable'
                          ? 'This ends all sessions, including this one.'
                          : 'Security changes require server verification.'),
                    ),
                    const SizedBox(height: 16),
                    if (setup == null)
                      TextField(
                        controller: password,
                        obscureText: true,
                        maxLength: 255,
                        autofillHints: const [AutofillHints.password],
                        decoration: InputDecoration(
                          labelText: tr('Current password'),
                        ),
                      ),
                    if (setup != null) ...[
                      Text(
                        tr('In your authenticator, add a time-based account with this setup key:'),
                      ),
                      const SizedBox(height: 12),
                      SelectableText(
                        tr(setup!['secret']),
                        style: const TextStyle(fontFamily: 'monospace'),
                      ),
                      TextButton.icon(
                        onPressed: () => Clipboard.setData(
                          ClipboardData(text: setup!['secret']),
                        ),
                        icon: const Icon(Icons.copy),
                        label: Text(tr('Copy setup key')),
                      ),
                    ],
                    if (setup != null ||
                        ['disable', 'recovery-codes'].contains(action))
                      TextField(
                        controller: code,
                        maxLength: 32,
                        autofillHints: const [AutofillHints.oneTimeCode],
                        decoration: InputDecoration(
                          labelText: tr('Authenticator or recovery code'),
                        ),
                      ),
                  ],
                  if (error != null)
                    Text(tr(error!), style: const TextStyle(color: Colors.red)),
                ],
              ),
            ),
            actions: [
              if (codes == null)
                TextButton(
                  onPressed: busy ? null : () => Navigator.pop(dialog),
                  child: Text(tr('Cancel')),
                ),
              FilledButton(
                onPressed: busy
                    ? null
                    : () async {
                        if (codes != null) {
                          Navigator.pop(dialog);
                          return;
                        }
                        update(() {
                          busy = true;
                          error = null;
                        });
                        try {
                          final result = await _request(
                            action == 'logout-all'
                                ? '/auth/logout-all'
                                : '/auth/2fa/${setup == null ? action : 'enable'}',
                            body: {
                              'current_password': password.text,
                              'code': code.text.trim(),
                            },
                          );
                          if (!dialog.mounted) return;
                          if (action == 'setup' && setup == null) {
                            update(() {
                              setup = Map<String, dynamic>.from(result);
                              password.clear();
                            });
                          } else if (action == 'disable' ||
                              action == 'logout-all') {
                            Navigator.pop(dialog);
                            AccountSecurity.endedToken.value = widget.authToken;
                          } else {
                            update(() {
                              codes = result['recovery_codes'];
                              setup = null;
                              password.clear();
                              code.clear();
                            });
                          }
                        } catch (failure) {
                          if (dialog.mounted) {
                            update(() => error = failure.toString());
                          }
                        } finally {
                          if (dialog.mounted) update(() => busy = false);
                        }
                      },
                child: Text(
                  tr(codes != null
                      ? 'I saved my codes'
                      : busy
                      ? 'Verifying…'
                      : setup != null
                      ? 'Verify & enable'
                      : 'Continue'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
    Future.delayed(const Duration(seconds: 1), () {
      password.dispose();
      code.dispose();
    });
    if (mounted) await _load();
  }

  Future<void> _quietTime(bool start) async {
    final selected = await showTimePicker(
      context: context,
      initialTime: start ? _from : _to,
    );
    if (selected != null && mounted) {
      setState(() {
        if (start) {
          _from = selected;
        } else {
          _to = selected;
        }
      });
    }
  }

  String _deviceTime(dynamic raw) {
    final at = DateTime.tryParse(raw?.toString() ?? '')?.toLocal();
    if (at == null) return '';
    return tr('Signed in {date}', {'date': '${dayMonth(at, year: true)}, ${at.hour.toString().padLeft(2, '0')}:${at.minute.toString().padLeft(2, '0')}'});
  }

  Future<void> _saveQuiet() async {
    setState(() => _savingQuiet = true);
    try {
      await _request(
        '/auth/me/settings',
        method: 'PUT',
        body: {
          'push_quiet_enabled': _quiet,
          'push_quiet_start': _from.hour * 60 + _from.minute,
          'push_quiet_end': _to.hour * 60 + _to.minute,
        },
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(tr('Quiet hours saved.'))));
      }
    } catch (failure) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(tr(failure.toString()))));
      }
    } finally {
      if (mounted) setState(() => _savingQuiet = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final dark = theme.brightness == Brightness.dark;
    final enabled = _profile?['two_factor_enabled'] == true;
    final primary = dark ? Colors.white : const Color(0xFF0F172A);
    final secondary = dark ? const Color(0xFFA0A0A0) : const Color(0xFF64748B);
    final tile = dark ? const Color(0xFF2D2D2D) : const Color(0xFFF8FAFC);
    final line = dark ? const Color(0xFF333333) : const Color(0xFFE2E8F0);
    const blue = Color(0xFF2563EB);

    Widget heading(IconData icon, Color tone, String title, {Widget? trailing}) => Row(
          children: [
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(color: tone.withValues(alpha: dark ? .2 : .1), borderRadius: BorderRadius.circular(10)),
              child: Icon(icon, size: 18, color: tone),
            ),
            const SizedBox(width: 10),
            Expanded(child: Text(tr(title), style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800, color: primary))),
            ?trailing,
          ],
        );
    Widget pill(String text, Color tone) => Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(color: tone.withValues(alpha: dark ? .2 : .12), borderRadius: BorderRadius.circular(20)),
          child: Text(tr(text), style: theme.textTheme.labelSmall?.copyWith(fontWeight: FontWeight.w800, color: tone)),
        );
    final buttonShape = RoundedRectangleBorder(borderRadius: BorderRadius.circular(14));

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: dark ? const Color(0xFF222222) : Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: line),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: dark ? .18 : .04), blurRadius: 18, offset: const Offset(0, 8))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          heading(Icons.shield_outlined, blue, 'Account security'),
          const SizedBox(height: 14),
          if (_error != null) ...[
            Text(tr(_error!), style: theme.textTheme.bodySmall?.copyWith(color: const Color(0xFFDC2626))),
            Align(alignment: Alignment.centerLeft, child: TextButton(onPressed: _load, child: Text(tr('Retry')))),
          ] else if (_profile == null)
            Semantics(
              label: tr('Loading account security'),
              child: ShimmerLoading(
                isLoading: true,
                child: Column(
                  children: [
                    for (var i = 0; i < 3; i++)
                      Container(
                        height: 32,
                        margin: const EdgeInsets.only(bottom: 12),
                        decoration: BoxDecoration(color: theme.colorScheme.surfaceContainerHighest, borderRadius: BorderRadius.circular(12)),
                      ),
                  ],
                ),
              ),
            )
          else ...[
            // Two-factor authentication: its state as a pill and its actions.
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(color: tile, borderRadius: BorderRadius.circular(16)),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(tr('Two-factor authentication'), style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700, color: primary)),
                            const SizedBox(height: 2),
                            Text(tr(enabled ? 'A code from your authenticator is needed to sign in.' : 'Add a code from an authenticator app at sign-in.'),
                                style: theme.textTheme.bodySmall?.copyWith(color: secondary)),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      pill(enabled ? 'Enabled' : 'Disabled', enabled ? const Color(0xFF10B981) : const Color(0xFFF59E0B)),
                    ],
                  ),
                  const SizedBox(height: 12),
                  if (!enabled)
                    FilledButton.icon(
                      onPressed: () => _action('setup'),
                      icon: const Icon(Icons.key_rounded, size: 18),
                      label: Text(tr('Set up 2FA')),
                      style: FilledButton.styleFrom(backgroundColor: blue, foregroundColor: Colors.white, minimumSize: const Size.fromHeight(46), shape: buttonShape),
                    )
                  else
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: () => _action('recovery-codes'),
                            style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(46), shape: buttonShape),
                            child: Text(tr('Replace recovery codes'), textAlign: TextAlign.center),
                          ),
                        ),
                        const SizedBox(width: 8),
                        TextButton(
                          onPressed: () => _action('disable'),
                          style: TextButton.styleFrom(foregroundColor: const Color(0xFFDC2626), minimumSize: const Size(48, 46)),
                          child: Text(tr('Disable 2FA')),
                        ),
                      ],
                    ),
                ],
              ),
            ),
            const SizedBox(height: 18),
            heading(Icons.devices_rounded, const Color(0xFF8B5CF6), 'Signed-in devices', trailing: pill('${_sessions.length}', const Color(0xFF8B5CF6))),
            const SizedBox(height: 10),
            for (final session in _sessions)
              Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  color: tile,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: session['current'] == true ? blue.withValues(alpha: .35) : Colors.transparent),
                ),
                child: Row(
                  children: [
                    Icon(
                      session['device_label']?.toString().toLowerCase().contains('mobile') == true ? Icons.smartphone_rounded : Icons.laptop_mac_rounded,
                      size: 20,
                      color: secondary,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('${session['device_label'] ?? 'Device'}', style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700, color: primary)),
                          Text(tr(_deviceTime(session['created_at'])), style: theme.textTheme.bodySmall?.copyWith(color: secondary)),
                        ],
                      ),
                    ),
                    if (session['current'] == true) pill('This device', blue),
                  ],
                ),
              ),
            OutlinedButton.icon(
              onPressed: () => _action('logout-all'),
              icon: const Icon(Icons.logout_rounded, size: 18),
              label: Text(tr('Sign out all devices')),
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFFDC2626),
                side: BorderSide(color: const Color(0xFFDC2626).withValues(alpha: .4)),
                minimumSize: const Size.fromHeight(46),
                shape: buttonShape,
              ),
            ),
            const SizedBox(height: 18),
            heading(Icons.notifications_active_outlined, const Color(0xFF06B6D4), 'Mobile push notifications'),
            const SizedBox(height: 8),
            ValueListenableBuilder<String>(
              valueListenable: MobilePush.status,
              builder: (_, value, child) => Text(tr(value), style: theme.textTheme.bodySmall?.copyWith(color: secondary, height: 1.4)),
            ),
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.fromLTRB(14, 6, 8, 12),
              decoration: BoxDecoration(color: tile, borderRadius: BorderRadius.circular(16)),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(tr('Quiet hours'), style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700, color: primary)),
                    subtitle: Text(tr('Timezone: {v}', {'v': _profile!['push_timezone']}), style: theme.textTheme.bodySmall?.copyWith(color: secondary)),
                    value: _quiet,
                    activeTrackColor: blue,
                    onChanged: _savingQuiet ? null : (value) => setState(() => _quiet = value),
                  ),
                  if (_quiet)
                    Padding(
                      padding: const EdgeInsets.only(right: 6, bottom: 8),
                      child: Row(
                        children: [
                          for (final start in [true, false]) ...[
                            if (!start) const SizedBox(width: 8),
                            Expanded(
                              child: OutlinedButton.icon(
                                onPressed: () => _quietTime(start),
                                icon: Icon(start ? Icons.bedtime_outlined : Icons.wb_sunny_outlined, size: 16),
                                // One line at any width: the label shrinks a little rather than wrapping.
                                label: FittedBox(fit: BoxFit.scaleDown, child: Text('${start ? 'From' : 'Until'} ${(start ? _from : _to).format(context)}', maxLines: 1)),
                                style: OutlinedButton.styleFrom(
                                  minimumSize: const Size.fromHeight(44),
                                  padding: const EdgeInsets.symmetric(horizontal: 10),
                                  shape: buttonShape,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: Text(tr('In-app updates still arrive; late class reminders are skipped.'), style: theme.textTheme.bodySmall?.copyWith(color: secondary)),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),
            FilledButton.tonal(
              onPressed: _savingQuiet || (_quiet && _from == _to) ? null : _saveQuiet,
              style: FilledButton.styleFrom(
                backgroundColor: dark ? const Color(0xFF2D2D2D) : blue.withValues(alpha: .1),   // grey in dark, never a navy block
                foregroundColor: dark ? const Color(0xFF93C5FD) : blue,
                minimumSize: const Size.fromHeight(46),
                shape: buttonShape,
              ),
              child: Text(tr(_savingQuiet ? 'Saving…' : 'Save quiet hours')),
            ),
          ],
        ],
      ),
    );
  }
}
