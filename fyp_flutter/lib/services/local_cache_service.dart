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
//      is unreachable, the payload is queued under the original account/server.
//      AppRoot reconciles queued attempts on resume, refresh and while foregrounded.
//      Completed entries keep their status but discard the captured photo.
//
// Device identity:
//   getOrCreateDeviceId() generates a stable UUID-like fingerprint on first
//   call and persists it in SharedPreferences.  This value is recorded as
//   `device_id` on each check-in for auditing purposes.
// ---------------------------------------------------------------------------

class LocalCacheService {
  static Database? _db;

  static Future<Database> _open() async {
    if (_db != null) return _db!;
    final dbPath = p.join(await getDatabasesPath(), 'attendance_cache.db');
    _db = await openDatabase(
      dbPath,
      version: 2,
      onUpgrade: (db, oldVersion, newVersion) async {
        await _upgradeQueue(db);
      },
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
        await _upgradeQueue(db);
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

  static Future<void> _upgradeQueue(Database db) async {
    for (final column in [
      "owner TEXT NOT NULL DEFAULT ''",
      "server TEXT NOT NULL DEFAULT ''",
      "request_id TEXT NOT NULL DEFAULT ''",
      "status TEXT NOT NULL DEFAULT 'pending'",
      "last_error TEXT NOT NULL DEFAULT ''",
    ]) {
      await db.execute('ALTER TABLE pending_checkins ADD COLUMN $column');
    }
    // Old rows have no trustworthy owner. Keep a notice, never replay their photos.
    await db.update('pending_checkins', {
      'payload_json': '{}',
      'status': 'legacy',
      'last_error':
          'An old offline attempt has no account identity. Contact your lecturer.',
    });
    await db.execute(
      "CREATE UNIQUE INDEX pending_owner_session ON pending_checkins(owner, server, session_id) WHERE owner != ''",
    );
  }

  static Future<void> enqueueCheckIn(
    String owner,
    String server,
    dynamic sessionId,
    String requestId,
    DateTime capturedAt,
    Map<String, dynamic> payload,
  ) async {
    if (kIsWeb) {
      throw StateError('Offline check-in storage requires the mobile app');
    }
    if (owner.isEmpty) throw StateError('Sign in before saving attendance');
    final db = await _open();
    final values = <String, Object?>{
      'owner': owner,
      'server': server,
      'session_id': sessionId.toString(),
      'request_id': requestId,
      'payload_json': jsonEncode(payload),
      'queued_at': capturedAt.toUtc().toIso8601String(),
      'status': 'pending',
    };
    await db.transaction((txn) async {
      final existing = await txn.query('pending_checkins',
        where: 'owner = ? AND server = ? AND session_id = ?',
        whereArgs: [owner, server, sessionId.toString()]);
      if (existing.isEmpty) {
        await txn.insert('pending_checkins', values);
      } else if (['failed', 'rejected', 'cancelled'].contains(existing.first['status'])) {
        // A fresh user-initiated attempt may retry; an automatic replay cannot.
        await txn.update('pending_checkins', {...values, 'last_error': ''},
          where: 'id = ?', whereArgs: [existing.first['id']]);
      }
    });
  }

  static Future<List<Map<String, Object?>>> pendingCheckIns(
    String owner,
    String server,
  ) async {
    if (kIsWeb || owner.isEmpty) return [];
    return (await _open()).query(
      'pending_checkins',
      where: "(owner = ? AND server = ?) OR status = 'legacy'",
      whereArgs: [owner, server],
      orderBy: 'queued_at ASC',
    );
  }

  static Future<void> updateCheckIn(
    int id,
    String owner,
    String status,
    String message,
  ) async {
    final values = <String, Object?>{'status': status, 'last_error': message};
    if (status != 'pending') values['payload_json'] = '{}';
    await (await _open()).update(
      'pending_checkins',
      values,
      where: status == 'synced'
          ? 'id = ? AND owner = ?'
          : "id = ? AND owner = ? AND status NOT IN ('synced', 'excused')",
      whereArgs: [id, owner],
    );
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
