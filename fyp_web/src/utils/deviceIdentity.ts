// How this browser introduces itself at sign-in: a random id kept in this browser (so it is listed once however often it signs in)
// and a readable name such as "Chrome on Android · SM-S918B". Neither is secret; the server stores only a hash of the id.
const KEY = 'sas-browser-id';

export function browserId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) { id = crypto.randomUUID(); localStorage.setItem(KEY, id); }
    return id;
  } catch {
    return '';   // storage blocked (private mode): the server then lists this sign-in on its own
  }
}

const BROWSERS: Array<[RegExp, string]> = [[/Edg\//, 'Edge'], [/OPR\//, 'Opera'], [/SamsungBrowser\//, 'Samsung Internet'], [/FxiOS|Firefox\//, 'Firefox'],
  [/CriOS|Chrome\//, 'Chrome'], [/Safari\//, 'Safari']];
const SYSTEMS: Array<[RegExp, string]> = [[/iPhone/, 'iPhone'], [/iPad/, 'iPad'], [/Android/, 'Android'], [/Windows/, 'Windows'],
  [/Mac OS X|Macintosh/, 'macOS'], [/CrOS/, 'ChromeOS'], [/Linux/, 'Linux']];

export function describeBrowser(agent: string, model = '', touchMac = false): string {
  const browser = BROWSERS.find(([pattern]) => pattern.test(agent))?.[1];
  let system = SYSTEMS.find(([pattern]) => pattern.test(agent))?.[1];
  if (system === 'macOS' && touchMac) system = 'iPad';   // iPadOS Safari reports itself as a Mac
  const base = browser && system ? `${browser} on ${system}` : browser || system || 'Web browser';
  const androidModel = agent.match(/Android [\d.]+; ([^;)]+)\)/)?.[1]?.trim();
  const shown = (model || (androidModel && androidModel !== 'K' ? androidModel : '')).trim().slice(0, 40);   // "K": Chrome's hidden model
  return shown ? `${base} · ${shown}` : base;
}

type Hints = { getHighEntropyValues?: (keys: string[]) => Promise<{ model?: string }> };

/** Chromium can tell the real phone model ("SM-S918B") even when its User-Agent hides it; other browsers give only what their User-Agent says. */
export async function deviceName(): Promise<string> {
  const hints = (navigator as Navigator & { userAgentData?: Hints }).userAgentData;
  let model = '';
  try {
    const asked = hints?.getHighEntropyValues?.(['model']);
    const answer = asked && await Promise.race([asked, new Promise<undefined>(resolve => setTimeout(resolve, 300))]);
    model = answer?.model || '';
  } catch { /* no hints: the User-Agent is enough */ }
  return describeBrowser(navigator.userAgent, model, navigator.maxTouchPoints > 1);
}
