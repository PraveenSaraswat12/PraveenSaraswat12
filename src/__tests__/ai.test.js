import { describe, it, expect } from 'vitest';
import { buildContext } from '../ai.js';

// buildContext is the grounding the AI "remembers"; it must never invent data
// and must faithfully reflect the user's real clips/books.
describe('buildContext', () => {
  it('states there are no recordings when the library is empty', () => {
    const ctx = buildContext({ mode: 'business' });
    expect(ctx).toContain('USER MODE: business');
    expect(ctx).toContain('THE USER HAS NO RECORDINGS YET.');
  });

  it('lists other recordings in the library', () => {
    const ctx = buildContext({ clips: [{ id: 1, name: 'Discovery call', transcript: 'hi there' }], mode: 'business' });
    expect(ctx).toContain('OTHER RECORDINGS');
    expect(ctx).toContain('Discovery call');
  });

  it('foregrounds the focused recording and its transcript', () => {
    const ctx = buildContext({ focus: { id: 9, name: 'Standup', transcript: 'sprint planning notes' }, mode: 'personal' });
    expect(ctx).toContain('USER MODE: personal');
    expect(ctx).toContain('FOCUSED RECORDING');
    expect(ctx).toContain('sprint planning notes');
  });

  it('includes the book library when provided', () => {
    const ctx = buildContext({ books: [{ title: 'Never Split the Difference', author: 'Chris Voss' }], mode: 'business' });
    expect(ctx).toContain("THE USER'S BOOK LIBRARY");
    expect(ctx).toContain('Never Split the Difference');
  });
});
