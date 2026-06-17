/* ============================================================
   KITHRA — durability & single-tab e2e (Playwright)
   ------------------------------------------------------------
   Exercises, in a REAL browser, the two guarantees added on this
   branch:
     1. Recordings persist on-device (IndexedDB) across a reload and
        across sign-out/sign-in — through the app's own hydration —
        and stay scoped to the account that made them.
     2. Live capture can be held by only ONE tab at a time, with a
        clean "take over here" hand-off between two real pages.

   Sign-in is stubbed by overriding KithraCloud.getUser (mirrors the
   real return-from-OAuth re-check), so no live backend is needed.

   HOW TO RUN
     1) npm run build
     2) /opt/node22/bin/node \
          /opt/node22/lib/node_modules/http-server/bin/http-server \
          dist -p 8077 -s &
     3) /opt/node22/bin/node tests/e2e-durability.mjs
   Exit 0 = all passed, 1 = a failure.
   ============================================================ */
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;

const BASE = process.env.KITHRA_URL || 'http://127.0.0.1:8077/index.html';
const CHROME = process.env.KITHRA_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const USER = { id: 'dur-user-1', email: 'dur@kithra.app', user_metadata: { full_name: 'Durability Test' } };

let pass = 0, fail = 0;
function check(name, cond, detail = '') {
  if (cond) { pass++; console.log('  PASS  ' + name + (detail ? '  — ' + detail : '')); }
  else { fail++; console.log('  FAIL  ' + name + '  — ' + detail); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login(pg, user) {
  await pg.evaluate((u) => {
    window.KithraCloud.getUser = async () => u;
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
  }, user);
  await sleep(700);
}
async function logout(pg) {
  await pg.evaluate(() => {
    window.KithraCloud.getUser = async () => null;
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await sleep(500);
}
const gotoRoute = async (pg, r) => { await pg.evaluate((x) => { location.hash = '#' + x; }, r); await sleep(450); };
const bodyText = (pg) => pg.evaluate(() => document.body.innerText);

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-fake-ui-for-media-stream'] });
  const ctx = await browser.newContext();
  const pg = await ctx.newPage();
  const errs = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.goto(BASE, { waitUntil: 'domcontentloaded' });
  await sleep(900);

  const exposed = await pg.evaluate(() => ({
    store: !!(window.KithraClipStore && typeof window.KithraClipStore.putClip === 'function'),
    lock: !!(window.KithraTabLock && typeof window.KithraTabLock.claim === 'function'),
    idb: !!(window.KithraClipStore && window.KithraClipStore.hasIDB && window.KithraClipStore.hasIDB()),
  }));
  check('clip store + tab lock available; IndexedDB present', exposed.store && exposed.lock && exposed.idb, JSON.stringify(exposed));

  // ---------------------------------------------------------
  console.log('\n[1] Recordings persist across reload + sign-out/sign-in');
  // ---------------------------------------------------------
  await login(pg, USER);

  const CLIP = { id: 'dur-clip-1', name: 'Durability Demo Call', durSec: 42, source: 'upload', ts: Date.now(), peaks: [0.2, 0.5, 0.3], analysis: { duration: 42 } };
  const saved = await pg.evaluate(async ({ clip, owner }) => {
    const blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'audio/webm' });
    const ok = await window.KithraClipStore.putClip(clip, blob, owner);
    const back = await window.KithraClipStore.getClips(owner);
    return { ok, count: back.length, hasAudio: !!(back[0] && back[0].hasAudio), url: !!(back[0] && back[0].url) };
  }, { clip: CLIP, owner: USER.id });
  check('clip saved to IndexedDB and read back with a playable URL', saved.ok && saved.count >= 1 && saved.hasAudio && saved.url, JSON.stringify(saved));

  // reload → the app re-hydrates from IndexedDB on sign-in
  await pg.reload({ waitUntil: 'domcontentloaded' });
  await sleep(900);
  await login(pg, USER);
  await gotoRoute(pg, 'library');
  let txt = await bodyText(pg);
  check('after reload, the recording is restored in Recordings', /Durability Demo Call/.test(txt));

  // sign out → sign back in (same account) → still there (the exact complaint)
  await logout(pg);
  await login(pg, USER);
  await gotoRoute(pg, 'library');
  txt = await bodyText(pg);
  check('after sign-out then sign-in, the recording is still present', /Durability Demo Call/.test(txt));

  // a DIFFERENT account must not see it (per-account scoping)
  await logout(pg);
  await login(pg, { ...USER, id: 'dur-user-2', email: 'other@kithra.app' });
  await gotoRoute(pg, 'library');
  txt = await bodyText(pg);
  check('a different account does NOT see the first account’s recording', !/Durability Demo Call/.test(txt));

  // ---------------------------------------------------------
  console.log('\n[2] Live capture is single-tab, with take-over hand-off');
  // ---------------------------------------------------------
  const pgB = await ctx.newPage(); // second tab, same origin → shares storage + BroadcastChannel
  pgB.on('pageerror', (e) => errs.push(e.message));
  await pgB.goto(BASE, { waitUntil: 'domcontentloaded' });
  await sleep(600);

  await pg.evaluate(() => window.KithraTabLock.release());
  await pgB.evaluate(() => window.KithraTabLock.release());

  const aClaim = await pg.evaluate(() => window.KithraTabLock.claim({ mode: 'listen' }));
  check('tab A acquires the live-capture lock', aClaim === true);

  await sleep(150);
  const bView = await pgB.evaluate(() => ({ busy: window.KithraTabLock.busyElsewhere(), claim: window.KithraTabLock.claim() }));
  check('tab B sees capture busy elsewhere and is refused the lock', bView.busy === true && bView.claim === false, JSON.stringify(bView));

  const bTake = await pgB.evaluate(() => window.KithraTabLock.takeover({ mode: 'listen' }));
  await sleep(150);
  const aView = await pg.evaluate(() => ({ state: window.KithraTabLock.state(), reclaim: window.KithraTabLock.claim() }));
  check('tab B takes over; tab A yields and can no longer claim', bTake === true && aView.state === 'theirs' && aView.reclaim === false, JSON.stringify(aView));

  await pgB.evaluate(() => window.KithraTabLock.release());
  await sleep(150);
  const free = await pg.evaluate(() => window.KithraTabLock.state());
  check('releasing frees the lock for any tab', free === 'free', free);

  // ignore benign network noise (the optional Supabase CDN/client when offline)
  const benign = errs.filter((m) => !/supabase|cdn|jsdelivr|Failed to fetch|NetworkError|Load failed|importing a module script failed/i.test(m));
  check('no unexpected page errors during the run', benign.length === 0, benign.join(' | '));

  await browser.close();
  console.log(`\n${fail ? '✗' : '✓'} durability e2e: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
