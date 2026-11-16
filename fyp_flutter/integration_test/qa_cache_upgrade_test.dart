// Real native SQLite v3 -> v5 recovery in a fresh test installation only.
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:sqflite/sqflite.dart';
import 'package:fyp_flutter/services/local_cache_service.dart';
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets('v3 upgrade discards unowned history and preserves original pending check-in',(tester) async {
    expect(const bool.fromEnvironment('QA_READ_ONLY_GUEST'),isTrue,reason:'Host must audit the read-only synthetic guest');
    final path='${await getDatabasesPath()}/attendance_cache.db';
    expect(await databaseExists(path),isFalse,reason:'Refuse to replace any existing database; use a fresh test install');
    final legacy=await openDatabase(path,version:3,onCreate:(db,version) async {
      await db.execute('CREATE TABLE attendance_cache(id INTEGER PRIMARY KEY AUTOINCREMENT,course_code TEXT NOT NULL,course_name TEXT NOT NULL,class_group TEXT,status TEXT NOT NULL,marked_at TEXT NOT NULL,network_verified INTEGER,liveness_passed INTEGER)');
      await db.execute("CREATE TABLE pending_checkins(id INTEGER PRIMARY KEY AUTOINCREMENT,session_id INTEGER NOT NULL,payload_json TEXT NOT NULL,queued_at TEXT NOT NULL,owner TEXT NOT NULL DEFAULT '',server TEXT NOT NULL DEFAULT '',request_id TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'pending',last_error TEXT NOT NULL DEFAULT '',class_label TEXT NOT NULL DEFAULT '')");
      await db.execute("CREATE UNIQUE INDEX pending_owner_session ON pending_checkins(owner,server,session_id) WHERE owner != ''");
    });
    await legacy.insert('attendance_cache',{'course_code':'UNOWNED_PRIVATE_HISTORY','course_name':'Synthetic','status':'present','marked_at':'2026-11-11T07:30:00'});
    const payload='{"image_base64":"synthetic-not-a-real-photo"}';
    await legacy.insert('pending_checkins',{'session_id':99,'payload_json':payload,'queued_at':'2026-11-11T07:30:00Z','owner':'synthetic-pending-owner','server':'https://synthetic.invalid','request_id':'synthetic-request','class_label':'Synthetic pending class'});
    await legacy.close();
    expect(await LocalCacheService.loadAttendanceCache(owner:'new-user',server:'https://synthetic.invalid'),isEmpty);
    final db=await openDatabase(path);
    expect((await db.rawQuery('PRAGMA user_version')).first.values.single,5);
    expect(await db.query('attendance_cache'),isEmpty);
    final pending=(await db.query('pending_checkins')).single;
    expect(pending['owner'],'synthetic-pending-owner');expect(pending['request_id'],'synthetic-request');
    expect(pending['status'],'pending');expect(pending['payload_json'],payload);
    expect(pending['class_label'],'Synthetic pending class');
  });
}
