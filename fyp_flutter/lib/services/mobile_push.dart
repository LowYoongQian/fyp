import 'dart:async';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'account_security.dart';

class MobilePush {
  static final status = ValueNotifier<String>('Mobile push is not configured.');
  static String _token = '', _base = '', _device = '';
  static int _generation = 0;
  static bool _ready = false;
  static StreamSubscription<String>? _refresh;
  static void Function(List<Map<String, dynamic>>, String)? onOpen;
  static String? _pendingNotice;

  static Future<void> initialize() async {
    if (kIsWeb ||
        (defaultTargetPlatform != TargetPlatform.android &&
            defaultTargetPlatform != TargetPlatform.iOS)) {
      return;
    }
    try {
      // Use native Firebase config, or public app options supplied at build time.
      const appId = String.fromEnvironment('FIREBASE_APP_ID');
      await Firebase.initializeApp(
        options: appId.isEmpty
            ? null
            : const FirebaseOptions(
                apiKey: String.fromEnvironment('FIREBASE_API_KEY'),
                appId: appId,
                messagingSenderId: String.fromEnvironment('FIREBASE_SENDER_ID'),
                projectId: String.fromEnvironment('FIREBASE_PROJECT_ID'),
                iosBundleId: String.fromEnvironment('FIREBASE_IOS_BUNDLE_ID'),
              ),
      );
      _ready = true;
      status.value = 'Sign in to enable mobile alerts.';
      // Foreground updates stay in-app; avoid displaying duplicate system alerts.
      await FirebaseMessaging.instance
          .setForegroundNotificationPresentationOptions(
            alert: false,
            badge: false,
            sound: false,
          );
      FirebaseMessaging.onMessageOpenedApp.listen(_open);
      FirebaseMessaging.onMessage.listen((message) {
        if (_token.isNotEmpty) status.value = 'Mobile push connected.';
      });
      final initial = await FirebaseMessaging.instance.getInitialMessage();
      if (initial != null) {
        _pendingNotice = initial.data['notification_id']?.toString();
      }
    } catch (_) {
      status.value =
          'Mobile push needs Firebase configuration; in-app updates still work.';
    }
  }

  static Future<void> bind(String token, String base) async {
    if (!_ready || token.isEmpty) return;
    final generation = ++_generation;
    _token = token;
    _base = base;
    await _refresh?.cancel();
    try {
      final profile = await AccountSecurity.request(
        base,
        token,
        '/auth/me',
        method: 'GET',
      );
      if (generation != _generation) return;
      if (profile['push_notifications'] != true ||
          profile['notifications_enabled'] != true) {
        status.value = 'Mobile alerts are disabled in your preferences.';
        return;
      }
      final permission = await FirebaseMessaging.instance.requestPermission();
      if (generation != _generation) return;
      if (permission.authorizationStatus != AuthorizationStatus.authorized &&
          permission.authorizationStatus != AuthorizationStatus.provisional) {
        status.value =
            'Allow notifications in phone settings to receive alerts.';
        return;
      }
      String? device;
      for (
        var attempt = 0;
        attempt < 3 && generation == _generation;
        attempt++
      ) {
        if (defaultTargetPlatform != TargetPlatform.iOS ||
            await FirebaseMessaging.instance.getAPNSToken() != null) {
          device = await FirebaseMessaging.instance.getToken();
          if (device != null) break;
        }
        await Future<void>.delayed(Duration(seconds: attempt + 1));
      }
      if (generation != _generation) return;
      if (device == null) {
        status.value =
            'Could not register mobile alerts; reopen Settings to retry.';
        return;
      }
      await _register(device, generation);
      if (generation != _generation) return;
      _refresh = FirebaseMessaging.instance.onTokenRefresh.listen(
        (next) => unawaited(_register(next, generation)),
      );
      if (_pendingNotice != null) {
        final id = _pendingNotice!;
        _pendingNotice = null;
        unawaited(_openId(id));
      }
    } catch (_) {
      if (generation == _generation) {
        status.value =
            'Could not connect mobile alerts; reopen Settings to retry.';
      }
    }
  }

  static Future<void> _register(String device, int generation) async {
    if (generation != _generation) return;
    try {
      final previous = _device;
      final result = await AccountSecurity.request(
        _base,
        _token,
        '/auth/push/device',
        body: {
          'token': device,
          'platform': defaultTargetPlatform == TargetPlatform.iOS
              ? 'ios'
              : 'android',
        },
      );
      if (generation != _generation) return;
      _device = device;
      status.value = result['delivery_configured'] == true
          ? 'Mobile push connected.'
          : 'Device registered; server push credentials are not configured.';
      if (previous.isNotEmpty && previous != device) {
        await AccountSecurity.request(
          _base,
          _token,
          '/auth/push/device',
          method: 'DELETE',
          body: {
            'token': previous,
            'platform': defaultTargetPlatform == TargetPlatform.iOS
                ? 'ios'
                : 'android',
          },
        );
      }
    } catch (_) {
      if (generation == _generation) {
        status.value = 'Mobile registration failed; reopen Settings to retry.';
      }
    }
  }

  static Future<void> unbind(String token) async {
    if (token != _token) return;
    final device = _device, base = _base;
    ++_generation;
    _token = '';
    _device = '';
    await _refresh?.cancel();
    _refresh = null;
    status.value = 'Signed out; mobile alerts are disabled.';
    if (device.isNotEmpty) {
      try {
        await AccountSecurity.request(
          base,
          token,
          '/auth/push/device',
          method: 'DELETE',
          body: {
            'token': device,
            'platform': defaultTargetPlatform == TargetPlatform.iOS
                ? 'ios'
                : 'android',
          },
        );
      } catch (_) {
        /* Session revocation also disables the device. */
      }
    }
  }

  static void _open(RemoteMessage message) {
    final id = message.data['notification_id']?.toString();
    if (id == null) return;
    if (_token.isEmpty) {
      _pendingNotice = id;
    } else {
      unawaited(_openId(id));
    }
  }

  static Future<void> _openId(String id) async {
    final token = _token;
    try {
      final data =
          await AccountSecurity.request(
                _base,
                token,
                '/notifications',
                method: 'GET',
              )
              as List;
      // Old-account notifications must never open inside a new account's session.
      if (token != _token || !data.any((row) => row['id']?.toString() == id)) {
        return;
      }
      onOpen?.call(
        data.map((row) => Map<String, dynamic>.from(row)).toList(),
        token,
      );
    } catch (_) {
      status.value = 'Sign in to securely view your notification.';
    }
  }
}
