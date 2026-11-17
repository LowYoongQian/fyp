import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../lib/main.dart';
import '../lib/screens/student/face_scanner_screen.dart';
import '../lib/services/student_errors.dart';
import '../lib/screens/system/settings_screen.dart';
import '../lib/screens/student/face_registration_required.dart';
import '../lib/screens/student/student_dashboard_screen.dart';

void main() {
  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);
  test('registration, attendance and liveness remain distinct outcomes', () {
    expect(friendlyStudentError('Your face is already registered.'), startsWith('Face Already Registered:'));
    expect(friendlyStudentError('You have already registered attendance for this session'), startsWith('Already Checked In:'));
    expect(isAlreadyCheckedInError('Your face is already registered.'), isFalse);
    expect(friendlyStudentError('Face liveness check failed'), startsWith('Liveness Verification Failed:'));
    expect(friendlyStudentError('Face identity could not be verified'), startsWith('Face Match Failed:'));
  });

  for (final scenario in ['normal', 'late_commit', 'false_then_true',
    'rejected', 'conflict_rejected', 'already_registered',
    'status_timeout', 'unknown_then_refresh', 'account_switch',
    'account_switch_during_status', 'disposed']) {
    testWidgets('registration recovery: $scenario', (tester) async {
      SharedPreferences.setMockInitialValues({});
      var posts = 0;
      var statusAfterPost = 0;
      var registered = false;
      final delayedPost = Completer<http.Response>();
      final delayedStatus = Completer<http.Response>();
      final statusTimes = <DateTime>[];
      await http.runWithClient(() async {
        await tester.binding.setSurfaceSize(const Size(900, 1500));
        await tester.pumpWidget(const MainApp());
        for (var i = 0; i < 15; i++) { await tester.pump(const Duration(milliseconds: 50)); }
        final dynamic root = tester.state(find.byType(AppRoot));
        root.isStudentLoggedIn = true;
        root.studentAuthToken = 'synthetic-owner';
        root.isSyncing = false;
        root.selectedTab = 1;
        final registration = root.registerFace(root.context) as Future<void>;
        for (var i = 0; i < 8; i++) { await tester.pump(const Duration(milliseconds: 50)); }
        final scanner = tester.widget<FaceScannerScreen>(find.byType(FaceScannerScreen));
        // The real scanner closes before delivering its callback.
        Navigator.of(tester.element(find.byType(FaceScannerScreen))).pop();
        await tester.pump(); await tester.pump(const Duration(milliseconds: 400));
        await registration;
        var finished = false;
        final submission = scanner.onScanComplete('synthetic', true) as Future<void>;
        submission.then((_) => finished = true);
        await scanner.onScanComplete('synthetic', true);
        await root.registerFace(root.context);
        await tester.pump();
        if (scenario == 'account_switch') {
          root.handleStudentLogout();
          root.studentAuthToken = 'synthetic-other';
          root.isStudentLoggedIn = true;
          delayedPost.complete(http.Response('{"is_face_registered":true,"registration_version":"old"}', 200));
        } else if (scenario == 'account_switch_during_status') {
          root.handleStudentLogout();
          root.studentAuthToken = 'synthetic-other';
          root.isStudentLoggedIn = true;
          delayedStatus.complete(http.Response('{"is_face_registered":true,"registration_version":"old"}', 200));
        } else if (scenario == 'disposed') {
          await tester.pumpWidget(const SizedBox.shrink());
          delayedPost.complete(http.Response('{"is_face_registered":true,"registration_version":"old"}', 200));
        }
        for (var i = 0; i < 115 && !finished; i++) {
          await tester.pump(const Duration(seconds: 1));
        }
        expect(finished, isTrue, reason: 'Recovery must have a finite bound');
        await submission;
        await tester.pump();
        expect(posts, 1, reason: 'Neither timeouts nor repeated taps/callbacks may resend a selfie');
        if (['normal', 'late_commit', 'false_then_true', 'already_registered'].contains(scenario)) {
          expect(root.isFaceRegistered, isTrue);
          expect(find.text('Registration Successful. Your face is registered.'), findsOneWidget);
          expect(find.byType(FaceRegistrationRequired), findsNothing);
          expect(find.byType(MainScreen), findsOneWidget);
          expect(find.text('Verification Failed'), findsNothing);
          if (scenario == 'late_commit') expect(statusAfterPost, greaterThanOrEqualTo(2));
          if (scenario == 'false_then_true') expect(statusAfterPost, 3);
        } else if (['rejected', 'conflict_rejected'].contains(scenario)) {
          expect(root.isFaceRegistered, isFalse);
          expect(find.text('Verification Failed'), findsOneWidget);
          expect(statusAfterPost, scenario == 'rejected' ? 0 : 1,
              reason: 'A definite rejection does not need ambiguous-write polling');
        } else if (['status_timeout', 'unknown_then_refresh'].contains(scenario)) {
          expect(root.isFaceRegistered, isFalse);
          expect(find.text('Verification Failed'), findsNothing);
          final page = tester.widget<FaceRegistrationRequired>(find.byType(FaceRegistrationRequired));
          expect(page.pending, isTrue);
          expect(page.busy, isFalse);
          expect(statusAfterPost, 5);
          await root.registerFace(root.context);
          expect(find.byType(FaceScannerScreen), findsNothing);
          expect(posts, 1);
          registered = true;
          if (scenario == 'unknown_then_refresh') {
            root.didChangeAppLifecycleState(AppLifecycleState.resumed);
            for (var i = 0; i < 10; i++) { await tester.pump(const Duration(milliseconds: 50)); }
          } else {
            await page.onRefresh();
          }
          await tester.pump();
          expect(root.isFaceRegistered, isTrue);
          expect(find.text('Registration Successful. Your face is registered.'), findsOneWidget);
        } else if (['account_switch', 'account_switch_during_status'].contains(scenario)) {
          expect(root.isFaceRegistered, isFalse);
          expect(find.text('Registration Successful. Your face is registered.'), findsNothing);
        }
        for (var i = 1; i < statusTimes.length; i++) {
          expect(statusTimes[i].difference(statusTimes[i - 1]), greaterThanOrEqualTo(const Duration(seconds: 5)),
              reason: 'Status recovery must not hammer the backend');
        }
        expect(tester.takeException(), isNull);
        await tester.pumpWidget(const SizedBox.shrink()); await tester.pump();
        // Drain the dashboard's already-started websocket connection timeout.
        await tester.pump(const Duration(seconds: 11));
        await tester.binding.setSurfaceSize(null);
      }, () => MockClient((request) async {
        if (request.url.path == '/students/me/face/status') {
          if (posts > 0 && !registered) {
            statusAfterPost++;
            statusTimes.add(tester.binding.clock.now());
            if (scenario == 'false_then_true' && statusAfterPost == 3) registered = true;
            if (scenario == 'status_timeout') return Completer<http.Response>().future;
            if (scenario == 'account_switch_during_status') return delayedStatus.future;
          }
          return http.Response(jsonEncode({'is_face_registered': registered,
            'registration_version': registered ? 'saved' : null}), 200);
        }
        if (request.url.path == '/students/me/face') {
          posts++;
          if (scenario == 'normal') {
            registered = true;
            return http.Response('{"is_face_registered":true,"registration_version":"saved"}', 200);
          }
          if (scenario == 'rejected') return http.Response('{"detail":"Liveness could not be verified."}', 403);
          if (scenario == 'conflict_rejected') return http.Response('{"detail":"Your face registration status changed. Refresh and start a new scan."}', 409);
          if (scenario == 'already_registered') {
            registered = true;
            return http.Response('{"detail":"Your face is already registered."}', 409);
          }
          if (scenario == 'late_commit') {
            Timer(const Duration(seconds: 52), () {
              registered = true;
              delayedPost.complete(http.Response('{"is_face_registered":true,"registration_version":"saved"}', 200));
            });
            return delayedPost.future;
          }
          if (['account_switch', 'disposed'].contains(scenario)) return delayedPost.future;
          throw http.ClientException('synthetic connection interruption');
        }
        if (request.url.path.contains('languages')) return http.Response('{}', 200);
        if (request.url.path == '/auth/me') return http.Response('null', 200);
        if (request.url.path == '/auth/server-time') return http.Response(jsonEncode({'server_time': DateTime.now().toUtc().toIso8601String()}), 200);
        return http.Response('[]', 200);
      }));
    });
  }

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
