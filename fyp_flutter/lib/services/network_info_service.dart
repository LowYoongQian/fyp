// Network location info collector for attendance check-in.
//
// Gathers the device's current WiFi facts (SSID, BSSID, gateway IP, local IP)
// so the backend can corroborate that the student is on the campus network.
// The authoritative check is server-side (source IP); these are supporting
// signals only.
import 'package:flutter/foundation.dart';
import 'package:network_info_plus/network_info_plus.dart';
import 'package:permission_handler/permission_handler.dart';

class NetworkLocationInfo {
  final String? ssid;
  final String? bssid;
  final String? gatewayIp;
  final String? localIp;

  NetworkLocationInfo({this.ssid, this.bssid, this.gatewayIp, this.localIp});

  Map<String, dynamic> toPayload() => {
        'wifi_ssid': _clean(ssid) ?? '',
        'bssid': _clean(bssid),
        'gateway_ip': _clean(gatewayIp),
        'local_ip': _clean(localIp),
      };

  static String? _clean(String? v) {
    if (v == null) return null;
    // network_info_plus may return SSID wrapped in quotes, or placeholder MACs
    var s = v.replaceAll('"', '').trim();
    if (s.isEmpty || s == '<unknown ssid>' || s == '02:00:00:00:00:00') {
      return null;
    }
    return s;
  }
}

class NetworkInfoService {
  /// Collects WiFi network details. On Android 10+ reading SSID/BSSID requires
  /// location permission AND location services enabled, so we request it first.
  /// Every step is time-boxed so a stalled platform call can never freeze the
  /// attendance check-in flow.
  static Future<NetworkLocationInfo> collect() async {
    if (kIsWeb) return NetworkLocationInfo();
    try {
      return await _collect().timeout(
        const Duration(seconds: 8),
        onTimeout: () {
          debugPrint('NetworkInfoService.collect timed out; sending empty network facts.');
          return NetworkLocationInfo();
        },
      );
    } catch (e) {
      debugPrint('NetworkInfoService.collect failed: $e');
      return NetworkLocationInfo();
    }
  }

  static Future<NetworkLocationInfo> _collect() async {
    if (kIsWeb) return NetworkLocationInfo();
    final info = NetworkInfo();
    // SSID/BSSID need location permission on modern Android.
    try {
      final status = await Permission.locationWhenInUse.status;
      if (!status.isGranted) {
        await Permission.locationWhenInUse
            .request()
            .timeout(const Duration(seconds: 4), onTimeout: () => status);
      }
    } catch (_) {}

    String? ssid;
    String? bssid;
    String? gateway;
    String? localIp;

    Future<String?> safe(Future<String?> Function() f) async {
      try {
        return await f().timeout(const Duration(seconds: 2));
      } catch (_) {
        return null;
      }
    }

    ssid = await safe(info.getWifiName);
    bssid = await safe(info.getWifiBSSID);
    gateway = await safe(info.getWifiGatewayIP);
    localIp = await safe(info.getWifiIP);

    return NetworkLocationInfo(
      ssid: ssid,
      bssid: bssid,
      gatewayIp: gateway,
      localIp: localIp,
    );
  }
}
