const path = require('node:path');
const assert = require('node:assert/strict');
const {chromium, expect, localUrl} = require('../../qa/browser.cjs');
localUrl(process.env.MC_API);
const data = JSON.parse(process.env.MC_SCENARIO);
const origin = 'http://127.0.0.1:5179';

(async () => {
  const browser = await chromium.launch();
  const contexts = [];
  async function account(role, route) {
    const context = await browser.newContext(); contexts.push(context);
    const response = await context.request.post(`${process.env.MC_API}/auth/login`, {
      data: {identifier:data[`${role}_email`],password:data.password}
    });
    assert.equal(response.status(),200);
    const session = await response.json();
    await context.addInitScript(session => {
      sessionStorage.setItem('auth_token',session.access_token);
      sessionStorage.setItem('auth_user',JSON.stringify(session));
      sessionStorage.setItem('auth_session_expires_at',String(Date.now()+3600000));
    },session);
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    await page.goto(origin+route);
    return {page,session,context};
  }
  let student, admin;
  try {
    student = await account('student','/student/medical-leave');
    const p=student.page;
    await p.getByRole('button',{name:'New Request',exact:true}).click();
    await p.getByRole('button',{name:'Select start date',exact:true}).click();
    await p.getByRole('button',{name:String(Number(data.today.slice(-2))),exact:true}).click();
    await p.getByRole('button',{name:'Select end date',exact:true}).click();
    if(data.today.slice(0,7)!==data.tomorrow.slice(0,7)) await p.getByRole('button',{name:'Next month'}).click();
    await p.getByRole('button',{name:String(Number(data.tomorrow.slice(-2))),exact:true}).click();
    await p.getByPlaceholder('Add a short reason...').fill('Playwright medical recovery');
    await p.locator('input[type=file]').setInputFiles({name:'proof.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')});
    const submitted=p.waitForResponse(r=>r.url().endsWith('/students/me/medical-leave')&&r.request().method()==='POST');
    await p.getByRole('button',{name:'Submit Leave',exact:true}).click();
    const response=await submitted;
    assert.equal(response.status(),201,await response.text());
    const request=await response.json();
    admin=await account('admin','/admin/reports/medical-leave');
    const a=admin.page;
    const row=a.getByRole('row').filter({hasText:data.course_code});
    await row.getByRole('button',{name:'Inspect MC Proof'}).click();
    await expect(a.getByAltText('Medical Certificate Proof')).toBeVisible();
    await expect.poll(()=>a.getByAltText('Medical Certificate Proof').evaluate(el=>el.complete&&el.naturalWidth>0)).toBe(true);
    await a.getByRole('button',{name:'Approve MC',exact:true}).click();
    await a.getByRole('button',{name:'Yes, Approve MC',exact:true}).click();
    await expect(a.getByText('MC Updated',{exact:true})).toBeVisible();
    await p.reload();
    await expect(p.getByRole('row').filter({hasText:'Playwright medical recovery'}).getByText('Approved',{exact:true})).toBeVisible();
    const h={Authorization:`Bearer ${student.session.access_token}`};
    const enrolments=await (await student.context.request.get(`${process.env.MC_API}/students/me/enrolments`,{headers:h})).json();
    assert.equal(enrolments[0].attendance_rate,100);
    await p.screenshot({path:path.join(__dirname,'artifacts','mc-student-success.png'),fullPage:true});
    console.log('PASS: real browser multipart upload, real proof preview, admin approval, student Approved, actual attendance rate 100%; request '+request.id);
  } catch(error) {
    for(const [name,user] of [['student',student],['admin',admin]]) if(user) {
      console.error(name, (await user.page.locator('body').innerText()).slice(-2400));
      await user.page.screenshot({path:path.join(__dirname,'artifacts',`mc-${name}-failure.png`)});
    }
    throw error;
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
