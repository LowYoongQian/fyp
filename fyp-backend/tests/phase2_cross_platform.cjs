// Real React UI login and the real application API module read the Android result.
// Camera/model/network and business clock remain the explicit QA host boundaries.
const {chromium,localUrl}=require('../../qa/browser.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const scenarioFile=process.env.FYP_QA_SCENARIO || path.resolve(__dirname,'../../qa/.runtime/attendance-scenario.json');
const directory=path.dirname(scenarioFile);
const scenario=JSON.parse(fs.readFileSync(scenarioFile,'utf8'));
assert.equal(scenario.synthetic_only,true);
assert.match(scenario.database,/^qa_migration_[0-9a-f]{12}$/);
const api=localUrl('http://127.0.0.1:58006'),web=localUrl('http://127.0.0.1:5200');
(async()=>{
 const environment=await (await fetch(api+'/qa/environment')).json();
 assert.equal(environment.synthetic_only,true);
 assert.equal(environment.database,scenario.database,'Server identity must match the freshly generated synthetic scenario before login');
 const browser=await chromium.launch();const proof=[];
 try {
  for(const role of ['A','B','teacher','admin']) {
   const context=await browser.newContext();const page=await context.newPage();
   await context.addInitScript(mode=>sessionStorage.setItem('active_portal_mode',mode),['A','B'].includes(role)?'student':'staff');
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   try {
    await page.goto(web+'/login');
    const email=role==='admin'?'qa-e2e-admin@staff.school.edu':role==='teacher'?scenario.teacher_email:scenario.students[role].email;
    await page.locator('input[autocomplete=username]').fill(email);
    await page.locator('input[type=password]').fill(role==='admin'?'Synthetic-E2E!123':'Synthetic!123');
    const pending=page.waitForResponse(r=>r.url()===api+'/auth/login' && r.request().method()==='POST');
    await page.getByRole('button',{name:'Sign In',exact:true}).click();
    assert.equal((await pending).status(),200);
    await page.waitForFunction(()=>!!sessionStorage.getItem('auth_token'));
    const result=await page.evaluate(async ({role,s,api})=>{
     const {api:client}=await import('/src/services/api.ts');
     if(client.defaults.baseURL!==api) throw Error('Wrong synthetic API target');
     const me=(await client.get('/auth/me')).data;
     if(['A','B'].includes(role)) {
      const history=(await client.get('/students/me/attendance')).data;
      const records=history.filter(r=>r.course_code===s.course_code);
      const ledger=(await client.get('/students/me/attendance-sessions')).data;
      const held=ledger.find(r=>r.session_id===s.session_id);
      const enrolment=(await client.get('/students/me/enrolments')).data.find(e=>e.course_id===s.course_id);
      const profile=(await client.get('/students/me/profile')).data;
      return {role:me.role,user_id:me.user_id,profileName:profile.name,records,held,rate:enrolment.attendance_rate};
     }
     const endpoint=role==='admin'?`/admin/sessions/${s.session_id}/attendance?programme_id=${s.programme_id}&course_id=${s.course_id}`:`/sessions/${s.session_id}/attendance`;
     const records=(await client.get(endpoint)).data.attendance_list;
     return {role:me.role,A:records.find(r=>r.student_id===s.students.A.id),B:records.find(r=>r.student_id===s.students.B.id)};
    },{role,s:scenario,api});
    assert.equal(errors.length,0,JSON.stringify(errors));
    if(['A','B'].includes(role)) {
     assert.equal(result.user_id,scenario.students[role].user_id);
     assert.equal(result.records.length,role==='A'?1:0); // Event history contains actual marks; absences use the held-session ledger.
     assert.equal(result.held.status,role==='A'?'present':'absent');
     if(role==='A') assert.equal(result.records[0].status,'present');
     assert.equal(result.rate,role==='A'?100:0);
     assert.equal(result.profileName,'Phase2 Synthetic Student '+role);
    } else {
     assert.equal(result.A.status,'present');
     // B never checked in: every projection must deny a present/leave mark and time.
     // Raw unmarked vs absent display semantics are retained for review, not declared equivalent UX.
     assert.ok(['unmarked','absent'].includes(result.B.status));assert.equal(result.B.marked_at,null);
    }
    proof.push({scenario:'Web '+role+' reads Android attendance result',status:'PASS',result});
    await page.screenshot({path:path.join(directory,'cross-web-'+role+'.png'),fullPage:false});
   } finally {await context.close();}
  }
  const a=proof[0].result.records[0];
  assert.equal(a.marked_at,proof[2].result.A.marked_at);assert.equal(a.marked_at,proof[3].result.A.marked_at);
  fs.writeFileSync(path.join(directory,'cross-platform-web.json'),JSON.stringify({layer:'Real React UI login + real API module + migrated PostgreSQL; Android submission callback used synthetic model/network boundaries',results:proof,threeRoleTimestampAgreement:'PASS'},null,2));
  console.log('PASS: four browser identities; A present100%, B absent0%; Student/Staff/Admin timestamp agreement');
 } catch(error) {
  fs.writeFileSync(path.join(directory,'cross-platform-web-failure.json'),JSON.stringify({error:error.stack,completed:proof},null,2));throw error;
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
