// Sign in: Google OAuth, phone OTP, or local guest mode.
import React, { useState } from 'react';
import { Button, Card, Field, inputCls } from '../ui/components';
import { GoogleIcon, Logo, ShieldIcon } from '../ui/icons';
import { TopNav } from './Landing';
import { useApp, useAuth } from '../ui/state/stores';

export default function Auth() {
  const { google, sendOtp, verifyOtp, guest } = useAuth();
  const toast = useApp((s) => s.toast);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'start' | 'code'>('start');
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try { await fn(); } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Something went wrong');
    } finally { setBusy(null); }
  };

  return (
    <div className="min-h-screen">
      <TopNav />
      <div className="max-w-md mx-auto px-5 py-16 anim-fade-up">
        <div className="text-center mb-8">
          <Logo size={32} className="mx-auto" />
          <h1 className="font-display text-2xl text-mist-50 mt-4">Welcome to Kithra Insight</h1>
          <p className="text-sm text-mist-400 mt-1.5">One Kithra account works across all Kithra products.</p>
        </div>
        <Card className="p-6 space-y-4">
          <Button
            className="w-full bg-white text-ink-900 hover:bg-mist-100 shadow-none"
            variant="soft"
            busy={busy === 'google'}
            onClick={() => run('google', google)}
          >
            <GoogleIcon /> Continue with Google
          </Button>

          <div className="flex items-center gap-3 text-[11px] text-mist-500">
            <span className="h-px flex-1 bg-white/10" /> or use your phone <span className="h-px flex-1 bg-white/10" />
          </div>

          {stage === 'start' ? (
            <div className="space-y-3">
              <Field label="Phone number" hint="Indian numbers can skip the +91.">
                <input
                  className={inputCls} type="tel" placeholder="+91 98765 43210"
                  value={phone} onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                />
              </Field>
              <Button
                className="w-full" busy={busy === 'otp'}
                disabled={phone.replace(/\D/g, '').length < 8}
                onClick={() => run('otp', async () => { await sendOtp(phone); setStage('code'); toast('success', 'Code sent — check your SMS'); })}
              >
                Send me a code
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <Field label={`6-digit code sent to ${phone}`}>
                <input
                  className={`${inputCls} tracking-[0.4em] text-center font-display`}
                  inputMode="numeric" maxLength={6} placeholder="••••••"
                  value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                />
              </Field>
              <Button
                className="w-full" busy={busy === 'verify'} disabled={code.length !== 6}
                onClick={() => run('verify', () => verifyOtp(phone, code))}
              >
                Verify & continue
              </Button>
              <button className="text-xs text-mist-500 hover:text-mist-300 w-full" onClick={() => setStage('start')}>
                Use a different number
              </button>
            </div>
          )}
        </Card>

        <button
          className="mt-6 w-full text-sm text-mist-400 hover:text-mist-200 transition"
          onClick={() => run('guest', () => guest())}
          disabled={busy === 'guest'}
        >
          Explore as guest — everything stays on this device
        </button>

        <p className="flex items-start gap-2 text-[11px] text-mist-500 mt-6">
          <ShieldIcon size={14} className="shrink-0 mt-0.5 text-glow-400" />
          Signing in only identifies you for plans and cloud AI. Your data files are analysed
          in your browser and stored encrypted on your device — not on our servers.
        </p>
      </div>
    </div>
  );
}
