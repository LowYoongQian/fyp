// Regression for the state observed on Android: background sync survives logout.
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../fyp_flutter/lib/main.dart' as app;
import '../../fyp_flutter/lib/screens/security/login_screen.dart';

void main() {
  testWidgets('background student refresh cannot lock staff sign-in after logout', (tester) async {
    SharedPreferences.setMockInitialValues({});
    GoogleFonts.config.allowRuntimeFetching=false;
    await http.runWithClient(() async {
      await tester.pumpWidget(const app.MainApp());
      final dynamic root=tester.state(find.byType(app.AppRoot));
      for(var frame=0;frame<50 && root.isSyncing;frame++) {
        await tester.pump(const Duration(milliseconds:100));
      }
      expect(root.isSyncing,isFalse,reason:'Startup initialization must finish first');
      await tester.pump(const Duration(seconds:3)); // Wait for the separate opening intro.
      // A refresh can still be pending when logout clears both account states.
      root.selectedTab=2;
      root.handleStudentLogout();
      // Logout cancels its own progress; represent an independent pending refresh.
      root.isSyncing=true;
      await tester.pump();await tester.pump(const Duration(milliseconds:350));
      final form=tester.widget<LoginScreen>(find.byType(LoginScreen));
      expect(form.portalType,'staff');
      expect(root.isStudentLoggedIn,isFalse);expect(root.isStaffLoggedIn,isFalse);
      expect(root.isSyncing,isTrue,reason:'The test must retain the independent background operation');
      expect(form.isSyncing,isFalse,reason:'No staff authentication request is in progress');
      expect(tester.widget<ElevatedButton>(find.byType(ElevatedButton)).onPressed,isNotNull);
      expect(find.byType(ElevatedButton).hitTestable(),findsOneWidget,
          reason:'A background refresh must not leave a blocking loading overlay');
      await tester.pumpWidget(const SizedBox.shrink());await tester.pump();
    },()=>MockClient((request) async {
      if(request.url.path=='/auth/server-time') return http.Response(jsonEncode({'server_time':DateTime.now().toUtc().toIso8601String()}),200);
      if(request.url.path=='/public/announcements') return http.Response('[]',200);
      return http.Response('{}',200);
    }));
  });
}
