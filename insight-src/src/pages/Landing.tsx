// Landing: hero with pure-CSS mock dashboard, how-it-works, features,
// pricing teaser, security strip, footer.
import React from 'react';
import { Badge, Button, Card } from '../ui/components';
import {
  ArrowRight, BoltIcon, ChartIcon, ChatIcon, FileIcon, FilterIcon, LinkIcon,
  Logo, ShieldIcon, SparkIcon, TableIcon,
} from '../ui/icons';
import { useApp, useAuth } from '../ui/state/stores';
import { billing } from '../billing';

export function TopNav() {
  const navigate = useApp((s) => s.navigate);
  const user = useAuth((s) => s.user);
  return (
    <nav className="sticky top-0 z-40 glass-deep">
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
        <button onClick={() => navigate('landing')} className="flex items-center gap-2.5" aria-label="Kithra Insight home">
          <Logo size={24} />
          <span className="font-display font-semibold text-mist-50">Kithra <span className="text-pulse-400">Insight</span></span>
        </button>
        <div className="hidden sm:flex items-center gap-1 text-sm">
          <Button variant="ghost" onClick={() => navigate('pricing')}>Pricing</Button>
          <Button variant="ghost" onClick={() => navigate('security')}>Security</Button>
        </div>
        <div className="flex items-center gap-2">
          {user ? (
            <Button onClick={() => navigate('studio')}>Open studio <ArrowRight size={16} /></Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => navigate('auth')}>Sign in</Button>
              <Button onClick={() => navigate('auth')}>Start free</Button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

function HeroVisual() {
  const bars = [42, 58, 38, 72, 64, 88, 78, 96];
  return (
    <Card className="p-5 anim-float" >
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rosex-400/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-amberx-400/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-glow-400/70" />
        </div>
        <Badge tone="teal">preview · sample-orders.csv</Badge>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[['Revenue', '₹4.2M', '+18%'], ['Orders', '1,284', '+6%'], ['Overdue', '₹312K', '−9%']].map(([t, v, d]) => (
          <div key={t} className="rounded-xl bg-ink-800/80 border border-white/5 p-3">
            <div className="text-[10px] uppercase tracking-wide text-mist-500">{t}</div>
            <div className="font-display text-lg text-mist-50 num">{v}</div>
            <div className={`text-[10px] ${String(d).startsWith('−') ? 'text-rosex-400' : 'text-glow-400'}`}>{d} vs last month</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-3">
        <div className="col-span-3 rounded-xl bg-ink-800/80 border border-white/5 p-3">
          <div className="text-[10px] text-mist-500 mb-2">Revenue by month</div>
          <div className="flex items-end gap-1.5 h-24">
            {bars.map((h, i) => (
              <div key={i} className="hero-bar flex-1 rounded-t-md bg-gradient-to-t from-pulse-600 to-aura-400" style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
        <div className="col-span-2 rounded-xl bg-ink-800/80 border border-white/5 p-3 grid place-items-center">
          <div
            className="w-24 h-24 rounded-full grid place-items-center"
            style={{ background: 'conic-gradient(#3a6df4 0 38%, #7c4dff 38% 64%, #19c9a6 64% 82%, #ffb454 82% 100%)' }}
          >
            <div className="w-14 h-14 rounded-full bg-ink-900 grid place-items-center">
              <span className="text-[10px] text-mist-400">4 regions</span>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-4 rounded-xl bg-ink-800/80 border border-white/5 p-3 flex items-center gap-2">
        <SparkIcon size={14} className="text-aura-400 shrink-0" />
        <span className="text-[11px] text-mist-300">"West region drives 34% of revenue — and 41% of it is 60+ days overdue."</span>
      </div>
    </Card>
  );
}

const FEATURES = [
  { icon: <FileIcon />, title: 'Reads anything', body: 'Excel, CSV, PDF, JSON, code files or a web link — Insight understands the structure on its own.' },
  { icon: <LinkIcon />, title: 'Finds the relations', body: 'Tables that share keys get connected automatically, so customers, orders and payments talk to each other.' },
  { icon: <SparkIcon />, title: 'Asks before it builds', body: 'A short, smart questionnaire: your goal, the date that matters, aging buckets, filters, KPIs.' },
  { icon: <ChartIcon />, title: 'Dashboards that respond', body: 'Click any bar or slice and every chart re-filters. Trends, shares, aging, top-N — all live.' },
  { icon: <ChatIcon />, title: 'A grounded analyst', body: 'Ask anything in plain language. Every number in every answer is computed from your data, never invented.' },
  { icon: <ShieldIcon />, title: 'Private by design', body: 'Analysis runs in your browser. Data is encrypted on your device. Nothing leaves without consent.' },
];

export default function Landing() {
  const navigate = useApp((s) => s.navigate);
  const user = useAuth((s) => s.user);
  const plans = billing.plans();
  return (
    <div className="min-h-screen">
      <TopNav />
      {/* hero */}
      <header className="max-w-6xl mx-auto px-5 pt-16 pb-20 grid lg:grid-cols-2 gap-12 items-center">
        <div className="anim-fade-up">
          <Badge tone="violet">A Kithra product</Badge>
          <h1 className="font-display text-4xl sm:text-5xl leading-tight text-mist-50 mt-4">
            Where data becomes <span className="text-transparent bg-clip-text bg-gradient-to-r from-pulse-400 to-aura-400">decisions</span>.
          </h1>
          <p className="text-mist-400 mt-5 text-lg max-w-md">
            Upload Excel, PDF, CSV, code or a web link. Insight reads it, asks the right
            questions, builds connected live dashboards — and answers anything about your data.
          </p>
          <div className="flex flex-wrap gap-3 mt-8">
            <Button onClick={() => navigate(user ? 'studio' : 'auth')} className="px-6 py-3 text-base">
              Start analysing free <ArrowRight size={18} />
            </Button>
            <Button variant="soft" onClick={() => navigate('pricing')} className="px-6 py-3 text-base">See plans</Button>
          </div>
          <p className="text-xs text-mist-500 mt-4">No card needed · works on your phone · your files never leave your device</p>
        </div>
        <HeroVisual />
      </header>

      {/* how it works */}
      <section className="max-w-6xl mx-auto px-5 py-14">
        <h2 className="font-display text-2xl text-mist-50 text-center mb-10">Three steps, about three minutes</h2>
        <div className="grid sm:grid-cols-3 gap-5">
          {[
            ['1', 'Upload anything', 'Drag in spreadsheets, PDFs, exports, code — or paste a link with tables.'],
            ['2', 'Answer a few questions', 'Insight profiles every column, links your tables, then asks what matters to you.'],
            ['3', 'Decide with confidence', 'Cross-filtered dashboards, automatic findings, and a chat analyst on top of it all.'],
          ].map(([n, t, b]) => (
            <Card key={n} className="p-6">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-pulse-500 to-aura-500 grid place-items-center font-display text-white mb-4">{n}</div>
              <h3 className="font-display text-mist-50">{t}</h3>
              <p className="text-sm text-mist-400 mt-2">{b}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* features */}
      <section className="max-w-6xl mx-auto px-5 py-14">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f) => (
            <Card key={f.title} className="p-6 hover:border-pulse-500/30 transition">
              <div className="text-pulse-400 mb-3">{f.icon}</div>
              <h3 className="font-display text-mist-50">{f.title}</h3>
              <p className="text-sm text-mist-400 mt-2">{f.body}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* pricing teaser */}
      <section className="max-w-6xl mx-auto px-5 py-14">
        <h2 className="font-display text-2xl text-mist-50 text-center mb-2">Simple plans</h2>
        <p className="text-mist-400 text-center text-sm mb-10">Start free. Upgrade when your data grows.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((p) => (
            <Card key={p.id} className={`p-5 ${p.highlight ? 'ring-1 ring-pulse-500/50 shadow-glowBlue' : ''}`}>
              <div className="flex items-center justify-between">
                <h3 className="font-display text-mist-50">{p.label}</h3>
                {p.highlight && <Badge>Most popular</Badge>}
              </div>
              <div className="font-display text-2xl text-mist-50 mt-3 num">
                {p.monthlyUSD === null ? 'Custom' : p.monthlyUSD === 0 ? '$0' : `$${p.monthlyUSD}`}
                {p.monthlyUSD ? <span className="text-xs text-mist-500 font-body"> /mo</span> : null}
              </div>
              <p className="text-xs text-mist-400 mt-1">{p.tagline}</p>
            </Card>
          ))}
        </div>
        <div className="text-center mt-8">
          <Button variant="soft" onClick={() => navigate('pricing')}>Compare every plan <ArrowRight size={16} /></Button>
        </div>
      </section>

      {/* security strip */}
      <section className="max-w-6xl mx-auto px-5 py-10">
        <Card className="p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
          <div className="flex items-center gap-3">
            <ShieldIcon className="text-glow-400" />
            <div>
              <h3 className="font-display text-mist-50 text-sm">Your data stays yours</h3>
              <p className="text-xs text-mist-400">Encrypted on your device (AES-256) · raw rows never uploaded · erase everything anytime.</p>
            </div>
          </div>
          <Button variant="ghost" onClick={() => navigate('security')}>Read the security page <ArrowRight size={14} /></Button>
        </Card>
      </section>

      <footer className="border-t border-white/5 mt-10">
        <div className="max-w-6xl mx-auto px-5 py-8 flex flex-col sm:flex-row gap-4 items-center justify-between text-xs text-mist-500">
          <div className="flex items-center gap-2">
            <Logo size={16} /> <span>Kithra Insight — a Kithra product</span>
          </div>
          <div className="flex gap-4">
            <button onClick={() => navigate('privacy')} className="hover:text-mist-300">Privacy</button>
            <button onClick={() => navigate('terms')} className="hover:text-mist-300">Terms</button>
            <button onClick={() => navigate('security')} className="hover:text-mist-300">Security</button>
            <button onClick={() => navigate('pricing')} className="hover:text-mist-300">Pricing</button>
          </div>
        </div>
      </footer>
    </div>
  );
}

export { BoltIcon, FilterIcon, TableIcon };
