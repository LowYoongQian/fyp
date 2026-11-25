import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../fyp_flutter/lib/main.dart';
import '../../fyp_flutter/lib/screens/student/full_timetable_screen.dart';

void main() {
  testWidgets('changing week uses the rule active on that Malaysia date', (tester) async {
    GoogleFonts.config.allowRuntimeFetching = false;
    final previousOffset = ApiConfig.serverOffset;
    ApiConfig.serverOffset = DateTime.utc(2026, 11, 23, 2).difference(DateTime.now().toUtc());
    addTearDown(() => ApiConfig.serverOffset = previousOffset);
    final requested = <DateTime>[];
    List<Map<String, dynamic>> schedule(String course) => [{
      'courseName': course,
      'courseCode': 'S101',
      'day': 'Monday',
      'startTime': '10:00',
      'endTime': '12:00',
      'room': 'Synthetic room',
      'semester': {'id': 'QA', 'name': 'Synthetic Term', 'start_date': '2026-11-23', 'end_date': '2026-12-18'},
    }];
    await tester.pumpWidget(MaterialApp(home: FullTimetableScreen(
      schedule: schedule('Current rule'),
      onRefresh: () async => schedule('Current rule'),
      onWeek: (date) async {
        requested.add(date);
        return schedule('Revised rule');
      },
    )));
    await tester.pump();
    expect(find.textContaining('CURRENT RULE'), findsOneWidget);
    await tester.tap(find.byTooltip('Next week'));
    await tester.pump();
    expect(requested, [DateTime.utc(2026, 11, 30)]);
    expect(find.textContaining('REVISED RULE'), findsOneWidget);
    expect(find.textContaining('CURRENT RULE'), findsNothing);
    await tester.tap(find.text('Today'));
    await tester.pump();
    expect(find.textContaining('CURRENT RULE'), findsOneWidget);
  });
}
