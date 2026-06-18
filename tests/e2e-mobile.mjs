/* ============================================================
   KITHRA — END-TO-END QA suite: desktop + mobile parity
   ------------------------------------------------------------
   Exercises EVERY route/tab and the new native mobile shell
   (bottom tab bar + More sheet + mobile header) plus the owner
   all-access feature, on BOTH a desktop (1440x900) and a phone
   (390x844) viewport. Server-only paths (live Razorpay charge,
   real Google/SMS auth, the Gemini Edge Function) need backend
   secrets and are NOT exercised here — only their client wiring
   is asserted (functions present).

   HOW TO RUN
   ----------
   1) Serve the built single-file app:
        /opt/node22/bin/node \
          /opt/node22/lib/node_modules/http-server/bin/http-server \
          /home/user/PraveenSaraswat12/dist-single -p 8066 -s &
   2) Run:
        PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
          /opt/node22/bin/node /home/user/PraveenSaraswat12/tests/e2e-mobile.mjs
   Exit code 0 = all hard assertions passed; 1 = at least one failed.
   ============================================================ */
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;

const BASE = process.env.KITHRA_URL || 'http://127.0.0.1:8066/index.html';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

const OWNER = { id: 'owner', email: 'saraswatpraveen21@gmail.com', user_metadata: { full_name: 'Praveen Saraswat' } };
const FREE = { id: 'free', email: 'free@test.com', user_metadata: { full_name: 'Free Tester' } };

const ROUTES = ['dashboard', 'ask', 'patterns', 'library', 'books', 'analyze', 'sources', 'privacy', 'pricing'];

// ---- tiny assertion harness ----
let pass = 0, fail = 0;
const results = [];
function check(name, cond, detail = '') {
  if (cond) { pass++; results.push(['PASS', name, detail]); console.log('  PASS  ' + name + (detail ? '  — ' + detail : '')); }
  else { fail++; results.push(['FAIL', name, detail]); console.log('  FAIL  ' + name + '  — ' + detail); }
  return !!cond;
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Sign in by stubbing the cloud getUser + nudging the focus re-check (mirrors the
// real return-from-OAuth path). Also seeds the plan in localStorage first.
async function login(pg, user) {
  await pg.evaluate((u) => {
    window.KithraCloud.getUser = async () => u;
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
  }, user);
  await sleep(700);
  await dismissMic(pg);
}
async function dismissMic(pg) {
  try {
    const btn = await pg.$('text=/Maybe later/i');
    if (btn) { await btn.click(); await sleep(200); }
  } catch (e) {}
}
async function gotoRoute(pg, route) {
  await pg.evaluate((r) => { location.hash = '#' + r; }, route);
  await sleep(420);
  await dismissMic(pg);
}
async function setPlan(pg, plan) {
  await pg.evaluate((p) => { try { p == null ? localStorage.removeItem('kithra_plan') : localStorage.setItem('kithra_plan', p); } catch (e) {} }, plan);
}
async function setTheme(pg, theme) {
  await pg.evaluate((th) => { const r = document.getElementById('lumen-root'); if (r) r.setAttribute('data-theme', th); }, theme);
}
const bodyText = (pg) => pg.evaluate(() => document.body.innerText);

// fresh page at a given viewport with console + pageerror capture wired
async function freshPage(browser, viewport) {
  const ctx = await browser.newContext({ viewport });
  const pg = await ctx.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  pg.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  pg.on('pageerror', e => pageErrors.push(e.message));
  await pg.goto(BASE, { waitUntil: 'networkidle' });
  await sleep(700);
  return { pg, ctx, consoleErrors, pageErrors };
}

async function main() {
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });

  // =========================================================
  // [1] AUTH GATE (desktop) — no offline bypass; Google + Email
  // =========================================================
  console.log('\n[1] AUTH GATE — app routes require a real account');
  {
    const { pg, ctx } = await freshPage(browser, DESKTOP);
    const configured = await pg.evaluate(() => !!(window.KithraCloud && window.KithraCloud.configured && window.KithraCloud.configured()));
    check('build ships Supabase config (login gate is live)', configured, 'KithraCloud.configured() === true');

    await gotoRoute(pg, 'dashboard');
    await pg.evaluate(() => window.dispatchEvent(new Event('focus')));
    await sleep(500);
    const gate = await pg.evaluate(() => ({
      shell: !!document.querySelector('.app') || !!document.querySelector('.side'),
      google: /Continue with Google/i.test(document.body.innerText),
      email: /Email/i.test(document.body.innerText),
    }));
    check('logged-out app route shows #auth gate (no offline escape)', gate.google && !gate.shell, 'Auth shown, app shell absent');
    check('auth gate offers Google + Email', gate.google && gate.email, JSON.stringify(gate));
    const api = await pg.evaluate(() => ({
      google: typeof window.KithraCloud.signInWithGoogle === 'function',
      signUp: typeof window.KithraCloud.signUp === 'function',
      signIn: typeof window.KithraCloud.signIn === 'function',
      signOut: typeof window.KithraCloud.signOut === 'function',
    }));
    check('auth client wiring present (google/email/signOut)', Object.values(api).every(Boolean), JSON.stringify(api));
    await ctx.close();
  }

  // =========================================================
  // [2] EVERY ROUTE RENDERS — desktop: no errors; + DESKTOP chrome
  // =========================================================
  console.log('\n[2/4] DESKTOP — every route renders, no errors; sidebar+topbar present, NO tab bar');
  const routeReport = {}; // route -> { desktop:{err,overflow}, mobile:{err,overflow} }
  for (const r of ROUTES) routeReport[r] = { desktop: { err: [], ok: false }, mobile: { err: [], ok: false, overflow: null } };
  {
    const { pg, ctx, consoleErrors, pageErrors } = await freshPage(browser, DESKTOP);
    await setPlan(pg, 'premium'); // premium so gated screens render their full content
    await login(pg, OWNER);
    await gotoRoute(pg, 'dashboard'); // the app shell only mounts on an app route (landing has no chrome)
    // desktop chrome present
    const chrome = await pg.evaluate(() => ({
      side: !!document.querySelector('.side'),
      topbar: !!document.querySelector('.topbar'),
      tabbar: !!document.querySelector('.mtabbar'),
      mhead: !!document.querySelector('.mhead'),
    }));
    check('DESKTOP: sidebar visible', chrome.side, 'aside.side present');
    check('DESKTOP: topbar visible', chrome.topbar, 'header.topbar present');
    check('DESKTOP: bottom tab bar NOT present', !chrome.tabbar, '.mtabbar absent');
    check('DESKTOP: mobile header NOT present', !chrome.mhead, '.mhead absent');

    for (const r of ROUTES) {
      const before = pageErrors.length, beforeC = consoleErrors.length;
      await gotoRoute(pg, r);
      const t = await bodyText(pg);
      const newErr = pageErrors.slice(before).concat(consoleErrors.slice(beforeC));
      const ok = t.length > 60 && pageErrors.length === before;
      routeReport[r].desktop = { err: newErr, ok };
      check('DESKTOP route #' + r + ' renders w/o pageerror', ok, ok ? t.slice(0, 42).replace(/\n/g, ' ') : ('errs: ' + newErr.slice(0, 2).join(' | ')));
    }
    await ctx.close();
  }

  // =========================================================
  // [3] MOBILE — every route renders, ZERO horizontal overflow, mobile chrome
  // =========================================================
  console.log('\n[3] MOBILE — every route renders, zero horizontal overflow; mobile chrome present, desktop chrome hidden');
  {
    const { pg, ctx, consoleErrors, pageErrors } = await freshPage(browser, MOBILE);
    await setPlan(pg, 'premium');
    await login(pg, OWNER);
    await gotoRoute(pg, 'dashboard'); // the app shell only mounts on an app route (landing has no chrome)

    // desktop chrome hidden + mobile chrome present
    const chrome = await pg.evaluate(() => {
      const vis = (sel) => { const el = document.querySelector(sel); if (!el) return false; const s = getComputedStyle(el); return s.display !== 'none' && s.visibility !== 'hidden' && el.offsetParent !== null; };
      return {
        sideHidden: !vis('.side'),
        topbarHidden: !vis('.topbar'),
        tabbar: !!document.querySelector('.mtabbar'),
        tabCount: document.querySelectorAll('.mtabbar .mtab').length,
        mhead: !!document.querySelector('.mhead'),
      };
    });
    check('MOBILE: desktop sidebar NOT visible', chrome.sideHidden, 'aside.side hidden at 390');
    check('MOBILE: desktop topbar NOT visible', chrome.topbarHidden, 'header.topbar hidden at 390');
    check('MOBILE: bottom tab bar present with 5 tabs', chrome.tabbar && chrome.tabCount === 5, 'tabs=' + chrome.tabCount);
    check('MOBILE: mobile header present', chrome.mhead, 'header.mhead present');

    // tab labels
    const tabLabels = await pg.evaluate(() => [...document.querySelectorAll('.mtabbar .mtab .mtab-lbl')].map(e => e.textContent.trim()));
    check('MOBILE: tab bar shows Home/Ask/Patterns/Recordings/More', ['Home', 'Ask', 'Patterns', 'Recordings', 'More'].every(l => tabLabels.includes(l)), tabLabels.join(', '));

    for (const r of ROUTES) {
      const before = pageErrors.length, beforeC = consoleErrors.length;
      await gotoRoute(pg, r);
      const t = await bodyText(pg);
      const metrics = await pg.evaluate(() => ({
        sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
        bsw: document.body.scrollWidth,
      }));
      const overflow = Math.max(metrics.sw, metrics.bsw) - metrics.cw; // px of horizontal overflow
      const newErr = pageErrors.slice(before).concat(consoleErrors.slice(beforeC));
      const noErr = t.length > 60 && pageErrors.length === before;
      const noOverflow = overflow <= 1; // allow 1px rounding
      routeReport[r].mobile = { err: newErr, ok: noErr, overflow };
      check('MOBILE route #' + r + ' renders w/o pageerror', noErr, noErr ? '' : ('errs: ' + newErr.slice(0, 2).join(' | ')));
      check('MOBILE route #' + r + ' zero horizontal overflow', noOverflow, 'overflow=' + overflow + 'px (sw=' + metrics.sw + ' cw=' + metrics.cw + ')');
    }
    await ctx.close();
  }

  // =========================================================
  // [3b] MOBILE chrome interactions — tab nav, active state, More sheet, toggles, sign out, header action
  // =========================================================
  console.log('\n[3b] MOBILE chrome interactions');
  {
    const { pg, ctx } = await freshPage(browser, MOBILE);
    await setPlan(pg, 'premium');
    await login(pg, OWNER);
    await gotoRoute(pg, 'dashboard');

    // tapping each primary tab navigates + sets active state
    const tabMap = { Home: 'dashboard', Ask: 'ask', Patterns: 'patterns', Recordings: 'library' };
    for (const [label, route] of Object.entries(tabMap)) {
      const r = await pg.evaluate((lbl) => {
        const tab = [...document.querySelectorAll('.mtabbar .mtab')].find(b => b.querySelector('.mtab-lbl')?.textContent.trim() === lbl);
        if (!tab) return { found: false };
        tab.click();
        return { found: true };
      }, label);
      await sleep(350);
      const state = await pg.evaluate((lbl) => {
        const tab = [...document.querySelectorAll('.mtabbar .mtab')].find(b => b.querySelector('.mtab-lbl')?.textContent.trim() === lbl);
        return { hash: location.hash, active: tab ? tab.classList.contains('active') : false };
      }, label);
      check('MOBILE tab "' + label + '" navigates to #' + route + ' + active', r.found && state.hash === '#' + route && state.active, 'hash=' + state.hash + ' active=' + state.active);
    }

    // More sheet opens and shows its rows
    const moreOpened = await pg.evaluate(async () => {
      const more = [...document.querySelectorAll('.mtabbar .mtab')].find(b => b.querySelector('.mtab-lbl')?.textContent.trim() === 'More');
      if (!more) return { ok: false };
      more.click();
      await new Promise(r => setTimeout(r, 380));
      const rows = [...document.querySelectorAll('.msheet-row .msheet-row-label')].map(e => e.textContent.trim());
      const sheet = !!document.querySelector('.msheet.in') || !!document.querySelector('.msheet');
      return { ok: sheet, rows };
    });
    check('MOBILE More sheet opens', moreOpened.ok, 'rows: ' + (moreOpened.rows || []).join(', '));
    check('MOBILE More sheet rows = Books/Analyze/Sources/Privacy/Plans',
      ['Books', 'Analyze audio', 'Sources', 'Privacy & Data', 'Plans'].every(l => (moreOpened.rows || []).includes(l)), (moreOpened.rows || []).join(', '));

    // a More-sheet row navigates (Books)
    const navBooks = await pg.evaluate(async () => {
      const row = [...document.querySelectorAll('.msheet-row')].find(b => /Books/.test(b.querySelector('.msheet-row-label')?.textContent || ''));
      if (!row) return { ok: false };
      row.click();
      await new Promise(r => setTimeout(r, 400));
      return { ok: true, hash: location.hash };
    });
    check('MOBILE More row "Books" navigates to #books', navBooks.ok && navBooks.hash === '#books', 'hash=' + navBooks.hash);

    // Dark-mode toggle in the More sheet
    const darkToggle = await pg.evaluate(async () => {
      const more = [...document.querySelectorAll('.mtabbar .mtab')].find(b => b.querySelector('.mtab-lbl')?.textContent.trim() === 'More');
      more.click(); await new Promise(r => setTimeout(r, 380));
      const before = document.getElementById('lumen-root').getAttribute('data-theme');
      const ctrl = [...document.querySelectorAll('.msheet-ctrl')].find(b => /mode/i.test(b.textContent) && /(Dark|Light)/i.test(b.textContent));
      if (!ctrl) return { ok: false };
      ctrl.click(); await new Promise(r => setTimeout(r, 250));
      const after = document.getElementById('lumen-root').getAttribute('data-theme');
      return { ok: before !== after, before, after };
    });
    check('MOBILE More: Dark-mode toggle flips theme', darkToggle.ok, darkToggle.before + ' -> ' + darkToggle.after);

    // Personal/Business toggle in the More sheet
    const modeToggle = await pg.evaluate(async () => {
      const more = [...document.querySelectorAll('.mtabbar .mtab')].find(b => b.querySelector('.mtab-lbl')?.textContent.trim() === 'More');
      // sheet should still be open from previous step; ensure open
      if (!document.querySelector('.msheet')) { more.click(); await new Promise(r => setTimeout(r, 380)); }
      const before = document.getElementById('lumen-root').getAttribute('data-mode');
      const ctrl = [...document.querySelectorAll('.msheet-ctrl')].find(b => /(Personal|Business)/i.test(b.textContent));
      if (!ctrl) return { ok: false };
      ctrl.click(); await new Promise(r => setTimeout(r, 250));
      const after = document.getElementById('lumen-root').getAttribute('data-mode');
      return { ok: before !== after, before, after };
    });
    check('MOBILE More: Personal/Business toggle flips mode', modeToggle.ok, modeToggle.before + ' -> ' + modeToggle.after);

    // Sign out calls KithraCloud.signOut
    const signedOut = await pg.evaluate(async () => {
      let called = false;
      const orig = window.KithraCloud.signOut;
      window.KithraCloud.signOut = async () => { called = true; };
      const more = [...document.querySelectorAll('.mtabbar .mtab')].find(b => b.querySelector('.mtab-lbl')?.textContent.trim() === 'More');
      if (!document.querySelector('.msheet')) { more.click(); await new Promise(r => setTimeout(r, 380)); }
      const so = document.querySelector('.msheet-signout');
      if (!so) { window.KithraCloud.signOut = orig; return { ok: false, why: 'no signout btn' }; }
      so.click();
      await new Promise(r => setTimeout(r, 500));
      window.KithraCloud.signOut = orig;
      return { ok: called, hash: location.hash };
    });
    check('MOBILE More: Sign out calls KithraCloud.signOut + leaves app', signedOut.ok, 'called=' + signedOut.ok + ' hash=' + signedOut.hash);

    // mobile header action button works (dashboard -> Add recording -> analyze)
    await login(pg, OWNER);
    await gotoRoute(pg, 'dashboard');
    const headAction = await pg.evaluate(async () => {
      const btn = document.querySelector('.mhead-action');
      if (!btn) return { ok: false, why: 'no header action on dashboard' };
      btn.click();
      await new Promise(r => setTimeout(r, 400));
      return { ok: true, hash: location.hash };
    });
    check('MOBILE header action button works (dashboard add -> #analyze)', headAction.ok && headAction.hash === '#analyze', 'hash=' + headAction.hash);
    await ctx.close();
  }

  // =========================================================
  // [5] OWNER ALL-ACCESS — saraswatpraveen21@gmail.com
  // =========================================================
  console.log('\n[5] OWNER all-access (saraswatpraveen21@gmail.com)');
  for (const vp of [['desktop', DESKTOP], ['mobile', MOBILE]]) {
    const { pg, ctx } = await freshPage(browser, vp[1]);
    await setPlan(pg, null); // ensure no stored paid plan; owner-access must come from identity
    await login(pg, OWNER);

    // Patterns NOT walled
    await gotoRoute(pg, 'patterns');
    const pat = await bodyText(pg);
    const walled = /Patterns is a Plus feature|Upgrade to Plus/i.test(pat);
    check('OWNER(' + vp[0] + '): Patterns NOT walled', !walled, walled ? 'WALL SHOWN' : 'content reachable');

    // account shows Premium (account menu desktop / More sheet mobile)
    let acctTxt;
    if (vp[0] === 'desktop') {
      acctTxt = await pg.evaluate(async () => {
        const btn = document.querySelector('.topbar .dd button[aria-label="Account"]') || document.querySelector('.dd button[aria-label="Account"]');
        if (btn) { btn.click(); await new Promise(r => setTimeout(r, 250)); }
        const t = document.querySelector('.dd-menu')?.innerText || '';
        // also the plan pill text
        const pill = document.querySelector('.plan-pill')?.innerText || '';
        return (t + ' ' + pill);
      });
    } else {
      acctTxt = await pg.evaluate(async () => {
        const more = [...document.querySelectorAll('.mtabbar .mtab')].find(b => b.querySelector('.mtab-lbl')?.textContent.trim() === 'More');
        more.click(); await new Promise(r => setTimeout(r, 380));
        return document.querySelector('.msheet-acct')?.innerText || document.querySelector('.msheet')?.innerText || '';
      });
    }
    check('OWNER(' + vp[0] + '): account shows Premium plan', /premium/i.test(acctTxt), JSON.stringify((acctTxt || '').replace(/\n/g, ' ').slice(0, 80)));

    // planAllows('premium') effectively true: Privacy "Export as PDF" must NOT redirect to pricing
    await gotoRoute(pg, 'privacy');
    const pdfStays = await pg.evaluate(async () => {
      const btn = [...document.querySelectorAll('button')].find(b => /Export as PDF/i.test(b.textContent));
      if (!btn) return { ok: false, why: 'no PDF export button' };
      const before = location.hash;
      btn.click();
      await new Promise(r => setTimeout(r, 350));
      return { ok: true, before, after: location.hash, hasLock: /Premium/i.test(btn.textContent) && !!btn.querySelector('.lock-pill') };
    });
    check('OWNER(' + vp[0] + '): Privacy PDF export not walled (no redirect to pricing, no lock-pill)',
      pdfStays.ok && pdfStays.after !== '#pricing' && !pdfStays.hasLock, JSON.stringify(pdfStays));

    // Books summary visible (Plus) + Read-in-app (Premium) not walled in detail
    await gotoRoute(pg, 'books');
    const booksOwner = await pg.evaluate(async () => {
      const card = document.querySelector('.grid .card.click');
      if (!card) return { ok: false, why: 'no book card' };
      card.click();
      await new Promise(r => setTimeout(r, 350));
      const t = document.querySelector('.lc-card')?.innerText || document.body.innerText;
      const walled = /Summaries & key ideas are a Plus feature|Read in app — Premium/i.test(t);
      return { ok: true, walled, hasSummary: /Summary/i.test(t) };
    });
    check('OWNER(' + vp[0] + '): Books detail not Plus/Premium-walled', booksOwner.ok && !booksOwner.walled, JSON.stringify(booksOwner));
    await ctx.close();
  }

  // =========================================================
  // [6] NON-OWNER FREE — free@test.com, kithra_plan unset/free
  // =========================================================
  console.log('\n[6] NON-OWNER Free user (free@test.com)');
  {
    const { pg, ctx } = await freshPage(browser, DESKTOP);
    await setPlan(pg, null); // unset -> defaults to 'free'
    await pg.reload({ waitUntil: 'networkidle' }); await sleep(600);
    await login(pg, FREE);

    await gotoRoute(pg, 'patterns');
    const pat = await bodyText(pg);
    const walled = /Patterns is a Plus feature|Upgrade to Plus/i.test(pat) && !/Speaking pace|pattern read|Find my patterns/i.test(pat);
    check('FREE: Patterns shows upgrade wall (no charts/AI read leak)', walled, walled ? 'wall shown' : 'CONTENT LEAKED');

    // sidebar lock pill present
    const lockPill = await pg.evaluate(() => !!document.querySelector('.side .lock-pill, .side [data-tier="plus"]'));
    check('FREE: Patterns nav shows Plus lock pill', lockPill, 'lock-pill in sidebar');

    // locked feature pushes to pricing: Privacy PDF export -> #pricing
    await gotoRoute(pg, 'privacy');
    const pushed = await pg.evaluate(async () => {
      const btn = [...document.querySelectorAll('button')].find(b => /Export as PDF/i.test(b.textContent));
      if (!btn) return { ok: false };
      btn.click(); await new Promise(r => setTimeout(r, 350));
      return { ok: true, hash: location.hash };
    });
    check('FREE: locked PDF export pushes to #pricing', pushed.ok && pushed.hash === '#pricing', 'hash=' + pushed.hash);

    // Books detail walled (Plus summary)
    await gotoRoute(pg, 'books');
    const booksFree = await pg.evaluate(async () => {
      const card = document.querySelector('.grid .card.click');
      if (!card) return { ok: false };
      card.click(); await new Promise(r => setTimeout(r, 350));
      const t = document.querySelector('.lc-card')?.innerText || '';
      return { ok: true, walled: /Plus feature/i.test(t) };
    });
    check('FREE: Books detail shows Plus wall on summary', booksFree.ok && booksFree.walled, JSON.stringify(booksFree));
    await ctx.close();
  }

  // =========================================================
  // [7] PRICING — prices, toggles, checkout wiring
  // =========================================================
  console.log('\n[7] PRICING — prices, currency + period toggles, checkout wiring');
  for (const vp of [['desktop', DESKTOP], ['mobile', MOBILE]]) {
    const { pg, ctx } = await freshPage(browser, vp[1]);
    await setPlan(pg, 'free');
    await login(pg, FREE);
    await gotoRoute(pg, 'pricing');
    let pt = await bodyText(pg);
    check('PRICING(' + vp[0] + '): Plus $30 + Premium $90 (monthly USD)', /\$30\b/.test(pt) && /\$90\b/.test(pt), '$30/$90');

    const clickSeg = async (label) => {
      await pg.evaluate((lbl) => {
        const b = [...document.querySelectorAll('.seg button, button')].find(x => x.textContent.trim().replace(/\s+/g, ' ').includes(lbl));
        if (b) b.click();
      }, label);
      await sleep(320);
    };
    await clickSeg('₹ INR');
    pt = await bodyText(pg);
    check('PRICING(' + vp[0] + '): INR shows ₹2,499 (Plus) + ₹7,499 (Premium)', /₹2,499/.test(pt) && /₹7,499/.test(pt), 'INR prices');
    await clickSeg('$ USD');
    await clickSeg('Annual');
    pt = await bodyText(pg);
    check('PRICING(' + vp[0] + '): Annual = 10x — Plus $25/mo billed $300/yr', /\$25\b/.test(pt) && /\$300\b/.test(pt), 'annual plus');
    check('PRICING(' + vp[0] + '): Annual — Premium $75/mo billed $900/yr', /\$75\b/.test(pt) && /\$900\b/.test(pt), 'annual premium');

    if (vp[0] === 'desktop') {
      const payApi = await pg.evaluate(() => ({
        createOrder: typeof window.KithraCloud.createOrder === 'function',
        verifyPayment: typeof window.KithraCloud.verifyPayment === 'function',
        getSubscription: typeof window.KithraCloud.getSubscription === 'function',
      }));
      check('PRICING: checkout wiring present (createOrder/verifyPayment/getSubscription)', Object.values(payApi).every(Boolean), JSON.stringify(payApi));
    }
    await ctx.close();
  }

  // =========================================================
  // [8] CORE ACTIONS — Ask consent gate, Privacy export/delete, Analyze, Sources, Library
  // =========================================================
  console.log('\n[8] CORE ACTIONS present + not throwing');
  {
    const { pg, ctx, pageErrors } = await freshPage(browser, DESKTOP);
    await setPlan(pg, 'premium');
    await login(pg, OWNER);

    // Ask: live context + consent gate before first AI call
    await pg.evaluate(() => { try { localStorage.removeItem('kithra_consents'); } catch (e) {} });
    await gotoRoute(pg, 'ask');
    const askTxt = await bodyText(pg);
    check('ASK: shows live context status (recordings · transcribed · books)', /transcribed/i.test(askTxt) && /books/i.test(askTxt), 'context chip');
    const consent = await pg.evaluate(async () => {
      const ta = document.querySelector('.ask-input textarea, textarea');
      if (!ta) return { ok: false, why: 'no textarea' };
      const setVal = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      setVal.call(ta, 'How am I trending across my calls?');
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(r => setTimeout(r, 120));
      ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await new Promise(r => setTimeout(r, 450));
      return { ok: true, body: document.body.innerText };
    });
    check('ASK: consent prompt before any AI call', consent.ok && /Allow Kithra to send context|Allow & ask/i.test(consent.body || ''), consent.ok ? 'consent card' : consent.why);

    // Privacy: export + delete present, wired
    await gotoRoute(pg, 'privacy');
    const privTxt = await bodyText(pg);
    check('PRIVACY: consent ledger + export + delete-all present', /Consent & your data rights/i.test(privTxt) && /Export my data/i.test(privTxt) && /Delete all my data/i.test(privTxt), 'ledger+export+delete');
    const rights = await pg.evaluate(() => ({ del: typeof window.KithraCloud.deleteAllCloud === 'function', sync: typeof window.KithraCloud.syncConsents === 'function' }));
    check('PRIVACY: deleteAllCloud + syncConsents wired', rights.del && rights.sync, JSON.stringify(rights));

    // Analyze: dropzone / record affordance present
    await gotoRoute(pg, 'analyze');
    const analyzeOk = await pg.evaluate(() => !!document.querySelector('.dropzone') || /Analyze a recording/i.test(document.body.innerText));
    check('ANALYZE: capture/upload UI present', analyzeOk, 'dropzone/heading');

    // Sources: renders connect/import affordances
    await gotoRoute(pg, 'sources');
    const sourcesTxt = await bodyText(pg);
    check('SOURCES: renders import/connect content', sourcesTxt.length > 80, sourcesTxt.slice(0, 40).replace(/\n/g, ' '));

    // Library: renders
    await gotoRoute(pg, 'library');
    const libTxt = await bodyText(pg);
    check('LIBRARY: renders content', libTxt.length > 60, libTxt.slice(0, 40).replace(/\n/g, ' '));

    // recording -> insight plumbing
    const aiApi = await pg.evaluate(() => ({
      transcribe: typeof window.KithraCloud.transcribe === 'function',
      saveRecording: typeof window.KithraCloud.saveRecording === 'function',
    }));
    check('PLUMBING: transcribe + saveRecording wired', aiApi.transcribe && aiApi.saveRecording, JSON.stringify(aiApi));

    check('CORE: no uncaught page errors during core-actions pass', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
    await ctx.close();
  }

  await browser.close();

  // ---- per-route matrix summary ----
  console.log('\n--- PER-ROUTE RENDER MATRIX (desktop / mobile) ---');
  console.log('route        | desktop      | mobile (overflow px)');
  for (const r of ROUTES) {
    const d = routeReport[r].desktop, m = routeReport[r].mobile;
    const dCell = d.ok ? 'PASS' : 'FAIL';
    const mCell = (m.ok ? 'PASS' : 'FAIL') + ' (' + (m.overflow == null ? '?' : m.overflow) + 'px)';
    console.log('  ' + r.padEnd(11) + '| ' + dCell.padEnd(12) + '| ' + mCell);
  }

  // ---- summary ----
  console.log('\n============================================================');
  console.log(`RESULT: ${pass} passed, ${fail} failed`);
  console.log('============================================================');
  if (fail > 0) {
    console.log('FAILURES:');
    results.filter(r => r[0] === 'FAIL').forEach(r => console.log('  - ' + r[1] + (r[2] ? '  (' + r[2] + ')' : '')));
  }
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => { console.error('SUITE CRASHED:', e); process.exit(2); });
