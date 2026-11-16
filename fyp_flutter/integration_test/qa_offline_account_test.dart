// The host disables only the audited read-only guest's network, then restores it.
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/foundation.dart';
import 'package:integration_test/integration_test.dart';
import 'package:http/http.dart' as http;
import 'qa_account_isolation_test.dart' as fixture;
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets('student B stays isolated during an actual emulator network outage',(tester) async {
    expect(const bool.fromEnvironment('QA_READ_ONLY_GUEST'),isTrue);
    final root=await fixture.rootFor(tester);
    await fixture.login(root,'A');await fixture.sync(tester,root);
    expect(root.attendanceHistory.toString(),contains(fixture.privateA));
    root.handleStudentLogout();await fixture.login(root,'B');await fixture.sync(tester,root);
    expect(root.attendanceHistory.toString(),contains(fixture.privateB));
    // The host watches this marker and changes the guest network using ADB.
    debugPrint('QA_OFFLINE_READY');
    var networkFailed=false;
    for(var attempt=0;attempt<15 && !networkFailed;attempt++) {
      try {await http.get(Uri.parse('${fixture.qaServer}/auth/server-time')).timeout(const Duration(seconds:2));}
      catch (_) {networkFailed=true;}
      if(!networkFailed) await tester.pump(const Duration(seconds:1));
    }
    expect(networkFailed,isTrue,reason:'A real transport failure must be observed; HTTP503 alone is insufficient');
    await fixture.sync(tester,root);
    expect(root.isDatabaseOffline,isTrue);
    expect(root.attendanceHistory.toString(),contains(fixture.privateB));
    expect(root.attendanceHistory.toString(),isNot(contains(fixture.privateA)));
    expect(root.studentSchedule.toString(),isNot(contains(fixture.privateA)));
    expect(root.studentAnnouncements.toString(),isNot(contains(fixture.privateA)));
    debugPrint('QA_RESTORE_NETWORK');
    var restored=false;
    for(var attempt=0;attempt<20 && !restored;attempt++) {
      try {restored=(await http.get(Uri.parse('${fixture.qaServer}/auth/server-time')).timeout(const Duration(seconds:2))).statusCode==200;}
      catch (_) {}
      if(!restored) await tester.pump(const Duration(seconds:1));
    }
    expect(restored,isTrue);
    await fixture.sync(tester,root);expect(root.isDatabaseOffline,isFalse);
    expect(root.attendanceHistory.toString(),contains(fixture.privateB));
    debugPrint('QA_OFFLINE_PROOF: native transport failed; B-only cache; restored without cross-account data');
  });
}
