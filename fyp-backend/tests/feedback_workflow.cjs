const {chromium,expect,localUrl} = require('../../qa/browser.cjs');
const assert = require('node:assert/strict');
const users=JSON.parse(process.env.FEEDBACK_USERS), api=localUrl(process.env.FEEDBACK_API);
(async()=>{
 const browser=await chromium.launch();
 try {
  async function account(index,route){
   const context=await browser.newContext();
   const response=await context.request.post(api+'/auth/login',{data:{identifier:users[index].email,password:'Local-test!42'}});
   assert.equal(response.status(),200,await response.text());
   const session=await response.json();
   await context.addInitScript(session=>{
    sessionStorage.setItem('auth_token',session.access_token);
    sessionStorage.setItem('auth_user',JSON.stringify(session));
    sessionStorage.setItem('auth_session_expires_at',String(Date.now()+3600000));
   },session);
   const page=await context.newPage(); page.setDefaultTimeout(15000);
   page.on('pageerror',e=>console.error('Browser error:',e.message));
   await page.route('**/*',async r=>{
    const u=new URL(r.request().url());
    if (u.port==='8003') return r.continue({url:api+u.pathname+u.search});
    return r.continue();
   });
   await page.goto('http://127.0.0.1:5183'+route); return page;
  }
  const student=await account(0,'/student/contact-admin');
  await student.getByRole('button',{name:'New Complaint Ticket'}).click();
  const subject='Browser feedback '+Date.now();
  await student.getByPlaceholder('e.g. Marked absent for BMCS2073 lecture on 24th July').fill(subject);
  await student.getByPlaceholder('Please describe your inquiry, date of class, and any error message received...').fill('Verify that my complaint and proof reach the administrator.');
  await student.locator('input[type=file]').setInputFiles({name:'proof.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nBrowser proof\n%%EOF')});
  await expect(student.getByText('proof.pdf',{exact:true})).toBeVisible();
  const submitted=student.waitForResponse(r=>r.url().endsWith('/students/me/feedback') && r.request().method()==='POST');
  await student.getByRole('button',{name:'Submit Ticket',exact:true}).click();
  const submittedResponse=await submitted;
  assert.equal(submittedResponse.status(),201,await submittedResponse.text());
  await expect(student.getByText('Complaint Ticket Created',{exact:true})).toBeVisible();
  await student.reload();
  await expect(student.getByText(subject,{exact:true})).toBeVisible();
  const admin=await account(2,'/admin/reports/feedback');
  const row=admin.getByRole('row').filter({hasText:subject});
  await row.getByRole('button').click();
  const download=admin.waitForEvent('download');
  await admin.getByRole('button',{name:'Download proof.pdf'}).click();
  const file=await download; assert.equal(file.suggestedFilename(),'proof.pdf');
  const stream=await file.createReadStream(); const chunks=[]; for await(const part of stream) chunks.push(part);
  assert.equal(Buffer.concat(chunks).toString(),'%PDF-1.4\nBrowser proof\n%%EOF');
  await admin.getByRole('radio',{name:'High',exact:true}).click();
  await admin.locator('textarea').fill('Browser reply: investigated and resolved.');
  await admin.getByRole('button',{name:'Mark Completed',exact:true}).click();
  await expect(admin.getByText('Status Updated',{exact:true})).toBeVisible();
  await student.reload();
  await expect(student.getByText('Browser reply: investigated and resolved.',{exact:true})).toBeVisible();
  const other=await account(1,'/student/contact-admin');
  await expect(other.getByText('No Complaint Tickets Found')).toBeVisible();
  await expect(other.getByText(subject,{exact:true})).toHaveCount(0);
  await student.screenshot({path:require('node:path').join(__dirname,'artifacts','feedback-student-success.png'),fullPage:true});
  console.log('PASS real UI submission, refresh persistence, admin attachment bytes, admin reply, student reply and account isolation');
 } catch(error) {
  let index=0;
  for(const context of browser.contexts()) for(const page of context.pages()) {
   console.error((await page.locator('body').innerText()).slice(-1800));
   await page.screenshot({path:require('node:path').join(__dirname,'artifacts',`feedback-failure-${index++}.png`),fullPage:true});
  }
  throw error;
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
