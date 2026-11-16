import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../fyp_flutter/lib/screens/security/login_screen.dart';

void main() {
  setUpAll(() { GoogleFonts.config.allowRuntimeFetching = false; });
  Future<void> show(WidgetTester tester, {String portal='student', bool busy=false, required Function(String,String,String) login}) async {
    await tester.binding.setSurfaceSize(const Size(800,1400));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(MaterialApp(home:Scaffold(body:LoginScreen(portalType:portal,isSyncing:busy,onLogin:login,onBackPressed:(){}))));
    await tester.pumpAndSettle();
  }
  testWidgets('student must enter school email and password before authentication', (tester) async {
    var calls=0;
    await show(tester,login:(a,b,c){calls++;});
    await tester.tap(find.text('LOGIN')); await tester.pumpAndSettle();
    expect(find.text('School email is required'),findsOneWidget);
    expect(find.text('Password is required'),findsOneWidget);
    await tester.enterText(find.byType(TextFormField).first,'ST9000001');
    await tester.enterText(find.byType(TextFormField).last,'Synthetic!123');
    await tester.tap(find.text('LOGIN')); await tester.pumpAndSettle();
    expect(find.text('Use your school email'),findsOneWidget);
    expect(calls,0);
  });
  testWidgets('staff ID and portal are passed to authentication', (tester) async {
    List<String>? submitted;
    await show(tester,portal:'staff',login:(a,b,c){submitted=[a,b,c];});
    await tester.enterText(find.byType(TextFormField).first,'T900001');
    await tester.enterText(find.byType(TextFormField).last,'Synthetic!123');
    await tester.tap(find.text('LOGIN')); await tester.pumpAndSettle();
    expect(submitted,['T900001','Synthetic!123','staff']);
  });
  testWidgets('password visibility toggle preserves password input', (tester) async {
    await show(tester,login:(a,b,c){});
    await tester.enterText(find.byType(TextFormField).last,'Synthetic!123');
    expect(tester.widget<EditableText>(find.byType(EditableText).last).obscureText,isTrue);
    await tester.tap(find.byTooltip('Show password')); await tester.pumpAndSettle();
    final input=tester.widget<EditableText>(find.byType(EditableText).last);
    expect(input.obscureText,isFalse); expect(input.controller.text,'Synthetic!123');
  });
  testWidgets('busy authentication disables fields and submit', (tester) async {
    // The progress indicator animates continuously, so do not pumpAndSettle.
    await tester.pumpWidget(MaterialApp(home:Scaffold(body:LoginScreen(portalType:'student',isSyncing:true,onLogin:(a,b,c){fail('duplicate authentication');},onBackPressed:(){}))));
    await tester.pump();
    expect(tester.widget<ElevatedButton>(find.byType(ElevatedButton)).onPressed,isNull);
    for (final input in tester.widgetList<TextFormField>(find.byType(TextFormField))) { expect(input.enabled,isFalse); }
  });
}
