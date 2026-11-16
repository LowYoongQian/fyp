// Real dashboard widgets with Mock HTTP/preferences; no camera or native SQLite.
import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../fyp_flutter/lib/main.dart';
import '../../fyp_flutter/lib/screens/student/student_dashboard_screen.dart';
import '../../fyp_flutter/lib/screens/staff/staff_dashboard_screen.dart';

const secretA='PRIVATE-A-COURSE';
Widget student(String owner)=>MaterialApp(home:Scaffold(body:MainScreen(
  key:ValueKey(owner),studentId:owner,studentName:'Synthetic $owner',studentCode:owner,
  studentEmail:'$owner@student.school.edu',authToken:owner,isFaceRegistered:true,
  isCheckedInToday:false,attendanceHistory:const [],studentSchedule:const [],announcements:const [],
  isDatabaseOffline:false,isSyncing:false,onLogout:(){},onSyncRequested:() async {},
  onTimetableRefresh:() async=>[],onRegisterFace:(){},
  onCheckInComplete:(a,b,c,d,e,f,{int? challengeMs,Map<String,dynamic>? extraDetails}){},
)));
Widget staff(String owner)=>MaterialApp(home:Scaffold(body:StaffDashboard(
  key:ValueKey(owner),staffId:0,staffName:'Synthetic $owner',staffCode:'T-$owner',
  staffEmail:'$owner@staff.school.edu',authToken:owner,apiBaseUrl:'http://127.0.0.1:1',
  isDatabaseOffline:false,isSyncing:false,onLogout:(){},onSyncRequested:(){},
)));
Future<void> frames(WidgetTester tester) async {for(var i=0;i<15;i++) {await tester.pump(const Duration(milliseconds:20));}}
void cleanup(WidgetTester tester) {
  addTearDown(() async {
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(seconds:11)); // Drain disposed WebSocket connect timeouts.
  });
}
void main() {
  setUp(() {GoogleFonts.config.allowRuntimeFetching=false;ApiConfig.customUrl='http://127.0.0.1:1';SharedPreferences.setMockInitialValues({});});
  testWidgets('student B cannot read A active sessions persisted by the actual dashboard',(tester) async {
    cleanup(tester);
    await http.runWithClient(() async {
      await tester.pumpWidget(student('A'));await frames(tester);
      final dynamic a=tester.state(find.byType(MainScreen));
      expect(a.activeSessions.toString(),contains(secretA));
      expect((await SharedPreferences.getInstance()).getKeys(),isNotEmpty);
      await tester.pumpWidget(const SizedBox.shrink());await tester.pump();
      await tester.pumpWidget(student('B'));await frames(tester);
      final dynamic b=tester.state(find.byType(MainScreen));
      expect(b.activeSessions.toString(),isNot(contains(secretA)));
      await tester.pumpWidget(const SizedBox.shrink());await tester.pump(const Duration(seconds:11));
    },()=>MockClient((r) async {
      if(r.url.path=='/students/me/active-sessions' && r.headers['Authorization']=='Bearer A') {
        return http.Response(jsonEncode([{'id':'A-session','course_code':secretA,'course_name':secretA,'class_group':'G1','is_open':true}]),200);
      }
      return http.Response('{}',503);
    }));
  });
  testWidgets('staff B with UUID coerced to zero cannot consume unowned legacy staff cache',(tester) async {
    cleanup(tester);
    SharedPreferences.setMockInitialValues({
      'cached_staff_0_timetable':jsonEncode([{'courseCode':secretA}]),
      'cached_staff_0_courses':jsonEncode([{'id':'A-course','course_code':secretA}]),
    });
    await http.runWithClient(() async {
      await tester.pumpWidget(staff('B'));await frames(tester);
      final dynamic b=tester.state(find.byType(StaffDashboard));
      expect(b.myTimetable.toString(),isNot(contains(secretA)));
      expect(b.myCourses.toString(),isNot(contains(secretA)));
      await tester.pumpWidget(const SizedBox.shrink());await tester.pump(const Duration(seconds:11));
    },()=>MockClient((r) async=>http.Response('{}',503)));
  });
  testWidgets('late disposed student A request cannot poison B active-session cache',(tester) async {
    cleanup(tester);
    final gate=Completer<http.Response>();
    await http.runWithClient(() async {
      await tester.pumpWidget(student('A'));await frames(tester);
      await tester.pumpWidget(const SizedBox.shrink());await tester.pump();
      gate.complete(http.Response(jsonEncode([{'id':'A-session','course_code':secretA,'course_name':secretA}]),200));
      await frames(tester);
      await tester.pumpWidget(student('B'));await frames(tester);
      final dynamic b=tester.state(find.byType(MainScreen));
      expect(b.activeSessions.toString(),isNot(contains(secretA)));
      await tester.pumpWidget(const SizedBox.shrink());await tester.pump(const Duration(seconds:11));
    },()=>MockClient((r) async {
      if(r.url.path=='/students/me/active-sessions' && r.headers['Authorization']=='Bearer A') return gate.future;
      return http.Response('{}',503);
    }));
  });
  testWidgets('staff scoped cache still restores its owner while another UUID-zero account stays empty',(tester) async {
    cleanup(tester);var offline=false;
    await http.runWithClient(() async {
      await tester.pumpWidget(staff('A'));await frames(tester);
      final dynamic a=tester.state(find.byType(StaffDashboard));
      expect(a.myCourses.toString(),contains(secretA));expect(a.myTimetable.toString(),contains(secretA));
      await tester.pumpWidget(const SizedBox.shrink());await tester.pump();offline=true;
      await tester.pumpWidget(staff('B'));await frames(tester);
      final dynamic b=tester.state(find.byType(StaffDashboard));
      expect(b.myCourses,isEmpty);expect(b.myTimetable,isEmpty);
      await tester.pumpWidget(const SizedBox.shrink());await tester.pump();
      await tester.pumpWidget(staff('A'));await frames(tester);
      final dynamic restored=tester.state(find.byType(StaffDashboard));
      expect(restored.myCourses.toString(),contains(secretA));expect(restored.myTimetable.toString(),contains(secretA));
      await tester.pumpWidget(const SizedBox.shrink());await tester.pump(const Duration(seconds:11));
    },()=>MockClient((r) async {
      if(offline || r.headers['Authorization']!='Bearer A') return http.Response('{}',503);
      if(r.url.path=='/lecturers/me/courses') return http.Response(jsonEncode([{'id':'A-course','course_code':secretA,'course_name':secretA,'credit_hours':3}]),200);
      if(r.url.path=='/lecturers/me/timetable') return http.Response(jsonEncode([{'id':'A-meeting','course_id':'A-course','course_code':secretA,'course_name':secretA,'schedule_day':'Monday','schedule_start':'10:00','schedule_end':'12:00'}]),200);
      return http.Response('[]',200);
    }));
  });
}
