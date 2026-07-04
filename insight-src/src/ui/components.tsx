// Shared UI primitives.
import React from 'react';
import { XIcon } from './icons';

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

export function Button({
  variant = 'primary', busy, className, children, ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'soft' | 'danger';
  busy?: boolean;
}) {
  const styles = {
    primary:
      'bg-gradient-to-r from-pulse-500 to-aura-500 text-white shadow-glowBlue hover:brightness-110 active:brightness-95',
    soft: 'bg-ink-700 text-mist-50 hover:bg-ink-600 border border-white/5',
    ghost: 'text-mist-300 hover:text-mist-50 hover:bg-white/5',
    danger: 'bg-rosex-400/10 text-rosex-400 border border-rosex-400/30 hover:bg-rosex-400/20',
  }[variant];
  return (
    <button
      {...rest}
      disabled={rest.disabled || busy}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed',
        styles, className,
      )}
    >
      {busy && <Spinner size={14} />}
      {children}
    </button>
  );
}

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="animate-spin" aria-label="loading">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" fill="none" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function Card({ className, children, onClick }: { className?: string; children: React.ReactNode; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={cx('glass rounded-xl2 shadow-card', className)}>
      {children}
    </div>
  );
}

export function Field({
  label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-mist-400 mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-mist-500 mt-1">{hint}</span>}
    </label>
  );
}

export const inputCls =
  'w-full rounded-xl bg-ink-800/80 border border-white/10 px-3.5 py-2.5 text-sm text-mist-50 placeholder-mist-500 outline-none focus:border-pulse-500/60 transition';

export function Modal({
  open, onClose, title, children, wide,
}: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm" onClick={onClose} />
      <div className={cx('relative glass-deep rounded-xl2 shadow-card w-full anim-pop', wide ? 'max-w-2xl' : 'max-w-md')}>
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h3 className="font-display text-base text-mist-50">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="text-mist-400 hover:text-mist-50 p-1 rounded-lg hover:bg-white/5">
            <XIcon size={18} />
          </button>
        </div>
        <div className="px-5 pb-5">{children}</div>
      </div>
    </div>
  );
}

export function EmptyState({
  icon, title, body, action,
}: { icon: React.ReactNode; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="text-center py-14 px-6 anim-fade-up">
      <div className="mx-auto w-12 h-12 grid place-items-center rounded-2xl bg-ink-700 text-pulse-400 mb-4">{icon}</div>
      <h3 className="font-display text-lg text-mist-50">{title}</h3>
      <p className="text-sm text-mist-400 max-w-sm mx-auto mt-1.5">{body}</p>
      {action && <div className="mt-5 flex justify-center gap-3">{action}</div>}
    </div>
  );
}

export function Badge({ children, tone = 'blue' }: { children: React.ReactNode; tone?: 'blue' | 'violet' | 'teal' | 'amber' | 'rose' | 'gray' }) {
  const tones = {
    blue: 'bg-pulse-500/15 text-pulse-300 border-pulse-500/30',
    violet: 'bg-aura-500/15 text-aura-400 border-aura-500/30',
    teal: 'bg-glow-500/15 text-glow-400 border-glow-500/30',
    amber: 'bg-amberx-400/15 text-amberx-400 border-amberx-400/30',
    rose: 'bg-rosex-400/15 text-rosex-400 border-rosex-400/30',
    gray: 'bg-white/5 text-mist-400 border-white/10',
  }[tone];
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium', tones)}>
      {children}
    </span>
  );
}

export function Progress({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (100 * value) / max) : 0;
  return (
    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden" role="progressbar" aria-valuenow={value} aria-valuemax={max}>
      <div className="h-full rounded-full bg-gradient-to-r from-pulse-500 to-aura-500 transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('shimmer rounded-xl bg-white/5', className)} />;
}
