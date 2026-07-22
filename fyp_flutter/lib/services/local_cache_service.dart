import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:path/path.dart' as p;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sqflite/sqflite.dart';

// ---------------------------------------------------------------------------
// LocalCacheService
//
// Two responsibilities:
//   1. Attendance history cache — stores records fetched from the server so
//      the student dashboard can render offline without a network call.
//   2. Pending check-in queue — when a check-in POST fails because the server
//      is unreachable, the payload is queued here.  Call syncPendingCheckIns()
//      once connectivity is restored; it replays each queued item and removes
//      successfully submitted entries.
//
// Device identity:
//   getOrCreateDeviceId() generates a stable UUID-like fingerprint on first
//   call and persists it in SharedPreferences.  This value is sent as
//   `device_id` in the login request for multi-device session binding.
// ---------------------------------------------------------------------------

class LocalCacheService {
  static Database? _db;

  static Future<Database> _open() async {
    if (_db != null) return _db!;
    final dbPath = p.join(await getDatabasesPath(), 'attendance_cache.db');
    _db = await openDatabase(
      dbPath,
      version: 1,
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE attendance_cache (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            course_code   TEXT NOT NULL,
            course_name   TEXT NOT NULL,
            class_group   TEXT,
            status        TEXT NOT NULL,
            marked_at     TEXT NOT NULL,
            network_verified INTEGER,
            liveness_passed  INTEGER
          )
        ''');
        await db.execute('''
          CREATE TABLE pending_checkins (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id    INTEGER NOT NULL,
            payload_json  TEXT NOT NULL,
            queued_at     TEXT NOT NULL
          )
        ''');
      },
    );
    return _db!;
  }

  // ── Attendance history cache ──────────────────────────────────────────────

  static Future<void> saveAttendanceCache(List<Map<String, dynamic>> records) async {
    if (kIsWeb) return;
    final db = await _open();
    await db.delete('attendance_cache');
    for (final r in records) {
      await db.insert('attendance_cache', {
        'course_code':      r['course_code'] ?? '',
        'course_name':      r['course_name'] ?? '',
        'class_group':      r['class_group'] ?? '',
        'status':           r['status'] ?? 'present',
        'marked_at':        r['marked_at'] ?? '',
        'network_verified': (r['network_verified'] == true) ? 1 : 0,
        'liveness_passed':  (r['liveness_passed'] == true) ? 1 : 0,
      });
    }
  }

  static Future<List<Map<String, dynamic>>> loadAttendanceCache() async {
    if (kIsWeb) return [];
    final db = await _open();
    final rows = await db.query('attendance_cache', orderBy: 'marked_at DESC');
    return rows.map((r) => {
      'course_code':      r['course_code'],
      'course_name':      r['course_name'],
      'class_group':      r['class_group'],
      'status':           r['status'],
      'marked_at':        r['marked_at'],
      'network_verified': r['network_verified'] == 1,
      'liveness_passed':  r['liveness_passed'] == 1,
    }).toList();
  }

  // ── Pending check-in queue ────────────────────────────────────────────────

  static Future<void> enqueueCheckIn(int sessionId, Map<String, dynamic> payload) async {
    if (kIsWeb) return;
    final db = await _open();
    await db.insert('pending_checkins', {
      'session_id':   sessionId,
      'payload_json': jsonEncode(payload),
      'queued_at':    DateTime.now().toIso8601String(),
    });
  }

  /// Replay all queued check-ins.  [submitFn] receives (sessionId, payload)
  /// and should return true on success, false on failure (network still down).
  /// Successfully submitted items are removed; failed ones stay for the next
  /// sync attempt.
  static Future<int> syncPendingCheckIns(
    Future<bool> Function(int sessionId, Map<String, dynamic> payload) submitFn,
  ) async {
    if (kIsWeb) return 0;
    final db = await _open();
    final pending = await db.query('pending_checkins', orderBy: 'queued_at ASC');
    int synced = 0;
    for (final row in pending) {
      final sessionId = row['session_id'] as int;
      final payload   = jsonDecode(row['payload_json'] as String) as Map<String, dynamic>;
      final ok = await submitFn(sessionId, payload);
      if (ok) {
        await db.delete('pending_checkins', where: 'id = ?', whereArgs: [row['id']]);
        synced++;
      }
    }
    return synced;
  }

  static Future<int> pendingCount() async {
    if (kIsWeb) return 0;
    final db = await _open();
    final result = await db.rawQuery('SELECT COUNT(*) as c FROM pending_checkins');
    return (result.first['c'] as int?) ?? 0;
  }

  // ── Device identity ───────────────────────────────────────────────────────

  static Future<String> getOrCreateDeviceId() async {
    final prefs = await SharedPreferences.getInstance();
    const key = 'device_id';
    final existing = prefs.getString(key);
    if (existing != null && existing.isNotEmpty) return existing;

    // Generate a simple UUID-like fingerprint without external packages.
    final bytes = List<int>.generate(16, (i) {
      // Mix timestamp + index for uniqueness; not cryptographic but stable.
      final t = DateTime.now().microsecondsSinceEpoch;
      return ((t >> (i * 3)) ^ (i * 37)) & 0xFF;
    });
    bytes[6] = (bytes[6] & 0x0F) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3F) | 0x80; // variant bits

    String hex(int b) => b.toRadixString(16).padLeft(2, '0');
    final id = '${hex(bytes[0])}${hex(bytes[1])}${hex(bytes[2])}${hex(bytes[3])}'
        '-${hex(bytes[4])}${hex(bytes[5])}'
        '-${hex(bytes[6])}${hex(bytes[7])}'
        '-${hex(bytes[8])}${hex(bytes[9])}'
        '-${hex(bytes[10])}${hex(bytes[11])}${hex(bytes[12])}'
        '${hex(bytes[13])}${hex(bytes[14])}${hex(bytes[15])}';

    await prefs.setString(key, id);
    return id;
  }
}
