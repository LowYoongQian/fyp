import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import '../../fyp_flutter/lib/services/offline_checkin_sync.dart';

void main() {
  final row = <String,Object?>{'session_id':'class-id','request_id':newCheckInId(),
    'queued_at':'2026-10-09T01:00:00Z', 'payload_json':jsonEncode({'wifi_ssid':'old','image_base64':'photo'})};
  test('lost response reconciles before replaying photo', () async {
    var calls=0;
    final result=await syncOfflineCheckIn(client:MockClient((r) async {
      calls++; expect(r.url.path, contains('reconcile'));
      return http.Response('{"status":"synced"}',200);
    }),server:'https://test.invalid',token:'A',row:row,
      networkFacts:() async => throw StateError('must not collect'),stillCurrent:()=>true);
    expect(result.status,'synced'); expect(calls,1);
  });
  test('open class retries with fresh network facts and original photo', () async {
    final result=await syncOfflineCheckIn(client:MockClient((r) async {
      if(r.url.path.endsWith('reconcile')) return http.Response('{"status":"retry_checkin"}',200);
      final payload=jsonDecode(r.body);
      expect(payload['wifi_ssid'],'current'); expect(payload['image_base64'],'photo');
      expect(r.headers['Authorization'],'Bearer A');
      return http.Response('{}',200);
    }),server:'https://test.invalid',token:'A',row:row,
      networkFacts:() async => {'wifi_ssid':'current'},stillCurrent:()=>true);
    expect(result.status,'synced');
  });
  for(final status in ['needs_review','rejected','excused']) {
    test('$status never reposts the original photo', () async {
      var calls=0;
      final result=await syncOfflineCheckIn(client:MockClient((r) async {
        calls++; return http.Response(jsonEncode({'status':status}),200);
      }),server:'https://test.invalid',token:'A',row:row,
        networkFacts:() async => throw StateError('must not replay'),stillCurrent:()=>true);
      expect(result.status,status); expect(calls,1);
    });
  }
  test('account change during network collection cancels submission', () async {
    var current=true, calls=0;
    final result=await syncOfflineCheckIn(client:MockClient((r) async {
      calls++; return http.Response('{"status":"retry_checkin"}',200);
    }),server:'https://test.invalid',token:'A',row:row,
      networkFacts:() async {current=false;return {};},stillCurrent:()=>current);
    expect(result.status,'pending'); expect(calls,1);
  });
  test('connection errors retain pending data', () async {
    final result=await syncOfflineCheckIn(client:MockClient((r) async => throw http.ClientException('offline')),
      server:'https://test.invalid',token:'A',row:row,networkFacts:() async => {},stillCurrent:()=>true);
    expect(result.status,'pending');
  });
  test('close between reconciliation and submission transitions to review', () async {
    var n=0;
    final result=await syncOfflineCheckIn(client:MockClient((r) async {
      n++;
      return http.Response(n==1?'${jsonEncode({'status':'retry_checkin'})}':n==2?'{}':'{"status":"needs_review"}',n==2?400:200);
    }),server:'https://test.invalid',token:'A',row:row,networkFacts:() async => {},stillCurrent:()=>true);
    expect(result.status,'needs_review'); expect(n,3);
  });
}
