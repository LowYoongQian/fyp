// Android emulator integration against the isolated, migrated QA backend.
// SharedPreferences are an empty fixture; no real account or camera is used.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:http/http.dart' as http;
import 'package:fyp_flutter/main.dart' as app;
import 'package:fyp_flutter/screens/security/login_screen.dart';
import 'package:fyp_flutter/screens/student/face_registration_required.dart';
import 'package:fyp_flutter/screens/staff/staff_dashboard_screen.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  const server='http://10.0.2.2:58004';
  app.ApiConfig.pinIntegrationTestServer(server);
  Future<void> until(WidgetTester tester, bool Function() ready) async {
    final watch=Stopwatch()..start();
    while(!ready() && watch.elapsed < const Duration(seconds:45)) {
      await tester.pump(const Duration(milliseconds:200));
    }
    if(!ready()) {
      debugPrint(tester.widgetList<Text>(find.byType(Text)).map((text)=>text.data).whereType<String>().join(' | '));
      final dynamic current=tester.state(find.byType(app.AppRoot));
      debugPrint('QA_STATE syncing=${current.isSyncing} studentLoggedIn=${current.isStudentLoggedIn} staffLoggedIn=${current.isStaffLoggedIn}');
      for(final form in tester.widgetList<LoginScreen>(find.byType(LoginScreen))) {
        debugPrint('QA_FORM portal=${form.portalType} busy=${form.isSyncing}');
      }
    }
    expect(ready(),isTrue,reason:'Expected UI state within 45 seconds');
  }
  testWidgets('student login, mandatory face setup, logout revocation and staff portal', (tester) async {
    SharedPreferences.setMockInitialValues({'custom_api_url':server});
    app.ApiConfig.customUrl=server;
    app.ApiConfig.baseUrl=server;
    await tester.pumpWidget(const app.MainApp()); // Skip optional Firebase push bootstrap.
    await until(tester,()=>find.byType(BottomNavigationBar).evaluate().isNotEmpty && find.text('Student').last.hitTestable().evaluate().isNotEmpty);
    await tester.tap(find.text('Student').last);
    await until(tester,()=>find.byType(LoginScreen).evaluate().isNotEmpty);
    await until(tester,()=>tester.widget<ElevatedButton>(find.byType(ElevatedButton).first).onPressed!=null);
    await tester.enterText(find.byType(TextFormField).first,'qa-e2e-student@student.school.edu');
    await tester.enterText(find.byType(TextFormField).last,'Synthetic-E2E!123');
    await tester.ensureVisible(find.text('LOGIN'));
    await tester.tap(find.text('LOGIN'));
    await until(tester,()=>find.byType(FaceRegistrationRequired).evaluate().isNotEmpty);
    expect(find.textContaining('Synthetic E2E Student'),findsOneWidget);
    final dynamic state=tester.state(find.byType(app.AppRoot));
    final oldToken=state.studentAuthToken as String;
    expect(oldToken,isNotEmpty);
    expect(app.ApiConfig.getEffectiveUrl(),server);
    // A student without a linked recovery address is prompted after login.
    await until(tester,()=>find.text('Not now').hitTestable().evaluate().isNotEmpty || find.text('Sign out').hitTestable().evaluate().isNotEmpty);
    if(find.text('Not now').hitTestable().evaluate().isNotEmpty) {
      await tester.tap(find.text('Not now'));
      await until(tester,()=>find.text('Skip for now').hitTestable().evaluate().isNotEmpty);
      await tester.tap(find.text('Skip for now'));await tester.pump();
    }
    await tester.ensureVisible(find.text('Sign out'));
    await until(tester,()=>find.text('Sign out').hitTestable().evaluate().isNotEmpty);
    await tester.tap(find.text('Sign out'));
    await until(tester,()=>find.byType(LoginScreen).evaluate().isNotEmpty && find.byType(FaceRegistrationRequired).evaluate().isEmpty);
    expect(find.byType(FaceRegistrationRequired),findsNothing);
    // Logout network completion is asynchronous; poll its observable server effect.
    final client=http.Client();addTearDown(client.close);
    var status=200;
    for(var attempt=0;attempt<20 && status!=401;attempt++) {
      status=(await client.get(Uri.parse('$server/auth/me'),headers:{'Authorization':'Bearer $oldToken'})).statusCode;
      if(status!=401) await Future<void>.delayed(const Duration(milliseconds:100));
    }
    expect(status,401);
    await until(tester,()=>find.text('Staff').last.hitTestable().evaluate().isNotEmpty);
    await tester.tap(find.text('Staff').last);
    final staffForm=find.byWidgetPredicate((widget)=>widget is LoginScreen && widget.portalType=='staff');
    await until(tester,()=>staffForm.evaluate().isNotEmpty);
    final fields=find.descendant(of:staffForm,matching:find.byType(TextFormField));
    await tester.enterText(fields.first,const String.fromEnvironment('QA_STAFF_ID'));
    await tester.enterText(fields.last,'Synthetic!123');
    final submit=find.descendant(of:staffForm,matching:find.text('LOGIN'));
    await until(tester,()=>submit.evaluate().length==1);
    await tester.ensureVisible(submit);await until(tester,()=>submit.hitTestable().evaluate().isNotEmpty);await tester.tap(submit);
    await until(tester,()=>find.byType(StaffDashboard).evaluate().isNotEmpty);
    await until(tester,()=>find.textContaining('UI Synthetic Teacher').hitTestable().evaluate().isNotEmpty);
    expect(find.textContaining('UI Synthetic Teacher'),findsWidgets);
    expect(find.textContaining('Synthetic E2E Student'),findsNothing);
    expect(state.studentAuthToken,isEmpty);
    expect(state.staffAuthToken,isNotEmpty);
    await tester.pumpWidget(const SizedBox.shrink()); // Dispose pollers and subscriptions.
    await tester.pump();
  });
}
