// Real dashboard widgets; HTTP/preferences are synthetic, no camera claims.
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../fyp_flutter/lib/main.dart';
import '../../fyp_flutter/lib/i18n/tr.dart';
import '../../fyp_flutter/lib/screens/student/student_dashboard_screen.dart';
import '../../fyp_flutter/lib/services/attendance_parity.dart';

void main({bool native = false}) {
  test('campus midnight is independent of labels, UTC and explicit offsets', () {
    final date=DateTime.utc(2026,11,12);
    expect(attendanceOnDate({'marked_at':'2026-11-11T15:59:59Z'},date),isFalse);
    expect(attendanceOnDate({'marked_at':'2026-11-11T16:00:00Z'},date),isTrue);
    expect(attendanceOnDate({'marked_at':'2026-11-12T00:00:00+08:00'},date),isTrue);
    expect(attendanceOnDate({'marked_at':'2026-11-11T16:00:00'},date),isTrue);
    expect(attendanceOnDate({'marked_at':'invalid','date':'Today 今天 Hari ini'},date),isFalse);
    expect(attendanceOnDate({'date':'Today 今天 Hari ini'},date),isFalse);
  });
  test('explicit face evidence never turns MC, absence or legacy present into a camera success', () {
    final now=DateTime.utc(2026,11,11);
    for(final status in ['present','leave','absent']) {
      for(final evidence in [true,false,null]) {
        final mapped=attendanceHistoryRow({'status':status,'liveness_passed':true,'face_verified':evidence},now);
        expect(mapped['faceVerified'],status=='present' && evidence==true);
      }
    }
  });
  for (final language in ['en', 'zh', 'ms']) {
    testWidgets('$language today check-in uses timestamps, excluding leave, absent and yesterday', (tester) async {
      GoogleFonts.config.allowRuntimeFetching=native;
      if (!native) SharedPreferences.setMockInitialValues({});
      AppLanguage.code=language;
      ApiConfig.customUrl=native?'http://10.0.2.2:58005':'http://127.0.0.1:1';
      final clock=DateTime.now().toUtc();
      ApiConfig.serverOffset=DateTime.utc(clock.year,clock.month,clock.day,8).difference(clock); // 16:00 campus.
      final today=ApiConfig.now;
      final campusMark=DateTime.utc(today.year,today.month,today.day,15,30);
      Map<String,dynamic> row(String code, String status, DateTime mark) => {
        'courseCode':code,'courseName':code,'group':'G1','status':status,
        'marked_at':mark.subtract(ApiConfig.campusTimezoneOffset).toIso8601String(),
        'date':tr('Today, {time}',{'time':'3:30 PM'}),
      };
      Future<void> exercise() async {
        await tester.pumpWidget(MaterialApp(home:Scaffold(body:MainScreen(
          studentId:'synthetic',studentName:'QA',studentCode:'QA',studentEmail:'qa@test.invalid',authToken:'synthetic',
          isFaceRegistered:true,isCheckedInToday:true,
          attendanceHistory:[row('PRESENT','Verified',campusMark),row('MC','Excused',campusMark),row('ABSENT','Absent',campusMark),row('OLD','Verified',campusMark.subtract(const Duration(days:1)))],
          studentSchedule:[for(final code in ['PRESENT','MC','ABSENT','OLD']) {
            'meetingId':code,'courseCode':code,'courseName':code,'classGroup':'G1','group':'Lecture',
            'day':['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'][today.weekday-1],
            'startTime':'00:00','endTime':'23:59','room':'QA Room',
          }],announcements:const [],isDatabaseOffline:false,isSyncing:false,
          onLogout:(){},onSyncRequested:() async {},onTimetableRefresh:() async=>[],onRegisterFace:(){},
          onCheckInComplete:(a,b,c,d,e,{int? challengeMs,Map<String,dynamic>? extraDetails}){},
        ))));
        for(var i=0;i<15;i++) {await tester.pump(const Duration(milliseconds:20));}
        final dynamic dashboard=tester.state(find.byType(MainScreen));
        expect(dashboard.windowStatus({'startTime':'15:00','endTime':'17:00'}),'active',reason:'Campus 16:00 must remain within a 15:00–17:00 class regardless of phone timezone');
        expect(dashboard.getMarkedCountForDate(today),1,reason:'Approved MC is attendance credit, not a check-in; display strings are not dates');
        expect(dashboard.getMarkedCountForDate(today.subtract(const Duration(days:1))),1);
        expect(dashboard.getTodayCheckInTime(),'3:30 PM');
        expect(find.text(tr('COMPLETED')),findsOneWidget,reason:'Only today present may show the completed session badge, in every language');
        ApiConfig.serverOffset=DateTime.utc(clock.year,clock.month,clock.day,9).difference(DateTime.now().toUtc());
        expect(dashboard.windowStatus({'startTime':'15:00','endTime':'17:00'}),'after',reason:'Confirmed requirement: check-in closes at 5pm, including the exact end boundary');
        await tester.pumpWidget(const SizedBox.shrink());
        await tester.pump(const Duration(seconds:11));
      }
      if(native) {await exercise();} else {
        await http.runWithClient(exercise,()=>MockClient((r) async=>http.Response(jsonEncode([]),200)));
      }
      ApiConfig.serverOffset=Duration.zero;
      AppLanguage.code='en';
    });
  }
}
