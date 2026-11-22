import 'dart:io';

import 'package:device_info_plus/device_info_plus.dart';

/// The phone's model for the "Signed-in devices" list, e.g. "Samsung SM-S918B (Android 14)" or "iPhone 16 Pro (iOS 18.1)".
/// Only the hardware model and system version are sent, never the user-set device name (it often contains a person's name).
class DeviceNameService {
  static String? _cached;

  static Future<String?> name() async {
    if (_cached != null) return _cached;
    try {
      final info = DeviceInfoPlugin();
      if (Platform.isAndroid) {
        final android = await info.androidInfo;
        _cached = '${describeAndroid(android.manufacturer, android.model)} (Android ${android.version.release})';
      } else if (Platform.isIOS) {
        final ios = await info.iosInfo;
        _cached = '${ios.modelName.isNotEmpty ? ios.modelName : ios.model} (iOS ${ios.systemVersion})';
      }
    } catch (_) {
      // No model available: the server falls back to "Mobile app".
    }
    return _cached;
  }

  /// "samsung" + "SM-S918B" -> "Samsung SM-S918B"; a model that already starts with its maker ("Pixel 8" by Google stays "Google Pixel 8").
  static String describeAndroid(String manufacturer, String model) {
    final maker = manufacturer.trim();
    final shown = model.trim();
    if (maker.isEmpty) return shown;
    final title = '${maker[0].toUpperCase()}${maker.substring(1)}';
    return shown.toLowerCase().startsWith(maker.toLowerCase()) ? shown : '$title $shown';
  }
}
