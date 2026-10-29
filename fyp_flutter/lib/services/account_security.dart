import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

class SecurityFailure implements Exception {
  final int status;
  final String message;
  SecurityFailure(this.status, this.message);
  @override
  String toString() => message;
}

class AccountSecurity {
  static final endedToken = ValueNotifier<String>('');
  static Future<dynamic> request(
    String base,
    String token,
    String path, {
    Map<String, dynamic>? body,
    String method = 'POST',
    http.Client? client,
  }) async {
    final headers = {
      'Content-Type': 'application/json',
      if (token.isNotEmpty) 'Authorization': 'Bearer $token',
    };
    final uri = Uri.parse('$base$path');
    final transport = client ?? http.Client();
    late http.Response response;
    try {
      response =
          await (method == 'GET'
                  ? transport.get(uri, headers: headers)
                  : method == 'PUT'
                  ? transport.put(uri, headers: headers, body: jsonEncode(body))
                  : method == 'DELETE'
                  ? transport.delete(
                      uri,
                      headers: headers,
                      body: jsonEncode(body),
                    )
                  : transport.post(
                      uri,
                      headers: headers,
                      body: jsonEncode(body),
                    ))
              .timeout(const Duration(seconds: 15));
    } finally {
      if (client == null) transport.close();
    }
    if (token.isNotEmpty && response.statusCode == 401) {
      endedToken.value = token;
    }
    dynamic data;
    try {
      data = jsonDecode(response.body);
    } on FormatException {
      throw SecurityFailure(
        response.statusCode,
        'The server response could not be read. Please retry.',
      );
    }
    if (response.statusCode != 200) {
      final message =
          (data is Map ? data['detail']?.toString() : null) ??
          'Could not verify. Please retry.';
      if (token.isNotEmpty &&
          (response.statusCode == 401 ||
              (response.statusCode == 403 &&
                  message.contains('suspended or inactive')))) {
        endedToken.value = token;
      }
      throw SecurityFailure(response.statusCode, message);
    }
    return data;
  }

  static Future<Map<String, dynamic>?> verifyLogin(
    BuildContext context,
    String base,
    String challenge,
  ) async {
    final controller = TextEditingController();
    String? error;
    bool busy = false;
    final result = await showDialog<Map<String, dynamic>>(
      context: context,
      barrierDismissible: false,
      builder: (dialog) => StatefulBuilder(
        builder: (context, update) => PopScope(
          canPop: !busy,
          child: AlertDialog(
            title: const Text('Verify your sign-in'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'Enter your authenticator code or a one-use recovery code.',
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: controller,
                  maxLength: 32,
                  autofillHints: const [AutofillHints.oneTimeCode],
                  decoration: const InputDecoration(
                    labelText: 'Verification code',
                  ),
                ),
                if (error != null)
                  Text(error!, style: const TextStyle(color: Colors.red)),
              ],
            ),
            actions: [
              TextButton(
                onPressed: busy ? null : () => Navigator.pop(dialog),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: busy
                    ? null
                    : () async {
                        update(() {
                          busy = true;
                          error = null;
                        });
                        try {
                          final data = await request(
                            base,
                            '',
                            '/auth/login/verify',
                            body: {
                              'challenge_token': challenge,
                              'code': controller.text.trim(),
                            },
                          );
                          if (dialog.mounted) {
                            Navigator.pop(
                              dialog,
                              Map<String, dynamic>.from(data),
                            );
                          }
                        } catch (failure) {
                          if (dialog.mounted) {
                            update(
                              () => error = failure.toString().replaceFirst(
                                'Exception: ',
                                '',
                              ),
                            );
                          }
                        } finally {
                          if (dialog.mounted) update(() => busy = false);
                        }
                      },
                child: Text(busy ? 'Verifying…' : 'Verify & sign in'),
              ),
            ],
          ),
        ),
      ),
    );
    // Dispose after route transition so the closing field cannot read a disposed controller.
    Future.delayed(const Duration(seconds: 1), controller.dispose);
    return result;
  }
}
