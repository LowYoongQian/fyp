// Real MainApp sync/refresh/cache on Android; only HTTP responses are fixtures.
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:fyp_flutter/i18n/tr.dart';
import 'package:fyp_flutter/main.dart' as app;
import 'package:fyp_flutter/services/local_cache_service.dart';
import 'qa_account_isolation_test.dart' as fixture;
import '../../fyp-backend/tests/attendance_localization_test.dart' as localized;

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  localized.main(native:true); // The same real dashboard assertions also run on Android.
  for(final language in ['en','zh','ms']) {
    testWidgets('$language full sync focused refresh and cached restore agree on dates and face evidence',(tester) async {
      final root=await fixture.rootFor(tester);
      await fixture.login(root,'A');
      AppLanguage.code=language;
      final today=app.ApiConfig.now;
      final stamp=DateTime.utc(today.year,today.month,today.day,15,30).subtract(const Duration(hours:8)).toIso8601String();
      final rows=<Map<String,dynamic>>[
        for(final status in ['present','leave','absent'])
          {'course_code':status,'status':status,'marked_at':stamp,'liveness_passed':true,'face_verified':status=='present'},
        {'course_code':'manual','status':'present','marked_at':stamp,'liveness_passed':true,'face_verified':false},
        {'course_code':'legacy','status':'present','marked_at':stamp,'liveness_passed':true},
      ];
      for(final row in rows) {row['course_name']=row['course_code'];row['class_group']='G1';}
      await fixture.control('config',{'attendanceRows':rows});
      await fixture.sync(tester,root);
      final full=List<Map<String,dynamic>>.from(root.attendanceHistory);
      expect(full.map((r)=>r['faceVerified']).toList(),[true,false,false,false,false]);
      expect(full.map((r)=>r['status']).toList(),['Verified','Excused','Absent','Verified','Verified']);
      expect(full.every((r)=>r['marked_at']==stamp),isTrue);
      expect(root.isCheckedInToday,isTrue);
      await fixture.workWithFrames(tester,root.refreshStudentAttendance());
      expect(root.attendanceHistory,full,reason:'Focused refresh must use the same business mapping as full sync');
      final cache=await LocalCacheService.loadAttendanceCache(owner:'user-A',server:fixture.qaServer);
      expect(cache.map((r)=>r['face_verified']).toList(),[true,false,false,false,false]);
      // Hold HTTP responses; verify SQLite restoration before fresh data can arrive.
      await fixture.control('config',{'delayA':true});
      final pending=root.syncData(root.context) as Future<void>;
      await fixture.until(tester,() async=>((await fixture.state())['gates'] as List).length==3);
      expect(root.attendanceHistory,full,reason:'Real SQLite restoration must not invent face verification or translated dates');
      await fixture.control('release');await fixture.workWithFrames(tester,pending);
      // MC/absence alone must never set the global check-in flag.
      await fixture.control('config',{'delayA':false,'attendanceRows':rows.where((r)=>r['status']!='present').toList()});
      await fixture.sync(tester,root);expect(root.isCheckedInToday,isFalse);
      expect(root.attendanceHistory.every((r)=>r['faceVerified']==false),isTrue);
      AppLanguage.code='en';
    });
  }
}
