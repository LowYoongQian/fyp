import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../fyp_flutter/lib/main.dart';
import '../../fyp_flutter/lib/screens/student/face_scanner_screen.dart';
import '../../fyp_flutter/lib/services/student_errors.dart';
import '../../fyp_flutter/lib/screens/system/settings_screen.dart';

void main() {
  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);
  test('registration, attendance and liveness remain distinct outcomes', () {
    expect(friendlyStudentError('Your face is already registered.'), startsWith('Face Already Registered:'));
    expect(friendlyStudentError('You have already registered attendance for this session'), startsWith('Already Checked In:'));
    expect(isAlreadyCheckedInError('Your face is already registered.'), isFalse);
    expect(friendlyStudentError('Face liveness check failed'), startsWith('Liveness Verification Failed:'));
    expect(friendlyStudentError('Face identity could not be verified'), startsWith('Face Match Failed:'));
  });

  testWidgets('a duplicated registration callback posts once and never attends', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final paths = <String>[];
    final pending = Completer<http.Response>();
    var registered = false;
    await http.runWithClient(() async {
      await tester.binding.setSurfaceSize(const Size(900, 1500));
      await tester.pumpWidget(const MainApp());
      for (var i = 0; i < 15; i++) { await tester.pump(const Duration(milliseconds: 50)); }
      final dynamic root = tester.state(find.byType(AppRoot));
      root.isStudentLoggedIn = true;
      root.studentAuthToken = 'isolated-token';
      root.isSyncing = false;
      final registration = root.registerFace(root.context) as Future<void>;
      for (var i = 0; i < 8; i++) { await tester.pump(const Duration(milliseconds: 50)); }
      final scanner = tester.widget<FaceScannerScreen>(find.byType(FaceScannerScreen));
      final first = scanner.onScanComplete('synthetic', true) as Future<void>;
      final second = scanner.onScanComplete('synthetic', true) as Future<void>;
      await tester.pump();
      registered = true;
      pending.complete(http.Response(jsonEncode({'is_face_registered': true, 'registration_version': 'new'}), 200));
      await first; await second;
      await tester.pump();
      // A late delivery is also ignored after the first request has finished.
      await scanner.onScanComplete('synthetic', true);
      await tester.pump();
      expect(find.text('Verification Failed'), findsNothing);
      expect(paths.where((p) => p == '/students/me/face').length, 1);
      expect(paths.any((p) => p.endsWith('/attend')), isFalse);
      expect(root.isFaceRegistered, isTrue);
      expect(find.text('Verification Failed'), findsNothing);
      Navigator.of(tester.element(find.byType(FaceScannerScreen))).pop();
      await tester.pump(const Duration(milliseconds: 400));
      await registration;
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump();
      await tester.binding.setSurfaceSize(null);
    }, () => MockClient((request) async {
      paths.add(request.url.path);
      if (request.url.path == '/students/me/face/status') {
        return http.Response(jsonEncode({'is_face_registered': registered, 'registration_version': registered ? 'new' : null}), 200);
      }
      if (request.url.path == '/students/me/face') {
        return paths.where((p) => p == '/students/me/face').length == 1
            ? pending.future : http.Response('{"detail":"Your face is already registered."}', 409);
      }
      if (request.url.path.contains('languages')) return http.Response('{}', 200);
      if (request.url.path == '/auth/server-time') return http.Response(jsonEncode({'server_time': DateTime.now().toUtc().toIso8601String()}), 200);
      return http.Response('[]', 200);
    }));
  });

  testWidgets('timeout cannot start another scan and callback result stays visible', (tester) async {
    var calls = 0;
    await tester.binding.setSurfaceSize(const Size(900, 1500));
    await tester.pumpWidget(MaterialApp(home: Builder(builder: (context) => Scaffold(
      body: TextButton(onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => FaceScannerScreen(
        title: 'Test scanner', onScanComplete: (image, passed, {int? challengeMs, String? challengeToken}) {
          calls++;
          showDialog<void>(context: context, builder: (_) => const AlertDialog(title: Text('Scan result')));
        },
      ))), child: const Text('Open scanner')),
    ))));
    await tester.tap(find.text('Open scanner'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    final dynamic scanner = tester.state(find.byType(FaceScannerScreen));
    await scanner.startScanning();
    // No gestures: allow the first movement deadline to expire.
    for (var i = 0; i < 30; i++) { await tester.pump(const Duration(milliseconds: 200)); }
    expect(scanner.isScanning, isFalse);
    await scanner.startScanning();
    expect(scanner.isScanning, isFalse, reason: 'The pending timeout owns the scanner until it closes');
    await tester.pump(const Duration(seconds: 2));
    await tester.pump(const Duration(milliseconds: 400));
    expect(calls, 1);
    expect(find.text('Scan result'), findsOneWidget, reason: 'Popping the scanner must not pop its result dialog');
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump();
    await tester.binding.setSurfaceSize(null);
  });

  testWidgets('Settings shows self-test only when eligible and trusts server verdict', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final posts = <String>[];
    await http.runWithClient(() async {
      await tester.binding.setSurfaceSize(const Size(900, 1500));
      await tester.pumpWidget(const MainApp());
      for (var i = 0; i < 15; i++) { await tester.pump(const Duration(milliseconds: 50)); }
      final dynamic root = tester.state(find.byType(AppRoot));
      Navigator.of(root.context).push(MaterialPageRoute(builder: (_) => const SettingsScreen()));
      for (var i = 0; i < 10; i++) { await tester.pump(const Duration(milliseconds: 50)); }
      expect(find.text('Face Recognition Self-Test'), findsNothing);
      Navigator.of(tester.element(find.byType(SettingsScreen))).pop();
      await tester.pump(); await tester.pump(const Duration(milliseconds: 400));
      Navigator.of(root.context).push(MaterialPageRoute(builder: (_) => const SettingsScreen(
        canSelfTest: true, authToken: 'isolated-token', apiBaseUrl: 'http://127.0.0.1:1')));
      for (var i = 0; i < 10; i++) { await tester.pump(const Duration(milliseconds: 50)); }
      await tester.tap(find.text('Face Recognition Self-Test'));
      for (var i = 0; i < 10; i++) { await tester.pump(const Duration(milliseconds: 50)); }
      final scanner = tester.widget<FaceScannerScreen>(find.byType(FaceScannerScreen));
      expect(scanner.selfTest, isTrue);
      expect(scanner.sessionId, isNull);
      expect(tester.widget<FilledButton>(find.byWidgetPredicate((w) => w is FilledButton)).onPressed, isNull,
          reason: 'Self-test cannot start without a real camera');
      scanner.onScanComplete('synthetic', true, challengeToken: 'self-test-token');
      Navigator.of(tester.element(find.byType(FaceScannerScreen))).pop();
      for (var i = 0; i < 10; i++) { await tester.pump(const Duration(milliseconds: 50)); }
      expect(posts, ['/students/me/face/self-test']);
      expect(find.text('Self-Test Failed'), findsOneWidget, reason: 'Client liveness=true cannot override server mismatch');
      expect(find.textContaining('No attendance was recorded.'), findsOneWidget);
      await tester.pumpWidget(const SizedBox.shrink()); await tester.pump();
      await tester.binding.setSurfaceSize(null);
    }, () => MockClient((request) async {
      if (request.method == 'POST') {
        posts.add(request.url.path);
        return http.Response('{"passed":false,"reason":"face_mismatch","message":"Face did not match."}', 200);
      }
      if (request.url.path == '/students/me/face/status') return http.Response('{"is_face_registered":true}', 200);
      if (request.url.path.contains('languages')) return http.Response('{}', 200);
      if (request.url.path == '/auth/me') return http.Response('null', 200);
      if (request.url.path == '/auth/server-time') return http.Response(jsonEncode({'server_time': DateTime.now().toUtc().toIso8601String()}), 200);
      return http.Response('[]', 200);
    }));
  });

  testWidgets('duplicate attendance submissions show an informational checked-in result', (tester) async {
    SharedPreferences.setMockInitialValues({});
    var posts = 0;
    final pending = Completer<http.Response>();
    await http.runWithClient(() async {
      await tester.binding.setSurfaceSize(const Size(900, 1500));
      await tester.pumpWidget(const MainApp());
      for (var i = 0; i < 15; i++) { await tester.pump(const Duration(milliseconds: 50)); }
      final dynamic root = tester.state(find.byType(AppRoot));
      root.isStudentLoggedIn = true; root.studentAuthToken = 'isolated-token'; root.isSyncing = false;
      Future<void> submit() => root.submitAttendance('lesson', 'QA', 'Synthetic', 'synthetic', true,
          root.context, extraDetails: {'challenge_token': 'same-attempt'}) as Future<void>;
      final first = submit();
      final second = submit();
      for (var i = 0; i < 15; i++) { await tester.pump(const Duration(milliseconds: 50)); }
      pending.complete(http.Response('{"detail":"You have already registered attendance for this session"}', 400));
      var completed = false;
      first.then((_) => completed = true);
      for (var i = 0; i < 240 && !completed; i++) { await tester.pump(const Duration(milliseconds: 100)); }
      expect(completed, isTrue, reason: 'Attendance must finish after its guarded HTTP result');
      await first; await second;
      await submit();
      await tester.pump();
      expect(posts, 1);
      expect(find.text('Verification Failed'), findsNothing);
      expect(find.text("You're already checked in for this class."), findsOneWidget);
      await tester.pumpWidget(const SizedBox.shrink()); await tester.pump();
      await tester.binding.setSurfaceSize(null);
    }, () => MockClient((request) async {
      if (request.url.path.endsWith('/attend')) { posts++; return pending.future; }
      if (request.url.path.contains('languages')) return http.Response('{}', 200);
      if (request.url.path == '/auth/server-time') return http.Response(jsonEncode({'server_time': DateTime.now().toUtc().toIso8601String()}), 200);
      return http.Response('[]', 200);
    }));
  });
}
