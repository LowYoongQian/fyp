import { useState } from 'react';
import { ArrowLeft, Check, Copy, Home, LogIn, RotateCw } from 'lucide-react';
import { goTo } from '../../utils/publicRoute';
import { PublicHeader } from './PublicHeader';
import './errorPage.css';

/** What each error means in plain words, and what the visitor can do next. Unknown codes read as 500. */
const ERRORS: Record<number, { name: string; title: string; text: string; retry?: boolean; signIn?: boolean }> = {
  400: { name: 'Bad Request', title: 'That link looks broken', text: 'Part of the address is not right. Check it, or start again from the home page.' },
  401: { name: 'Unauthorized', title: 'Please sign in first', text: 'This page needs you to be signed in.', signIn: true },
  403: { name: 'Forbidden', title: 'This page is not for your account', text: 'Your account cannot open this page. Sign in with another account or go back.', signIn: true },
  404: { name: 'Not Found', title: 'Page not found', text: 'There is no page at this address. It may have moved, or the link may have a typo.' },
  408: { name: 'Request Timeout', title: 'That took too long', text: 'The page did not answer in time. Please try again.', retry: true },
  429: { name: 'Too Many Requests', title: 'Too many tries at once', text: 'Please wait a moment, then try again.', retry: true },
  500: { name: 'Internal Server Error', title: 'Something went wrong on our side', text: 'This is not your fault. Please try again in a moment.', retry: true },
  502: { name: 'Bad Gateway', title: 'We could not reach USAS', text: 'The connection to the system broke on the way. Please try again.', retry: true },
  503: { name: 'Service Unavailable', title: 'USAS is taking a short break', text: 'The system is busy or being updated. Please try again shortly.', retry: true },
  504: { name: 'Gateway Timeout', title: 'USAS did not answer in time', text: 'The system took too long to reply. Please try again.', retry: true },
};

const SECRET_PARAM = /token|key|secret|pass|auth|session|sig|code|otp|reset/i;

/** The same address without anything secret: no user:password part, and the values of secret-looking query fields replaced. */
function safeAddress(href: string) {
  try {
    const url = new URL(href);
    url.username = ''; url.password = '';
    for (const name of [...url.searchParams.keys()]) if (SECRET_PARAM.test(name)) url.searchParams.set(name, '•••');
    return url.href.replace(/%E2%80%A2/g, '•');
  } catch { return href; }
}

/** The address shown to the visitor: the page they asked for. A `from` link is shown only if it is a web address. */
function requestedUrl() {
  const from = new URLSearchParams(window.location.search).get('from');
  if (from) {
    try {
      const url = new URL(from, window.location.origin);
      if (url.protocol === 'http:' || url.protocol === 'https:') return url.href;
    } catch { /* not an address: show this page's own */ }
  }
  return window.location.href;
}

/** The middle tile's picture: a magnifier for "not found", a padlock for access, a clock for waiting, a spark for a server fault. */
function Glyph({ code }: { code: number }) {
  const kind = code === 404 || code === 400 ? 'search' : code === 401 || code === 403 ? 'lock' : code === 408 || code === 429 || code === 504 ? 'clock' : 'spark';
  return (
    <svg viewBox="0 0 64 64" className={`ep-glyph ep-glyph-${kind}`} aria-hidden="true">
      {kind === 'search' && <><circle cx="27" cy="27" r="14" fill="none" stroke="currentColor" strokeWidth="5" /><path d="M37.5 37.5 50 50" stroke="currentColor" strokeWidth="6" strokeLinecap="round" /></>}
      {kind === 'lock' && <><rect x="15" y="29" width="34" height="24" rx="5" fill="currentColor" /><path d="M22 29v-7a10 10 0 0 1 20 0v7" fill="none" stroke="currentColor" strokeWidth="5" /></>}
      {kind === 'clock' && <><circle cx="32" cy="32" r="20" fill="none" stroke="currentColor" strokeWidth="5" /><path className="ep-hand" d="M32 32V19" stroke="currentColor" strokeWidth="5" strokeLinecap="round" /><path d="M32 32h9" stroke="currentColor" strokeWidth="5" strokeLinecap="round" /></>}
      {kind === 'spark' && <path d="M36 8 16 36h13l-3 20 22-30H34z" fill="currentColor" />}
    </svg>
  );
}

/**
 * Page not found (ERROR-PAGES-10, revision 11): a monitor whose own screen says 404 and "Page not found", with a server rack standing
 * BEHIND it. The browser asks, the rack's lights search, and the answer comes back empty. Pure CSS; with reduced motion it is still.
 * The rack is drawn first and lower, so it can never cover the screen, the words or the buttons.
 */
function MonitorScene({ path }: { path: string }) {
  return (
    <div className="ep-scene" aria-hidden="true">
      <div className="ep-rack">
        <div className="ep-rack-top" />
        {[0, 1, 2, 3, 4, 5].map(unit => (
          <div key={unit} className="ep-rack-unit" style={{ ['--u' as string]: unit }}>
            <span className="ep-led" /><span className="ep-led ep-led-2" />
            <span className="ep-vent" /><span className="ep-vent" /><span className="ep-vent" />
          </div>
        ))}
      </div>
      <div className="ep-monitor">
        <div className="ep-bezel">
          <div className="ep-screen" data-monitor-screen>
            <div className="ep-browser">
              <span className="ep-dot-r" /><span className="ep-dot-y" /><span className="ep-dot-g" />
              <span className="ep-address">{path.length > 34 ? `${path.slice(0, 33)}…` : path}</span>
            </div>
            <div className="ep-screen-body">
              <span className="ep-screen-code">404</span>
              <span className="ep-screen-title">Page not found</span>
              <span className="ep-search"><span className="ep-search-bar" /></span>
              <span className="ep-search-result">No page at this address</span>
            </div>
            <span className="ep-glare" />
          </div>
          <span className="ep-power" />
        </div>
        <div className="ep-neck" />
        <div className="ep-base" />
      </div>
      <div className="ep-floor-glow" />
    </div>
  );
}

/**
 * Every error page (404, 500 and the others in ERRORS): glossy 3D tiles spell the code over the same night-blue stage as the information page,
 * the middle tile shows what happened, and a label reads "404: Not Found" with the address the visitor tried underneath. It never claims more
 * than the code says. With reduced motion everything is still.
 */
export function ErrorPage({ code: asked = 404 }: { code?: number }) {
  const code = ERRORS[asked] ? asked : 500;
  const info = ERRORS[code];
  const url = safeAddress(requestedUrl());
  const [copied, setCopied] = useState(false);
  const digits = String(code).split('');
  const copy = () => navigator.clipboard?.writeText(url).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1600); }, () => undefined);
  const canGoBack = window.history.length > 1;
  const button = 'inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950';
  return (
    <div className="ep-page" data-error-code={code}>
      <PublicHeader />
      <div className="ep-sky" aria-hidden="true"><div className="ep-stars" /><div className="ep-cone" /><div className="ep-floor"><div className="ep-grid" /></div></div>
      <main className="relative z-10 mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-4 pb-14 pt-24 text-center">
        {code === 404 ? <MonitorScene path={(() => { try { return new URL(url).pathname; } catch { return '/'; } })()} /> : <div className="ep-tiles" aria-hidden="true">
          {digits.map((digit, index) => (
            <div key={index} className={`ep-tile ${index === 1 ? 'ep-tile-middle' : ''}`} style={{ ['--i' as string]: index }}>
              <div className="ep-tile-face">{index === 1 && digit === '0' ? <Glyph code={code} /> : <span className="ep-digit">{digit}</span>}</div>
            </div>
          ))}
          <div className="ep-shadow" />
        </div>}
        <p className="ep-label"><span className="ep-dot" aria-hidden="true" />{`${code}: ${info.name}`}</p>
        <h1 className="mt-4 font-display text-[clamp(1.9rem,6vw,3.1rem)] font-extrabold leading-tight tracking-tight text-white">{info.title}</h1>
        <p className="mt-3 max-w-xl text-base font-medium text-blue-100/85">{info.text}</p>
        <div className="ep-url">
          <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-blue-300">You tried to open</span>
          <div className="mt-2 flex items-start gap-2">
            <code className="min-w-0 flex-1 break-all text-left font-mono text-sm text-white" data-requested-url>{url}</code>
            <button type="button" onClick={copy} aria-label={copied ? 'Address copied' : 'Copy address'} className="shrink-0 rounded-lg border border-white/15 bg-white/10 p-2 text-blue-100 hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          {info.retry && <button type="button" onClick={() => window.location.reload()} className={`${button} bg-brand-blue text-white shadow-[0_8px_30px_rgba(37,99,235,0.45)] hover:bg-blue-500`}><RotateCw className="h-4 w-4" />Try again</button>}
          <button type="button" onClick={() => goTo('/')} className={`${button} ${info.retry ? 'border border-white/25 bg-white/10 text-white backdrop-blur hover:bg-white/20' : 'bg-brand-blue text-white shadow-[0_8px_30px_rgba(37,99,235,0.45)] hover:bg-blue-500'}`}><Home className="h-4 w-4" />Back to home</button>
          {info.signIn && <button type="button" onClick={() => goTo('/login')} className={`${button} border border-white/25 bg-white/10 text-white backdrop-blur hover:bg-white/20`}><LogIn className="h-4 w-4" />Sign in</button>}
          {canGoBack && <button type="button" onClick={() => window.history.back()} className={`${button} border border-white/25 bg-white/10 text-white backdrop-blur hover:bg-white/20`}><ArrowLeft className="h-4 w-4" />Go back</button>}
        </div>
      </main>
    </div>
  );
}
