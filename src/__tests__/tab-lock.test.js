import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as Lock from '../tab-lock.js';

const FOREIGN = 'tab-other';

beforeEach(() => { try { localStorage.clear(); } catch (e) {} Lock.release(); });
afterEach(() => { Lock.release(); });

// The lock is the safety guarantee that two tabs can't fight over the mic.
describe('tab-lock', () => {
  it('is free initially and claimable by this tab', () => {
    expect(Lock.state()).toBe('free');
    expect(Lock.claim({ mode: 'listen' })).toBe(true);
    expect(Lock.state()).toBe('mine');
    expect(Lock.owned()).toBe(true);
    expect(Lock.busyElsewhere()).toBe(false);
  });

  it('refuses to claim while another live tab holds it', () => {
    Lock._internals.writeLock({ id: FOREIGN, ts: Date.now() });
    expect(Lock.busyElsewhere()).toBe(true);
    expect(Lock.claim()).toBe(false);
    expect(Lock.state()).toBe('theirs');
  });

  it('treats a stale foreign lock (crashed tab) as free', () => {
    Lock._internals.writeLock({ id: FOREIGN, ts: Date.now() - Lock._internals.TTL - 1000 });
    expect(Lock.state()).toBe('free');
    expect(Lock.claim()).toBe(true);
    expect(Lock.state()).toBe('mine');
  });

  it('can forcibly take over a live foreign lock', () => {
    Lock._internals.writeLock({ id: FOREIGN, ts: Date.now() });
    expect(Lock.busyElsewhere()).toBe(true);
    expect(Lock.takeover({ mode: 'converse' })).toBe(true);
    expect(Lock.state()).toBe('mine');
    expect(Lock.busyElsewhere()).toBe(false);
  });

  it('frees the lock on release', () => {
    Lock.claim();
    expect(Lock.state()).toBe('mine');
    Lock.release();
    expect(Lock.state()).toBe('free');
  });
});
