const { chromium, expect, localUrl } = require('../../qa/browser.cjs');

(async () => {
  const url = localUrl(process.env.FYP_TEST_WEB_URL || 'http://127.0.0.1:5187');
  const origin = new URL(url).origin;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.route('**/at-risk-test', route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
    await page.goto(url + '/at-risk-test');
    await page.evaluate(async () => {
      const refresh = (await import('/@react-refresh')).default;
      refresh.injectIntoGlobalHook(window);
      window.$RefreshReg$ = () => {};
      window.$RefreshSig$ = () => type => type;
      window.__vite_plugin_react_preamble_installed__ = true;
      const React = (await import('/node_modules/.vite/deps/react.js')).default;
      const { createRoot } = (await import('/node_modules/.vite/deps/react-dom_client.js')).default;
      const { api } = await import('/src/services/api.ts');
      const { AtRisk } = await import('/src/pages/staff/AtRisk.tsx');
      const fixture = [
        { student_name: 'Synthetic Low', attendance_rate: .91, risk_label: 'low', risk_score: 0, assessment_source: 'Guaranteed Low' },
        { student_name: 'Synthetic Observing', attendance_rate: .8, assessment_source: 'Observing' },
        { student_name: 'Synthetic Incomplete', assessment_source: 'Plan Incomplete' },
        { student_name: 'Synthetic Unavailable', attendance_rate: .79999, assessment_source: 'Model Unavailable' },
      ].map((row, index) => ({
        id: String(index), student_id: String(index), student_code: `ST000000${index}`, course_id: 'QA', course_code: 'QA101',
        risk_label: null, risk_score: null, attendance_rate: null, updated_at: '2026-11-25T00:00:00Z', ...row,
      }));
      window.warningRequests = [];
      api.defaults.adapter = async config => {
        const response = data => ({ data, status: 200, statusText: 'OK', headers: {}, config });
        const path = config.url;
        if (path === '/analytics/risk-scores') return response(fixture);
        if (path === '/lecturers/me/alerts/preview') return response({
          assessment_token: 'current-assessment', email_body: 'Please review your attendance record.',
          attendance_rate: .98, risk_label: 'low', risk_score: 0, assessment_source: 'Guaranteed Low',
          risk_factors: 'The 80% requirement is already secured', updated_at: '2026-11-25T00:01:00Z',
        });
        if (path === '/lecturers/me/alerts' && config.method === 'post') {
          window.warningRequests.push(JSON.parse(config.data));
          return response({ delivery_status: 'accepted' });
        }
        if (path === '/lecturers/me/alerts') return response([]);
        throw new Error(`Unexpected mock request ${path}`);
      };
      createRoot(document.getElementById('root')).render(React.createElement(AtRisk));
    });
    await expect(page.getByRole('row').filter({ hasText: 'Synthetic Unavailable' })).toContainText('79.9%');
    await expect(page.getByText('Plan Incomplete', { exact: true })).toBeVisible();
    await expect(page.getByText('Model Unavailable', { exact: true })).toBeVisible();
    await expect(page.getByText('Observing', { exact: true })).toBeVisible();
    await page.getByPlaceholder('Search name, code, or course...').fill('Synthetic Low');
    await expect(page.getByText('Synthetic Unavailable')).toHaveCount(0);
    await page.getByRole('row').filter({ hasText: 'Synthetic Low' }).getByRole('button', { name: 'Alert' }).click();
    await expect(page.getByText('QA101 · 98.0% · Guaranteed Low')).toBeVisible();
    await expect(page.locator('textarea')).toHaveValue('Please review your attendance record.');
    await page.getByRole('button', { name: 'Dispatch Warning' }).click();
    await expect.poll(() => page.evaluate(() => window.warningRequests)).toMatchObject([
      { student_id: '0', course_id: 'QA', assessment_token: 'current-assessment', email_body: 'Please review your attendance record.' },
    ]);
    console.log('PASS At-Risk statuses, threshold display, search and refreshed Low Risk warning preview/dispatch.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
