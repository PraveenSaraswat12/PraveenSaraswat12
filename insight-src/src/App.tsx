// Root: routing, boot, toasts, confirm dialog.
import React, { useEffect } from 'react';
import Landing from './pages/Landing';
import Auth from './pages/Auth';
import Studio from './pages/Studio';
import Pricing from './pages/Pricing';
import Settings from './pages/Settings';
import { Privacy, Terms, SecurityPage } from './pages/Legal';
import { Button, cx } from './ui/components';
import { useApp, useAuth } from './ui/state/stores';

const TOAST_TONE = {
  info: 'border-pulse-500/40 text-pulse-300',
  success: 'border-glow-500/40 text-glow-400',
  warn: 'border-amberx-400/40 text-amberx-400',
  error: 'border-rosex-400/40 text-rosex-400',
};

export default function App() {
  const view = useApp((s) => s.view);
  const toasts = useApp((s) => s.toasts);
  const dismiss = useApp((s) => s.dismissToast);
  const confirm = useApp((s) => s.confirm);
  const resolveConfirm = useApp((s) => s.resolveConfirm);
  const init = useAuth((s) => s.init);

  useEffect(() => { init(); }, [init]);

  return (
    <div className="font-body">
      {view === 'landing' && <Landing />}
      {view === 'auth' && <Auth />}
      {view === 'studio' && <Studio />}
      {view === 'pricing' && <Pricing />}
      {view === 'settings' && <Settings />}
      {view === 'privacy' && <Privacy />}
      {view === 'terms' && <Terms />}
      {view === 'security' && <SecurityPage />}

      {/* toasts */}
      <div className="fixed top-4 right-4 z-[60] space-y-2 max-w-sm" role="status" aria-live="polite">
        {toasts.map((t) => (
          <button
            key={t.id}
            onClick={() => dismiss(t.id)}
            className={cx('block w-full text-left glass-deep rounded-xl px-4 py-3 text-xs border anim-pop', TOAST_TONE[t.kind])}
          >
            {t.text}
          </button>
        ))}
      </div>

      {/* confirm dialog */}
      {confirm && (
        <div className="fixed inset-0 z-[70] grid place-items-center p-4" role="alertdialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm" onClick={() => resolveConfirm(false)} />
          <div className="relative glass-deep rounded-xl2 shadow-card w-full max-w-sm p-6 anim-pop">
            <h3 className="font-display text-mist-50">{confirm.title}</h3>
            <p className="text-xs text-mist-400 mt-2 leading-relaxed">{confirm.body}</p>
            <div className="flex justify-end gap-2 mt-5">
              <Button variant="ghost" onClick={() => resolveConfirm(false)}>Cancel</Button>
              <Button variant={confirm.danger ? 'danger' : 'primary'} onClick={() => resolveConfirm(true)}>
                {confirm.confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
