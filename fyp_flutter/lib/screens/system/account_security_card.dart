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
              codes != null
                  ? 'Save your recovery codes'
                  : action == 'setup'
                  ? 'Set up authenticator'
                  : action == 'logout-all'
                  ? 'Sign out all devices'
                  : 'Verify security change',
            ),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (codes != null) ...[
                    const Text(
                      'Shown only once. Save these outside the app; each code can be used once.',
                    ),
                    const SizedBox(height: 16),
                    SelectableText(
                      codes!.join('\n'),
                      style: const TextStyle(
                        fontFamily: 'monospace',
                        height: 1.8,
                      ),
                    ),
                    TextButton.icon(
                      icon: const Icon(Icons.copy),
                      label: const Text('Copy codes'),
                      onPressed: () async {
                        await Clipboard.setData(
                          ClipboardData(text: codes!.join('\n')),
                        );
                        if (dialog.mounted) {
                          ScaffoldMessenger.of(dialog).showSnackBar(
                            const SnackBar(
                              content: Text('Recovery codes copied.'),
                            ),
                          );
                        }
                      },
                    ),
                  ] else ...[
                    Text(
                      action == 'logout-all' || action == 'disable'
                          ? 'This ends all sessions, including this one.'
                          : 'Security changes require server verification.',
                    ),
                    const SizedBox(height: 16),
                    if (setup == null)
                      TextField(
                        controller: password,
                        obscureText: true,
                        maxLength: 255,
                        autofillHints: const [AutofillHints.password],
                        decoration: const InputDecoration(
                          labelText: 'Current password',
                        ),
                      ),
                    if (setup != null) ...[
                      const Text(
                        'In your authenticator, add a time-based account with this setup key:',
                      ),
                      const SizedBox(height: 12),
                      SelectableText(
                        setup!['secret'],
                        style: const TextStyle(fontFamily: 'monospace'),
                      ),
                      TextButton.icon(
                        onPressed: () => Clipboard.setData(
                          ClipboardData(text: setup!['secret']),
                        ),
                        icon: const Icon(Icons.copy),
                        label: const Text('Copy setup key'),
                      ),
                    ],
                    if (setup != null ||
                        ['disable', 'recovery-codes'].contains(action))
                      TextField(
                        controller: code,
                        maxLength: 32,
                        autofillHints: const [AutofillHints.oneTimeCode],
                        decoration: const InputDecoration(
                          labelText: 'Authenticator or recovery code',
                        ),
                      ),
                  ],
                  if (error != null)
                    Text(error!, style: const TextStyle(color: Colors.red)),
                ],
              ),
            ),
            actions: [
              if (codes == null)
                TextButton(
                  onPressed: busy ? null : () => Navigator.pop(dialog),
                  child: const Text('Cancel'),
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
                  codes != null
                      ? 'I saved my codes'
                      : busy
                      ? 'Verifying…'
                      : setup != null
                      ? 'Verify & enable'
                      : 'Continue',
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

  @override
  Widget build(BuildContext context) {
    final enabled = _profile?['two_factor_enabled'] == true;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.shield_outlined, color: Color(0xFF2563EB)),
                SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Account security',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            if (_error != null) ...[
              Text(_error!, style: const TextStyle(color: Colors.red)),
              TextButton(onPressed: _load, child: const Text('Retry')),
            ] else if (_profile == null)
              Semantics(
                label: 'Loading account security',
                child: ShimmerLoading(
                  isLoading: true,
                  child: Column(
                    children: [
                      for (var i = 0; i < 3; i++)
                        Container(
                          height: 32,
                          margin: const EdgeInsets.only(bottom: 12),
                          decoration: BoxDecoration(
                            color: Theme.of(
                              context,
                            ).colorScheme.surfaceContainerHighest,
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                    ],
                  ),
                ),
              )
            else ...[
              Text(
                'Two-factor authentication: ${enabled ? 'Enabled' : 'Disabled'}',
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  if (!enabled)
                    FilledButton.icon(
                      onPressed: () => _action('setup'),
                      icon: const Icon(Icons.key),
                      label: const Text('Set up 2FA'),
                    )
                  else ...[
                    OutlinedButton(
                      onPressed: () => _action('recovery-codes'),
                      child: const Text('Replace recovery codes'),
                    ),
                    TextButton(
                      onPressed: () => _action('disable'),
                      child: const Text('Disable 2FA'),
                    ),
                  ],
                ],
              ),
              const Divider(height: 32),
              const Text(
                'Signed-in devices',
                style: TextStyle(fontWeight: FontWeight.bold),
              ),
              for (final session in _sessions)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.devices),
                  title: Text(session['device_label']),
                  subtitle: Text(
                    DateTime.parse(
                      session['created_at'],
                    ).toLocal().toString().split('.').first,
                  ),
                  trailing: session['current'] == true
                      ? const Text('This device')
                      : null,
                ),
              TextButton(
                onPressed: () => _action('logout-all'),
                child: const Text('Sign out all devices'),
              ),
              const Divider(height: 32),
              const Text(
                'Mobile push notifications',
                style: TextStyle(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              ValueListenableBuilder<String>(
                valueListenable: MobilePush.status,
                builder: (_, value, child) => Text(value),
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Quiet hours'),
                subtitle: Text('Timezone: ${_profile!['push_timezone']}'),
                value: _quiet,
                onChanged: _savingQuiet
                    ? null
                    : (value) => setState(() => _quiet = value),
              ),
              if (_quiet)
                Wrap(
                  spacing: 8,
                  children: [
                    OutlinedButton(
                      onPressed: () => _quietTime(true),
                      child: Text('From ${_from.format(context)}'),
                    ),
                    OutlinedButton(
                      onPressed: () => _quietTime(false),
                      child: Text('Until ${_to.format(context)}'),
                    ),
                  ],
                ),
              const Text(
                'In-app updates remain available; expired class reminders will not be delivered late.',
                style: TextStyle(fontSize: 12),
              ),
              TextButton(
                onPressed: _savingQuiet || (_quiet && _from == _to)
                    ? null
                    : () async {
                        setState(() => _savingQuiet = true);
                        try {
                          await _request(
                            '/auth/me/settings',
                            method: 'PUT',
                            body: {
                              'push_quiet_enabled': _quiet,
                              'push_quiet_start':
                                  _from.hour * 60 + _from.minute,
                              'push_quiet_end': _to.hour * 60 + _to.minute,
                            },
                          );
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text('Quiet hours saved.'),
                              ),
                            );
                          }
                        } catch (failure) {
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text(failure.toString())),
                            );
                          }
                        } finally {
                          if (mounted) setState(() => _savingQuiet = false);
                        }
                      },
                child: Text(_savingQuiet ? 'Saving…' : 'Save quiet hours'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
