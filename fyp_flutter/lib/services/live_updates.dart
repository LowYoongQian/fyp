import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/widgets.dart';

/// Authorised refresh hints only; every data read still goes through the API.
class LiveUpdates with WidgetsBindingObserver {
  final String baseUrl;
  final String token;
  final Future<void> Function(Set<String>) onTopics;
  WebSocket? _socket;
  Timer? _retry;
  Timer? _watchdog;
  Timer? _batch;
  final Set<String> _pending = {};
  bool connected = false;
  bool foreground = true;
  bool _disposed = false;
  bool _updating = false;
  int _generation = 0;
  int _delay = 1;

  LiveUpdates({
    required this.baseUrl,
    required this.token,
    required this.onTopics,
  }) {
    WidgetsBinding.instance.addObserver(this);
    unawaited(_connect());
  }

  Future<void> _connect() async {
    if (_disposed || !foreground) return;
    final version = ++_generation;
    try {
      final api = Uri.parse('${baseUrl.replaceFirst(RegExp(r'/$'), '')}/live');
      final socket = await WebSocket.connect(
        api.replace(scheme: api.scheme == 'https' ? 'wss' : 'ws').toString(),
      ).timeout(const Duration(seconds: 10));
      if (_disposed || !foreground || version != _generation) {
        await socket.close();
        return;
      }
      _socket = socket;
      socket.add(jsonEncode({'token': token}));
      _armWatchdog(socket);
      socket.listen(
        (raw) {
          if (_disposed || version != _generation) return;
          _armWatchdog(socket);
          try {
            final message = jsonDecode(raw as String) as Map<String, dynamic>;
            if (message['type'] != 'ready' && message['type'] != 'invalidate') {
              return;
            }
            connected = true;
            _delay = 1;
            _pending.addAll((message['topics'] as List).cast<String>());
            _batch ??= Timer(const Duration(milliseconds: 80), () {
              _batch = null;
              unawaited(_drain());
            });
          } catch (_) {
            /* Invalid messages are not trusted as data. */
          }
        },
        onDone: () => _disconnected(version),
        onError: (_) => _disconnected(version),
        cancelOnError: true,
      );
    } catch (_) {
      _disconnected(version);
    }
  }

  void _armWatchdog(WebSocket socket) {
    _watchdog?.cancel();
    _watchdog = Timer(const Duration(seconds: 45), () => socket.close());
  }

  void _disconnected(int version) {
    if (version != _generation || _disposed) return;
    connected = false;
    _watchdog?.cancel();
    _socket?.close();
    _socket = null;
    _retry?.cancel();
    if (foreground) {
      _retry = Timer(Duration(seconds: _delay), () => unawaited(_connect()));
      _delay = (_delay * 2).clamp(1, 30);
    }
  }

  Future<void> _drain() async {
    if (_updating || _disposed || !foreground) return;
    _updating = true;
    try {
      while (_pending.isNotEmpty && !_disposed && foreground) {
        final topics = Set<String>.from(_pending);
        _pending.clear();
        try {
          await onTopics(topics);
        } catch (_) {
          /* Polling retries failed reads. */
        }
      }
    } finally {
      _updating = false;
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    foreground = state == AppLifecycleState.resumed;
    _generation++;
    connected = false;
    _retry?.cancel();
    _watchdog?.cancel();
    _socket?.close();
    _socket = null;
    if (foreground) unawaited(_connect());
  }

  void dispose() {
    _disposed = true;
    _generation++;
    connected = false;
    _retry?.cancel();
    _watchdog?.cancel();
    _batch?.cancel();
    _pending.clear();
    _socket?.close();
    WidgetsBinding.instance.removeObserver(this);
  }
}
