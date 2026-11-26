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
        { student_name: 'Synthetic Medium', attendance_rate: .5, risk_label: 'medium', risk_score: .4821, assessment_source: 'ML Prediction',
          risk_factors: 'Teaching 33% complete; needs 456 of the remaining 480 planned minutes (95%) to reach 80%; current attendance is below 80%' },
        { student_name: 'Synthetic High', attendance_rate: .625, risk_label: 'high', risk_score: .8912, assessment_source: 'ML Prediction',
          risk_factors: 'Teaching 42% complete; needs 1788 of the remaining 1920 planned minutes (94%) to reach 80%' },
        { student_name: 'Synthetic Certain', attendance_rate: .4, risk_label: 'high', risk_score: 1, assessment_source: 'Guaranteed High',
          risk_factors: 'Cannot reach 80% (best case 70%)' },
      ].map((row, index) => ({
        id: String(index), student_id: String(index), student_code: `ST000000${index}`, course_id: 'QA', course_code: 'QA101',
        updated_at: '2026-11-26T00:00:00Z', ...row,
      }));
      api.defaults.adapter = async config => {
        const response = data => ({ data, status: 200, statusText: 'OK', headers: {}, config });
        if (config.url === '/analytics/risk-scores') return response(fixture);
        if (config.url === '/lecturers/me/alerts/preview') return response({ ...fixture[0], assessment_token: 't', email_body: 'Please review your attendance record.' });
        if (config.url === '/lecturers/me/alerts') return response([]);
        throw new Error(`Unexpected mock request ${config.url}`);
      };
      createRoot(document.getElementById('root')).render(React.createElement(AtRisk));
    });
    await expect(page.getByText('not the probability of failing')).toBeVisible();
    await expect(page.getByText('Medium means early attention; High means priority intervention.')).toBeVisible();
    const medium = page.getByRole('row').filter({ hasText: 'Synthetic Medium' });
    await expect(medium).toContainText('Risk Score 0.48');
    await expect(medium.getByText('Teaching 33% complete', { exact: false })).toHaveAttribute('title', 'Teaching 33% complete; needs 456 of the remaining 480 planned minutes (95%) to reach 80%; current attendance is below 80%');
    await expect(page.getByRole('row').filter({ hasText: 'Synthetic High' })).toContainText('Risk Score 0.89');
    await expect(page.getByRole('row').filter({ hasText: 'Synthetic Certain' })).not.toContainText('Risk Score');
    await medium.getByRole('button', { name: 'Alert' }).click();
    await expect(page.getByText('QA101 · 50.0% · ML Prediction · Risk Score 0.48')).toBeVisible();
    await page.screenshot({ path: require('path').join(__dirname, 'artifacts', 'at_risk_ml_v2_ui.png'), fullPage: true });
    console.log('PASS At-Risk V2 Risk Score semantics, band meaning, data-based factors and warning preview score.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
