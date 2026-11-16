// Real v4 -> v5: preserve owned history/queue; unknown face provenance fails closed.
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:sqflite/sqflite.dart';
import 'package:fyp_flutter/services/local_cache_service.dart';
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets('v4 history is retained without claiming face verification, pending photo unchanged',(tester) async {
    expect(const bool.fromEnvironment('QA_READ_ONLY_GUEST'),isTrue);
    final path='${await getDatabasesPath()}/attendance_cache.db';
    expect(await databaseExists(path),isFalse,reason:'Never replace an existing application database');
    final legacy=await openDatabase(path,version:4,onCreate:(db,version) async {
      await db.execute('CREATE TABLE attendance_cache(id INTEGER PRIMARY KEY AUTOINCREMENT,owner TEXT NOT NULL,server TEXT NOT NULL,course_code TEXT NOT NULL,course_name TEXT NOT NULL,class_group TEXT,status TEXT NOT NULL,marked_at TEXT NOT NULL,network_verified INTEGER,liveness_passed INTEGER)');
      await db.execute("CREATE TABLE pending_checkins(id INTEGER PRIMARY KEY AUTOINCREMENT,session_id INTEGER NOT NULL,payload_json TEXT NOT NULL,queued_at TEXT NOT NULL,owner TEXT NOT NULL DEFAULT '',server TEXT NOT NULL DEFAULT '',request_id TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'pending',last_error TEXT NOT NULL DEFAULT '',class_label TEXT NOT NULL DEFAULT '')");
    });
    const owner='v4-owner',server='https://synthetic.invalid',payload='{"image_base64":"synthetic-photo"}';
    for(final status in ['present','leave','absent']) {
      await legacy.insert('attendance_cache',{'owner':owner,'server':server,'course_code':status,'course_name':status,'status':status,'marked_at':'2026-11-11T07:30:00Z','liveness_passed':1});
    }
    await legacy.insert('pending_checkins',{'session_id':88,'payload_json':payload,'queued_at':'2026-11-11T07:30:00Z','owner':owner,'server':server,'request_id':'v4-request'});
    await legacy.close();
    final rows=await LocalCacheService.loadAttendanceCache(owner:owner,server:server);
    expect(rows.length,3);expect(rows.every((r)=>r['face_verified']==false),isTrue);
    expect(rows.every((r)=>r['liveness_passed']==true),isTrue,reason:'Preserve server facts while refusing unknown biometric provenance');
    final db=await openDatabase(path);
    expect((await db.rawQuery('PRAGMA user_version')).first.values.single,5);
    final pending=(await db.query('pending_checkins')).single;
    expect(pending['owner'],owner);expect(pending['request_id'],'v4-request');expect(pending['payload_json'],payload);
    await LocalCacheService.saveAttendanceCache([{'course_code':'verified','status':'present','marked_at':'2026-11-11T07:30:00Z','face_verified':true}],owner:owner,server:server);
    expect((await LocalCacheService.loadAttendanceCache(owner:owner,server:server)).single['face_verified'],isTrue);
  });
}
