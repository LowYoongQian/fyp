const {chromium, localUrl} = require('../../qa/browser.cjs');
const webUrl=localUrl(process.env.FYP_TEST_WEB_URL || 'http://127.0.0.1:5183');
require('node:fs').mkdirSync(require('node:path').join(__dirname,'artifacts'),{recursive:true});
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch();
  let failures = 0;
  try {
    for (const scenario of ['account', 'POST', 'PUT', 'PATCH', 'DELETE', 'late']) {
      const page = await browser.newPage();
      await page.context().tracing.start({screenshots:true,snapshots:true});
      page.on('pageerror', e => console.error('PAGE ERROR', e.message));
      try {
        // A minimal document loads the actual application modules, without unrelated pages.
        await page.route('**/cache-test', r => r.fulfill({contentType:'text/html', body:'<div id="root"></div>'}));
        await page.goto(webUrl + '/cache-test');
        const result = await page.evaluate(async scenario => {
          const {api, cachedGet, clearApiCache} = await import('/src/services/api.ts');
          sessionStorage.setItem('auth_user', JSON.stringify({user_id:2,role:'student',email:'b@test'}));
          sessionStorage.setItem('auth_token','test');
          sessionStorage.setItem('auth_session_expires_at',String(Date.now()+3600000));
          let value = 'old';
          api.defaults.adapter = async config => ({data:value,status:200,statusText:'OK',headers:{},config});
          if (scenario === 'account') {
            localStorage.setItem('cached_student_profile',JSON.stringify({full_name:'PRIVATE_A',student_code:'PRIVATE_A'}));
            localStorage.setItem('cached_student_enrolments','[]');
            localStorage.setItem('cached_student_active_sessions','[]');
            api.defaults.adapter = async config => {
              if (config.url === '/auth/me') return {status:200,headers:{},config,data:{user_id:2,role:'student',email:'b@test'}};
              throw new Error('Simulated dashboard offline');
            };
            const RefreshRuntime = (await import('/@react-refresh')).default;
            RefreshRuntime.injectIntoGlobalHook(window);
            window.$RefreshReg$ = () => {};
            window.$RefreshSig$ = () => type => type;
            window.__vite_plugin_react_preamble_installed__ = true;
            const React = (await import('/node_modules/.vite/deps/react.js')).default;
            const {createRoot} = (await import('/node_modules/.vite/deps/react-dom_client.js')).default;
            const {AuthProvider, useAuth} = await import('/src/context/AuthContext.tsx');
            const {StudentDashboard} = await import('/src/pages/student/StudentDashboard.tsx');
            function Harness() {
              const auth = useAuth();
              window.switchTestAccount = async id => {
                await auth.logout();
                api.defaults.adapter = async config => ({status:200,headers:{},config,data:
                  config.url === '/auth/login' ? {user_id:id,role:'student',access_token:'test'} :
                  config.url === '/students/me/profile' ? {student_code:`ACCOUNT_${id}`,full_name:`ACCOUNT_${id}`} :
                  config.url === '/auth/me' ? {user_id:id,role:'student',email:id+'@test'} : []});
                await auth.login(`${id}@test`,'test');
              };
              return React.createElement(StudentDashboard);
            }
            createRoot(document.getElementById('root')).render(React.createElement(AuthProvider,null,React.createElement(Harness)));
            return true;
          }
          if (scenario === 'late') {
            let finish;
            api.defaults.adapter = config => new Promise(resolve => {finish = () => resolve({data:'old',status:200,headers:{},config});});
            const pending = cachedGet('/cache-probe');
            await new Promise(resolve=>setTimeout(resolve,0));
            clearApiCache();
            api.defaults.adapter = async config => ({data:'new',status:200,headers:{},config});
            await cachedGet('/cache-probe');
            finish(); await pending;
          } else {
            await cachedGet('/cache-probe');
            value = 'new';
            await api.request({method:scenario,url:'/cache-probe'});
          }
          return await cachedGet('/cache-probe');
        },scenario);
        if (scenario === 'account') {
          await page.waitForFunction(()=>document.body.innerText.includes('Unable to load') || document.body.innerText.includes('PRIVATE_A'),{},{timeout:10000});
          assert.equal((await page.locator('body').innerText()).includes('PRIVATE_A'),false);
          for (const id of [3,4]) {
            await page.evaluate(id=>window.switchTestAccount(id),id);
            await page.waitForFunction(id=>document.body.innerText.includes(`ACCOUNT_${id}`),id);
            assert.equal((await page.locator('body').innerText()).includes(id===3?'PRIVATE_A':'ACCOUNT_3'),false);
          }
          console.log('PASS account switching through auth');
        } else assert.equal(result,'new');
        if (scenario !== 'account') {
          await page.reload();
          assert.equal(await page.evaluate(async()=>{
            const {api,cachedGet}=await import('/src/services/api.ts');
            api.defaults.adapter=async config=>({data:'new',status:200,headers:{},config});
            return cachedGet('/cache-probe');
          }),'new');
          console.log('PASS refresh',scenario);
        }
        console.log('PASS',scenario);
      } catch(e) { failures++; console.error('FAIL',scenario,e.message.slice(0,200)); console.error('BODY', (await page.locator('body').innerText()).slice(0,1500)); await page.screenshot({path:require('node:path').join(__dirname,'artifacts', 'cache-'+scenario+'.png')}); await page.context().tracing.stop({path:require('node:path').join(__dirname,'artifacts','cache-'+scenario+'-trace.zip')}); }
      finally { await page.close(); }
    }
  } finally {await browser.close();}
  if(failures) process.exitCode=1;
})();
