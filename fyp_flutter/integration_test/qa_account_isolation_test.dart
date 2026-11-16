// Android real MainApp and SQLite; synthetic HTTP service with controlled gates.
// Authentication/data here are fixtures; real Backend authentication is separate.
import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:integration_test/integration_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sqflite/sqflite.dart';
import 'package:fyp_flutter/main.dart' as app;
import 'package:fyp_flutter/services/local_cache_service.dart';
const qaServer='http://10.0.2.2:58005';
const privateA='PRIVATE-A-COURSE',privateB='PRIVATE-B-COURSE';
Future<Map<String,dynamic>> state() async => jsonDecode((await http.get(Uri.parse('$qaServer/qa/state'))).body);
Future<void> control(String path,[Map<String,dynamic> data=const {}]) async {
  final response=await http.post(Uri.parse('$qaServer/qa/$path'),headers:{'Content-Type':'application/json'},body:jsonEncode(data));
  expect(response.statusCode,200);
}
Future<void> until(WidgetTester tester,FutureOr<bool> Function() ready) async {
  final clock=Stopwatch()..start();
  while(!await ready()) {
    if(clock.elapsed>const Duration(seconds:20)) {fail('Fixture state not reached within 20 seconds');}
    await tester.pump(const Duration(milliseconds:20));
  }
}
Future<dynamic> rootFor(WidgetTester tester) async {
  await control('reset');
  final prefs=await SharedPreferences.getInstance();
  await prefs.setString('custom_api_url',qaServer); // Real Android preference storage; no clear/reset.
  app.ApiConfig.customUrl=qaServer;
  await tester.pumpWidget(const app.MainApp());
  final dynamic root=tester.state(find.byType(app.AppRoot));
  await until(tester,()=>!root.isSyncing);
  addTearDown(() async {await control('release');await tester.pumpWidget(const SizedBox.shrink());await tester.pump();});
  return root;
}
Future<void> login(dynamic root,String owner) async => root.handleLogin('${owner.toLowerCase()}@student.school.edu','Synthetic!123','student',root.context);
Future<void> workWithFrames(WidgetTester tester,Future<void> work) async {
  var done=false;Object? failure;
  work.then((_)=>done=true,onError:(Object e){failure=e;done=true;});
  await until(tester,()=>done);
  if(failure!=null) throw failure!;
}
Future<void> sync(WidgetTester tester,dynamic root) => workWithFrames(tester,root.syncData(root.context));
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets('native SQLite owner and server scopes preserve independent caches',(tester) async {
    const a='native-scope-A',b='native-scope-B',one='https://synthetic-one.invalid',two='https://synthetic-two.invalid';
    await LocalCacheService.saveAttendanceCache([{'course_code':privateA}],owner:a,server:one);
    expect(await LocalCacheService.loadAttendanceCache(owner:b,server:one),isEmpty);
    expect(await LocalCacheService.loadAttendanceCache(owner:a,server:two),isEmpty);
    await LocalCacheService.saveAttendanceCache([{'course_code':privateB}],owner:b,server:one);
    expect((await LocalCacheService.loadAttendanceCache(owner:a,server:one)).toString(),contains(privateA));
    expect((await LocalCacheService.loadAttendanceCache(owner:b,server:one)).toString(),contains(privateB));
    final db=await openDatabase('${await getDatabasesPath()}/attendance_cache.db');
    expect((await db.rawQuery('PRAGMA user_version')).first.values.single,5);
  });
  testWidgets('A SQLite and timetable cache never appear after B data service fails',(tester) async {
    final root=await rootFor(tester);
    await login(root,'A');await sync(tester,root);
    expect(root.attendanceHistory.toString(),contains(privateA));
    expect(root.studentSchedule.toString(),contains(privateA));
    final db=await openDatabase('${await getDatabasesPath()}/attendance_cache.db');
    expect((await db.query('attendance_cache')).toString(),contains(privateA),reason:'A must reach real SQLite');
    root.handleStudentLogout();
    await control('config',{'offlineB':true});await login(root,'B');await sync(tester,root);
    expect(root.studentName,'Synthetic B');
    expect(root.attendanceHistory.toString(),isNot(contains(privateA)),reason:'B cannot inherit A SQLite history');
    expect(root.studentSchedule.toString(),isNot(contains(privateA)),reason:'B cannot inherit A timetable');
    expect(root.studentAnnouncements.toString(),isNot(contains(privateA)));
  });
  testWidgets('late A sync and pending GET deduplication cannot overwrite B',(tester) async {
    final root=await rootFor(tester);await control('config',{'delayA':true});await login(root,'A');
    await until(tester,() async=>((await state())['gates'] as List).length==3);
    final pendingA=root.syncData(root.context) as Future<void>;
    root.handleStudentLogout();await login(root,'B');
    final pendingB=root.syncData(root.context) as Future<void>;
    await tester.pump(const Duration(milliseconds:200));await control('release');
    await workWithFrames(tester,Future.wait([pendingA,pendingB]));
    final requests=((await state())['requests'] as List).where((r)=>r['owner']=='B').map((r)=>r['path']).toSet();
    expect(requests,containsAll(['/students/me/attendance','/students/me/courses','/students/me/announcements']),reason:'B must issue its own authorized GETs');
    expect(root.attendanceHistory.toString(),contains(privateB));
    expect(root.studentSchedule.toString(),contains(privateB));
    expect(root.attendanceHistory.toString(),isNot(contains(privateA)));
    await control('config',{'offlineB':true});await sync(tester,root);
    expect(root.attendanceHistory.toString(),contains(privateB));
    expect(root.attendanceHistory.toString(),isNot(contains(privateA)));
  });
  testWidgets('late A timetable refresh cannot overwrite B UI or persistent cache',(tester) async {
    final root=await rootFor(tester);await login(root,'A');await sync(tester,root);
    await control('config',{'delayTimetable':true});final pending=root.refreshStudentTimetable();
    await until(tester,() async=>((await state())['gates'] as List).contains('timetable'));
    root.handleStudentLogout();await login(root,'B');await sync(tester,root);
    await control('release');await workWithFrames(tester,pending.then<void>((_){}));
    expect(root.studentSchedule.toString(),contains(privateB));
    expect(root.studentSchedule.toString(),isNot(contains(privateA)));
    await control('config',{'offlineB':true});await sync(tester,root);
    expect(root.studentSchedule.toString(),contains(privateB));
    expect(root.studentSchedule.toString(),isNot(contains(privateA)));
  });
}
