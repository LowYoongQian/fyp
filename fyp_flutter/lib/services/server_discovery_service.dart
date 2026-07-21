import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:network_info_plus/network_info_plus.dart';
import '../config/app_config.dart';

class ServerDiscoveryService {
  /// Resolves the default configured port dynamically from the AppConfig API Base URL.
  static int get _configuredPort {
    try {
      final uri = Uri.parse(AppConfig.apiBaseUrl);
      return uri.port != 0 ? uri.port : 8000;
    } catch (_) {
      return 8000;
    }
  }

  /// Scans common default URLs (localhost, emulator gateway, local IP gateway)
  /// and probes all hosts in the local WiFi subnet on the configured port.
  /// Returns the first URL that responds successfully to `/auth/server-time`.
  static Future<String?> discoverServer() async {
    final int port = _configuredPort;
    final List<String> primaryCandidates = [
      'http://localhost:$port',
      'http://10.0.2.2:$port',
    ];

    // 1. Try primary candidates (localhost & emulator loopback)
    for (final url in primaryCandidates) {
      if (await checkUrl(url)) {
        debugPrint("Server auto-discovered at primary URL: $url");
        return url;
      }
    }

    // 2. Try gateway from network_info_plus (if available)
    try {
      final info = NetworkInfo();
      final gatewayIp = await info.getWifiGatewayIP();
      if (gatewayIp != null && gatewayIp.isNotEmpty) {
        final gatewayUrl = 'http://$gatewayIp:$port';
        if (await checkUrl(gatewayUrl)) {
          debugPrint("Server auto-discovered at gateway URL: $gatewayUrl");
          return gatewayUrl;
        }
      }
    } catch (_) {}

    // 3. Scan local subnets from NetworkInterface (no permissions required!)
    final subnets = await getLocalSubnets();
    if (subnets.isEmpty) {
      debugPrint("No local private IPv4 subnets found.");
      return null;
    }

    debugPrint("Found local subnets for scanning: $subnets");
    for (final subnet in subnets) {
      debugPrint("Scanning subnet $subnet.* on port $port...");
      
      // Probe the gateway/first IP first (.1) since it's very common
      final firstIpUrl = 'http://$subnet.1:$port';
      if (await checkUrl(firstIpUrl)) {
        debugPrint("Server auto-discovered at subnet gateway: $firstIpUrl");
        return firstIpUrl;
      }

      // Scan the rest of the IPs concurrently
      final List<Future<String?>> scanTasks = [];
      for (int i = 2; i <= 254; i++) {
        scanTasks.add(_checkUrlAsync('http://$subnet.$i:$port'));
      }

      final results = await Future.wait(scanTasks);
      for (final res in results) {
        if (res != null) {
          debugPrint("Server auto-discovered on subnet: $res");
          return res;
        }
      }
    }

    debugPrint("Server discovery completed: No active backend found.");
    return null;
  }

  /// Lists all unique private IPv4 subnets on this device using standard socket APIs (no permissions needed).
  static Future<List<String>> getLocalSubnets() async {
    final List<String> subnets = [];
    try {
      final interfaces = await NetworkInterface.list(
        includeLinkLocal: false,
        type: InternetAddressType.IPv4,
      );
      for (final interface in interfaces) {
        for (final address in interface.addresses) {
          if (!address.isLoopback) {
            final ip = address.address;
            final parts = ip.split('.');
            if (parts.length == 4) {
              final first = int.tryParse(parts[0]);
              final second = int.tryParse(parts[1]);
              // Identify private LAN ranges: 192.168.x.x, 10.x.x.x, 172.16.x.x - 172.31.x.x
              if (first == 192 && second == 168 ||
                  first == 10 ||
                  (first == 172 && second != null && second >= 16 && second <= 31)) {
                final subnet = '${parts[0]}.${parts[1]}.${parts[2]}';
                if (!subnets.contains(subnet)) {
                  subnets.add(subnet);
                }
              }
            }
          }
        }
      }
    } catch (e) {
      debugPrint("Failed to list network interfaces: $e");
    }
    return subnets;
  }

  /// Verifies if a given server URL is responding correctly
  static Future<bool> checkUrl(String url) async {
    try {
      final res = await http.get(Uri.parse('$url/auth/server-time'))
          .timeout(const Duration(milliseconds: 600));
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        if (data is Map && data.containsKey('server_time')) {
          return true;
        }
      }
    } catch (_) {}
    return false;
  }

  static Future<String?> _checkUrlAsync(String url) async {
    try {
      final res = await http.get(Uri.parse('$url/auth/server-time'))
          .timeout(const Duration(milliseconds: 800));
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        if (data is Map && data.containsKey('server_time')) {
          return url;
        }
      }
    } catch (_) {}
    return null;
  }
}
