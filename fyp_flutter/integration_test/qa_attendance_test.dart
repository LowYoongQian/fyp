// Real MainApp + HTTP production routers + PostgreSQL + native queue/preferences.
// Image inference and network verification are explicit host QA stubs; no camera.
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:integration_test/integration_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:fyp_flutter/main.dart' as app;
import 'package:fyp_flutter/services/local_cache_service.dart';

const server='http://10.0.2.2:58006';
const email=String.fromEnvironment('QA_STUDENT_A');
const owner=String.fromEnvironment('QA_USER_A');
const lesson=String.fromEnvironment('QA_SESSION');
const course=String.fromEnvironment('QA_COURSE_CODE');
Future<void> work(WidgetTester tester,Future<void> future) async {
  var done=false;Object? failure;
  future.then((_)=>done=true,onError:(Object e){failure=e;done=true;});
  final clock=Stopwatch()..start();
  while(!done && clock.elapsed<const Duration(seconds:60)) {await tester.pump(const Duration(milliseconds:50));}
  expect(done,isTrue,reason:'Native operation must finish within 60 seconds');
  if(failure!=null) throw failure!;
}
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets('App attendance lost-response reconciliation duplicate guard and exact 5pm closure',(tester) async {
    expect(email,isNotEmpty);expect(owner,isNotEmpty);expect(lesson,isNotEmpty);
    final prefs=await SharedPreferences.getInstance();await prefs.setString('custom_api_url',server);
    app.ApiConfig.customUrl=server;
    await tester.pumpWidget(const app.MainApp());
    final dynamic root=tester.state(find.byType(app.AppRoot));
    final init=Stopwatch()..start();
    while(root.isSyncing && init.elapsed<const Duration(seconds:30)) {await tester.pump(const Duration(milliseconds:100));}
    expect(root.isSyncing,isFalse);
    await work(tester,root.handleLogin(email,'Synthetic!123','student',root.context));
    expect(root.isStudentLoggedIn,isTrue);expect(root.isFaceRegistered,isTrue);
    await work(tester,root.syncData(root.context));
    expect(root.studentSchedule.toString(),contains(course));
    final token=root.studentAuthToken as String;
    final headers={'Authorization':'Bearer $token','Content-Type':'application/json'};
    final challenge=await http.post(Uri.parse('$server/sessions/$lesson/checkin-challenge'),headers:headers);
    expect(challenge.statusCode,200);
    final challengeToken=jsonDecode(challenge.body)['challenge_token'];
    expect((await http.post(Uri.parse('$server/qa/response-loss'))).statusCode,200);
    Future<void> submit()=>root.submitAttendance(lesson,course,'Phase2 Synthetic Attendance',
        'synthetic-no-camera',true,root.context,extraDetails:{'challenge_token':challengeToken});
    await work(tester,submit());
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text('Saved on this phone'), findsOneWidget);
    expect(find.text('Attendance recorded'), findsNothing);
    var queued=await LocalCacheService.pendingCheckIns(owner,server);
    final pending=queued.where((r)=>r['session_id']==lesson).single;
    expect(pending['status'],'pending',reason:'A lost response is uncertain until server reconciliation');
    var response=await http.get(Uri.parse('$server/students/me/attendance'),headers:headers);
    expect(response.statusCode,200);
    var rows=jsonDecode(response.body) as List;
    expect(rows.where((r)=>r['course_code']==course&&r['status']=='present').length,1);
    await work(tester,root.syncData(root.context));
    queued=await LocalCacheService.pendingCheckIns(owner,server);
    final reconciled=queued.where((r)=>r['session_id']==lesson).single;
    expect(reconciled['status'],'synced');expect(reconciled['payload_json'],'{}');
    await work(tester,submit()); // Same attempt cannot create a second attendance row.
    response=await http.get(Uri.parse('$server/students/me/attendance'),headers:headers);
    rows=jsonDecode(response.body) as List;
    expect(rows.where((r)=>r['course_code']==course&&r['status']=='present').length,1);
    expect(root.attendanceHistory.toString(),contains(course));
    expect((await http.post(Uri.parse('$server/qa/close-at-five'))).statusCode,200);
    final closed=await http.post(Uri.parse('$server/sessions/$lesson/checkin-challenge'),headers:headers);
    expect(closed.statusCode,400,reason:'A 15:00–17:00 class rejects check-in at exactly17:00');
    debugPrint('QA_ATTENDANCE_PROOF: native queue pending -> synced, payload removed, one present row, exact17:00 rejection; camera/model/network stubbed');
    root.handleStudentLogout();
    await tester.pumpWidget(const SizedBox.shrink());await tester.pump();
  });
}
