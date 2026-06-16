import { describe, it, expect } from 'vitest';
import { redactPII } from '../components.jsx';

// PII redaction is a privacy-critical guard (used before any transcript leaves
// the device for cloud transcription), so lock its behaviour in.
describe('redactPII', () => {
  it('masks email addresses', () => {
    const out = redactPII('reach me at john.doe@example.com please');
    expect(out).toContain('[email]');
    expect(out).not.toContain('john.doe@example.com');
  });

  it('masks phone numbers, with or without a country code', () => {
    expect(redactPII('call +1 (415) 555-2671 now')).toContain('[phone]');
    expect(redactPII('ring 415-555-2671')).toContain('[phone]');
  });

  it('masks long digit sequences', () => {
    expect(redactPII('order 1234567 shipped')).toContain('[number]');
  });

  it('leaves ordinary text untouched', () => {
    expect(redactPII('hello world, nothing private here')).toBe('hello world, nothing private here');
  });

  it('handles empty / nullish input safely', () => {
    expect(redactPII('')).toBe('');
    expect(redactPII(null)).toBe(null);
    expect(redactPII(undefined)).toBe(undefined);
  });
});
