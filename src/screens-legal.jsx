import React from 'react';
import { Icon, LumenMark, Wordmark, Waveform, LiveWave, waveHeights, Avatar, Badge, Delta, SentDot, StatusPill, PrivacyChip, Dropdown, EvidenceList, Sparkline, LineChart, Donut, Ring, HBars, Legend, MoodStrip, smoothPath, useMounted, AppContext, useApp, ROUTES, useTweaks, TweaksPanel, TweakSection, TweakRow, TweakSlider, TweakToggle, TweakRadio, TweakSelect, TweakText, TweakNumber, TweakColor, TweakButton } from './kit.js';
/* ============================================================
   KITHRA — Legal: Privacy Policy, Terms, Data rights, Help
   Honest, demo-stage policy written for DPDP-style consent,
   purpose limitation, and withdrawal.
   ============================================================ */
function Section({ id, title, children }) {
  return (
    <section id={id} className="card card-pad" style={{ marginBottom:'var(--gap)' }}>
      <h2 className="display" style={{ fontSize:22, margin:'0 0 12px' }}>{title}</h2>
      <div className="stack" style={{ gap:10, fontSize:14, lineHeight:1.65, color:'var(--ink-2)' }}>{children}</div>
    </section>
  );
}

function Legal() {
  const { go } = useApp();
  return (
    <div className="scroll" style={{ height:'100%', overflow:'auto', background:'var(--paper)' }}>
      <div style={{ maxWidth:820, margin:'0 auto', padding:'28px clamp(16px,4vw,40px) 80px' }}>
        <div className="row" style={{ gap:12, marginBottom:24, alignItems:'center' }}>
          <button className="btn btn-icon btn-ghost" onClick={()=>go('landing')} aria-label="Back"><Icon name="chevL" size={18} /></button>
          <Wordmark size={30} />
          <div className="grow" />
          <button className="btn btn-soft btn-sm" onClick={()=>go('privacy')}><Icon name="shield" size={14} />Your data controls</button>
        </div>
        <h1 className="display" style={{ fontSize:'clamp(26px,4vw,36px)', margin:'0 0 6px' }}>Privacy, Terms &amp; Help</h1>
        <p className="muted" style={{ margin:'0 0 26px', fontSize:14 }}>Last updated June 2026 · Kithra is an early-stage product; this page states plainly what it does and doesn’t do with your data.</p>

        <Section id="privacy" title="Privacy Policy">
          <p><strong>Local-first by default.</strong> Audio you record or upload is analyzed on your own device. By default, your recordings, transcripts, books and reading progress live in your browser/app storage and never leave your device.</p>
          <p><strong>Cloud features are opt-in, per purpose.</strong> If you enable them, specific data flows to our backend (Supabase) and to Google's AI API strictly for the purpose you consented to: (1) <em>Cloud transcription</em> — the selected audio clip is sent for speech-to-text and not stored by us; (2) <em>Cloud AI insights</em> — transcript text is sent to generate coaching insights; (3) <em>Sync</em> — your book library and recording metadata are stored in your account. Each consent is recorded with a timestamp and can be withdrawn anytime in <em>Privacy &amp; Data → Consent</em>. Withdrawing stops that data flow immediately.</p>
          <p><strong>No training, no selling.</strong> Your content is never sold and never used to train shared models. AI requests run on API tiers that do not retain inputs for training.</p>
          <p><strong>Redaction.</strong> The "Redact names &amp; numbers" control masks emails, phone numbers and long digit sequences in transcripts before they are displayed or stored.</p>
          <p><strong>Deletion.</strong> "Delete all my data" erases local data on this device and, if you have an account, deletes your rows in our database. It is immediate and irreversible.</p>
          <p><strong>Security.</strong> Cloud data is protected with per-user row-level security; synced notes/transcripts are encrypted on your device before upload (device-bound key). Transport is TLS. The AI key never ships in the app — it stays server-side.</p>
        </Section>

        <Section id="recording" title="Recording other people — your responsibility">
          <p>Laws such as India's DPDP Act 2023 treat voice as identifiable personal data. <strong>Before recording a conversation, you must have the informed consent of the people in it.</strong> Kithra shows a reminder before live capture; you are responsible for obtaining consent where you record. Don't record where you don't have permission.</p>
        </Section>

        <Section id="terms" title="Terms of Use">
          <p>Kithra is provided “as is”, without warranty, during its evaluation phase. It is a self-coaching aid — <strong>not medical, psychological, legal or financial advice</strong>. AI outputs (transcripts, insights) can be wrong; verify before acting on them. You retain ownership of your content. Don't use Kithra to violate others' privacy or any law. We may update these terms; material changes will be shown in-app.</p>
        </Section>

        <Section id="rights" title="Your data rights">
          <p>At any time you can: <strong>export</strong> everything (Privacy &amp; Data → Export my data, machine-readable JSON), <strong>withdraw</strong> any consent (Consent panel), and <strong>delete</strong> everything (Delete all my data). No dark patterns: withdrawing or deleting is one click, not an email trail.</p>
        </Section>

        <Section id="help" title="Help & contact">
          <p>Questions, bugs, or a data request? Email <a href="mailto:saraswatpraveen21@gmail.com" style={{ color:'var(--accent-strong)' }}>saraswatpraveen21@gmail.com</a>. For data requests we respond within 30 days.</p>
        </Section>

        <div className="row center" style={{ gap:14, marginTop:8 }}>
          <button className="linkbtn" onClick={()=>go('landing')}>Home</button>
          <span className="faint">·</span>
          <button className="linkbtn" onClick={()=>go('pricing')}>Plans</button>
          <span className="faint">·</span>
          <button className="linkbtn" onClick={()=>go('privacy')}>Privacy controls</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Legal });

export { Legal };
