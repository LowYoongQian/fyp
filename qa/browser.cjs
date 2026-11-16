// Resolve only the committed QA dependency manifest; no personal installation paths.
const {chromium, expect} = require('@playwright/test');
function localUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.username || url.password) {
    throw new Error('Only synthetic loopback HTTP targets are accepted');
  }
  return value;
}
module.exports = {chromium, expect, localUrl};
