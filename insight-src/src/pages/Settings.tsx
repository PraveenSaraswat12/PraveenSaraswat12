// Settings: account, plan & usage, privacy & consent, encrypted backups.
import React, { useEffect, useRef, useState } from 'react';
import { billing } from '../billing';
import { security } from '../security';
import { Badge, Button, Card, Field, inputCls, Modal, Progress } from '../ui/components';
import { DownloadIcon, GlobeIcon, ShieldIcon, UserIcon } from '../ui/icons';
import { TopNav } from './Landing';
import { useApp, useAuth, useData } from '../ui/state/stores';

export default function Settings() {
  const user = useAuth((s) => s.user);
  const plan = useAuth((s) => s.plan);
  const signOut = useAuth((s) => s.signOut);
  const navigate = useApp((s) => s.navigate);
  const toast = useApp((s) => s.toast);
  const askConfirm = useApp((s) => s.askConfirm);
  const data = useData();

  const [consent, setConsent] = useState(security.getCloudConsent());
  const [sync, setSync] = useState(security.getCloudSync());
  const [cloudReady, setCloudReady] = useState<boolean | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const planDef = billing.plan(plan);
  const usage = billing.usageToday();

  useEffect(() => {
    let alive = true;
    if (user && user.provider !== 'guest') {
      security.cloudAvailable().then((ok) => { if (alive) setCloudReady(ok); }).catch(() => { if (alive) setCloudReady(false); });
    } else {
      setCloudReady(false);
    }
    return () => { alive = false; };
  }, [user]);

  const doExport = async () => {
    setBusy(true);
    try {
      const blob = await security.exportWorkspace(data.toWorkspace(), pass);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${data.wsName.replace(/\W+/g, '-').toLowerCase()}.kithra`;
      a.click();
      URL.revokeObjectURL(a.href);
      setExportOpen(false); setPass('');
      toast('success', 'Encrypted backup downloaded.');
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Export failed');
    } finally { setBusy(false); }
  };

  const doImport = async (file: File) => {
    setBusy(true);
    try {
      const ws = await security.importWorkspace(file, pass);
      await security.saveWorkspace(ws);
      await data.loadWorkspaceById(ws.id);
      setImportOpen(false); setPass('');
      toast('success', `Workspace "${ws.name}" restored.`);
      navigate('studio');
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Import failed');
    } finally { setBusy(false); }
  };

  const eraseAll = async () => {
    const ok = await askConfirm(
      'Erase everything on this device?',
      'All workspaces, datasets, chat history and local settings will be permanently deleted from this browser. This also signs you out (including the main Kithra app on this device). Backups you exported are not affected.',
      'Erase everything', true,
    );
    if (!ok) return;
    await security.eraseAllLocalData();
    location.hash = '#/';
    location.reload();
  };

  if (!user) {
    return (
      <div className="min-h-screen"><TopNav />
        <div className="max-w-md mx-auto px-5 py-20 text-center">
          <p className="text-mist-400">Sign in to manage your account.</p>
          <Button className="mt-4" onClick={() => navigate('auth')}>Go to sign in</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <TopNav />
      <div className="max-w-2xl mx-auto px-5 py-12 space-y-5">
        <h1 className="font-display text-2xl text-mist-50">Settings</h1>

        {/* account */}
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pulse-500 to-aura-500 grid place-items-center font-display text-lg text-white">
              {(user.name ?? 'U')[0].toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="text-mist-50 font-medium">{user.name}</div>
              <div className="text-xs text-mist-400">{user.email ?? user.phone ?? 'Local guest'} · via {user.provider}</div>
            </div>
            <Button variant="ghost" onClick={signOut}>Sign out</Button>
          </div>
          {user.provider === 'guest' && (
            <p className="text-[11px] text-amberx-400 mt-3">
              Guest mode keeps everything on this device. Sign in with Google or phone to buy a plan and use cloud AI.
            </p>
          )}
        </Card>

        {/* plan & usage */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-mist-50 text-sm flex items-center gap-2"><UserIcon size={16} /> Plan & usage</h2>
            <Badge tone={plan === 'free' ? 'gray' : 'blue'}>{planDef.label}</Badge>
          </div>
          <div className="mt-4 space-y-1.5">
            <div className="flex justify-between text-xs text-mist-400">
              <span>AI questions today</span>
              <span className="num">{usage.aiQuestions} / {planDef.limits.aiQuestionsPerDay}</span>
            </div>
            <Progress value={usage.aiQuestions} max={planDef.limits.aiQuestionsPerDay} />
          </div>
          <Button variant="soft" className="mt-5" onClick={() => navigate('pricing')}>
            {plan === 'free' ? 'Upgrade plan' : 'Manage plan'}
          </Button>
        </Card>

        {/* privacy */}
        <Card className="p-6">
          <h2 className="font-display text-mist-50 text-sm flex items-center gap-2"><ShieldIcon size={16} /> Privacy</h2>
          <label className="flex items-start gap-3 mt-4 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5 accent-[#3a6df4] w-4 h-4"
              checked={consent}
              onChange={(e) => { security.setCloudConsent(e.target.checked); setConsent(e.target.checked); }}
            />
            <span className="text-xs text-mist-300">
              Allow the cloud AI analyst to see <b>compact numeric summaries</b> of my data
              (totals, top categories, column names) for deeper answers.
              Raw rows never leave this device. <span className="text-mist-500">Off by default.</span>
            </span>
          </label>
          <div className="mt-5 pt-4 border-t border-white/5">
            <Button variant="danger" onClick={eraseAll}>Erase all local data</Button>
          </div>
        </Card>

        {/* cloud sync */}
        <Card className="p-6">
          <h2 className="font-display text-mist-50 text-sm flex items-center gap-2"><GlobeIcon size={16} /> Cloud backup</h2>
          <p className="text-xs text-mist-400 mt-2">
            Keeps an encrypted copy of your workspaces in your Kithra cloud, so you can open
            them from any device you sign in on. Data is sealed on this device before upload.
          </p>
          {user.provider === 'guest' ? (
            <p className="text-[11px] text-amberx-400 mt-3">Sign in with Google or phone to use cloud backup.</p>
          ) : cloudReady === false ? (
            <p className="text-[11px] text-amberx-400 mt-3">
              One-time setup needed: run <code className="text-mist-300">setup/supabase.sql</code> in your
              Supabase SQL editor (2 minutes, instructions in the User Guide), then reload.
            </p>
          ) : (
            <label className="flex items-start gap-3 mt-4 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 accent-[#3a6df4] w-4 h-4"
                checked={sync}
                disabled={cloudReady === null}
                onChange={(e) => {
                  security.setCloudSync(e.target.checked);
                  setSync(e.target.checked);
                  if (e.target.checked) {
                    data.persistSoon();
                    toast('success', 'Cloud backup is on — workspaces will sync as you work.');
                  }
                }}
              />
              <span className="text-xs text-mist-300">
                Back up my workspaces to my Kithra cloud (encrypted).{' '}
                <span className="text-mist-500">Off by default. Not zero-knowledge — protected by your account; a passphrase mode is planned.</span>
              </span>
            </label>
          )}
          {sync && cloudReady && (
            <div className="mt-4 pt-3 border-t border-white/5">
              <Button
                variant="danger"
                onClick={async () => {
                  const ok = await askConfirm(
                    'Delete all cloud backups?',
                    'Every workspace copy stored in your Kithra cloud will be permanently deleted. Local copies on this device are kept.',
                    'Delete cloud copies', true,
                  );
                  if (!ok) return;
                  try { await security.cloudDeleteAll(); toast('success', 'Cloud copies deleted.'); await data.refreshList(); }
                  catch (e) { toast('error', e instanceof Error ? e.message : 'Could not delete'); }
                }}
              >
                Delete all cloud backups
              </Button>
            </div>
          )}
        </Card>

        {/* backups */}
        <Card className="p-6">
          <h2 className="font-display text-mist-50 text-sm flex items-center gap-2"><DownloadIcon size={16} /> Encrypted backups</h2>
          <p className="text-xs text-mist-400 mt-2">
            A .kithra file protected by your passphrase — move workspaces between devices or keep them for the long run.
          </p>
          <div className="flex gap-3 mt-4">
            <Button variant="soft" disabled={!data.sources.length || !billing.canExport()} onClick={() => setExportOpen(true)}>
              Export current workspace
            </Button>
            <Button variant="ghost" onClick={() => setImportOpen(true)}>Import a backup</Button>
          </div>
          {!billing.canExport() && (
            <p className="text-[11px] text-amberx-400 mt-2">Backups are part of Pro — upgrade to enable them.</p>
          )}
        </Card>
      </div>

      <Modal open={exportOpen} onClose={() => setExportOpen(false)} title="Export encrypted backup">
        <Field label="Passphrase (min 6 characters)" hint="You'll need this exact passphrase to restore the file. We can't recover it.">
          <input className={inputCls} type="password" value={pass} onChange={(e) => setPass(e.target.value)} />
        </Field>
        <Button className="w-full mt-4" busy={busy} disabled={pass.length < 6} onClick={doExport}>Download .kithra file</Button>
      </Modal>

      <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Import a backup">
        <Field label="Passphrase used at export">
          <input className={inputCls} type="password" value={pass} onChange={(e) => setPass(e.target.value)} />
        </Field>
        <input
          ref={fileRef} type="file" accept=".kithra" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) doImport(f); }}
        />
        <Button className="w-full mt-4" busy={busy} disabled={pass.length < 6} onClick={() => fileRef.current?.click()}>
          Choose .kithra file
        </Button>
      </Modal>
    </div>
  );
}
