import React from 'react';
import { Icon, LumenMark, Wordmark, Waveform, LiveWave, waveHeights, Avatar, Badge, Delta, SentDot, StatusPill, PrivacyChip, Dropdown, EvidenceList, Sparkline, LineChart, Donut, Ring, HBars, Legend, MoodStrip, smoothPath, useMounted, AppContext, useApp, ROUTES, useTweaks, TweaksPanel, TweakSection, TweakRow, TweakSlider, TweakToggle, TweakRadio, TweakSelect, TweakText, TweakNumber, TweakColor, TweakButton } from './kit.js';
/* ============================================================
   KITHRA — Plans & pricing (real Razorpay checkout)
   Plus $30/mo · Premium $90/mo — shown in USD and INR (₹).
   Capture is free; insight is paid. Annual = 2 months free.
   ============================================================ */

// headline monthly price per plan, per currency
const PRICE = {
  plus:    { USD: 30, INR: 2499 },
  premium: { USD: 90, INR: 7499 },
};
const SYM = { USD: '$', INR: '₹' };
const fmt = (cur, n) => SYM[cur] + (cur === 'INR' ? n.toLocaleString('en-IN') : n.toLocaleString('en-US'));
// annual shows the per-month equivalent (10/12 of monthly) + the yearly total
const monthlyShown = (cur, plan, annual) => annual ? Math.round(PRICE[plan][cur] * 10 / 12) : PRICE[plan][cur];
const yearlyTotal  = (cur, plan) => PRICE[plan][cur] * 10;

function loadRazorpay() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load the payment library — check your connection.'));
    document.body.appendChild(s);
  });
}

function Pricing() {
  const { mode, go, plan, setPlan, user, showToast } = useApp();
  const Cloud = window.KithraCloud;
  const isBiz = mode === 'business';
  const [annual, setAnnual] = React.useState(true);
  const [cur, setCur] = React.useState('USD');
  const [busy, setBusy] = React.useState('');

  // reflect the real (server-recorded) plan when signed in
  React.useEffect(() => {
    let on = true;
    (async () => {
      try { const s = Cloud && Cloud.getSubscription && await Cloud.getSubscription(); if (on && s && s.status === 'active' && s.plan) setPlan(s.plan); } catch (e) {}
    })();
    return () => { on = false; };
  }, [user]);

  // real Razorpay checkout: server makes the order, opens Checkout, verifies the
  // signature on return, then unlocks the plan.
  const checkout = async (planId) => {
    if (!user) { showToast('Sign in to upgrade', 'shield'); go('auth'); return; }
    setBusy(planId);
    try {
      const order = await Cloud.createOrder(planId, annual ? 'year' : 'month', cur);
      await loadRazorpay();
      const rzp = new window.Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: 'Kithra',
        description: (planId === 'premium' ? 'Premium' : 'Plus') + ' · Where talk becomes insight',
        order_id: order.order_id,
        prefill: { email: (user && user.email) || '', contact: (user && user.phone) || '' },
        theme: { color: '#6d5efc' },
        handler: async (resp) => {
          try {
            const v = await Cloud.verifyPayment({ razorpay_order_id: resp.razorpay_order_id, razorpay_payment_id: resp.razorpay_payment_id, razorpay_signature: resp.razorpay_signature, plan: planId });
            if (v && v.ok) { setPlan(planId); showToast((planId === 'premium' ? 'Premium' : 'Plus') + ' is live — payment received', 'spark'); go('library'); }
            else showToast('We couldn’t verify that payment.', 'x');
          } catch (e) { showToast((e && e.message) || 'Payment verification failed', 'x'); }
        },
      });
      rzp.on('payment.failed', () => showToast('Payment failed or was cancelled.', 'x'));
      rzp.open();
    } catch (e) {
      showToast((e && e.message) || 'Payments aren’t switched on yet.', 'x');
    }
    setBusy('');
  };

  const plans = [
    {
      id:'free', name:'Free', tagline:'Capture everything, forever',
      accent:'var(--viz-1)',
      features:[
        ['mic','Live capture on mobile (always-on)'],
        ['refresh','Auto cloud backup every 15 min'],
        ['layers','Recordings library + playback'],
        ['clock','60-day storage · 2 GB'],
        ['calendar','Date & length filters'],
        ['book','Browse the 100+ book library'],
        ['chat','Ask Kithra — 10 questions / month'],
      ],
      note:'Mobile only. No card required.',
    },
    {
      id:'plus', name:'Plus', tagline:'Understand yourself & every talk',
      accent:'var(--accent)', popular: !isBiz,
      features:[
        ['check','Everything in Free, plus:'],
        ['grid','Web & desktop app (capture anywhere)'],
        ['layers','30 GB storage · 180-day retention'],
        ['spark','AI categories, topics & tone filters'],
        ['book','Book summaries & key ideas (100+ books)'],
        ['chat','Unlimited Ask Kithra + voice agent'],
        ['download','Download & bulk-download recordings'],
        ['file','Transcript download'],
      ],
      note:'For individuals going deep.',
    },
    {
      id:'premium', name:'Premium', tagline:'Insights, people & teams',
      accent:'var(--viz-5)', popular: isBiz,
      features:[
        ['check','Everything in Plus, plus:'],
        ['user','People & relationship filters'],
        ['book','Read full books in-app (public-domain)'],
        ['spark','Insights on any recording — just tap'],
        ['mic','Talk to the agent about any recording'],
        ['layers','Unlimited storage & retention'],
        ['download','PDF export (summary or transcript)'],
        ['shield','SSO, SOC 2 & priority support'],
      ],
      note:'Everything, for power users & teams.',
    },
  ];

  return (
    <div className="page">
      <div className="stack center" style={{ gap:10, textAlign:'center', marginBottom:26 }}>
        <span className="eyebrow">Plans</span>
        <h1 className="display" style={{ fontSize:'clamp(26px,3vw,38px)', margin:0 }}>Capture is free. Pay to understand it.</h1>
        <p className="muted" style={{ fontSize:15, margin:0, maxWidth:560, lineHeight:1.55 }}>
          Listening, storage and backup are free for everyone, forever. Upgrade when you want Kithra to turn your recordings into insight.
        </p>
        <div className="row" style={{ gap:10, marginTop:8, flexWrap:'wrap', justifyContent:'center' }}>
          <div className="seg">
            <button className={!annual?'on':''} onClick={()=>setAnnual(false)}>Monthly</button>
            <button className={annual?'on':''} onClick={()=>setAnnual(true)}>Annual · 2 months free</button>
          </div>
          <div className="seg">
            <button className={cur==='USD'?'on':''} onClick={()=>setCur('USD')}>$ USD</button>
            <button className={cur==='INR'?'on':''} onClick={()=>setCur('INR')}>₹ INR</button>
          </div>
        </div>
      </div>

      <div className="grid g-3 price-grid">
        {plans.map(p=>{
          const isCurrent = p.id === plan || (p.id==='free' && plan==='free');
          const other = cur==='USD' ? 'INR' : 'USD';
          return (
          <div key={p.id} className={`card card-pad price-card ${p.popular?'pop':''}`} style={{ '--pc':p.accent }}>
            {p.popular && <span className="price-badge">Recommended</span>}
            <div className="stack" style={{ gap:4 }}>
              <span style={{ fontWeight:700, fontSize:18, color:'var(--pc)' }}>{p.name}</span>
              <span className="faint" style={{ fontSize:13 }}>{p.tagline}</span>
            </div>
            {p.id==='free' ? (
              <>
                <div className="row" style={{ alignItems:'baseline', gap:4, margin:'18px 0 4px' }}>
                  <span className="metric-num" style={{ fontSize:38 }}>{fmt(cur,0)}</span>
                  <span className="faint" style={{ fontSize:14, fontWeight:600 }}>forever</span>
                </div>
                <span className="faint" style={{ fontSize:12 }}>{' '}</span>
              </>
            ) : (
              <>
                <div className="row" style={{ alignItems:'baseline', gap:4, margin:'18px 0 2px' }}>
                  <span className="metric-num" style={{ fontSize:38 }}>{fmt(cur, monthlyShown(cur, p.id, annual))}</span>
                  <span className="faint" style={{ fontSize:14, fontWeight:600 }}>/mo</span>
                </div>
                <span className="faint" style={{ fontSize:12 }}>
                  {annual ? `billed ${fmt(cur, yearlyTotal(cur, p.id))}/yr` : 'billed monthly'} · ≈ {fmt(other, monthlyShown(other, p.id, annual))}/mo
                </span>
              </>
            )}
            <button className={`btn ${p.id==='free'?'btn-soft':'btn-primary'} btn-lg`} disabled={busy===p.id}
              style={{ width:'100%', margin:'16px 0 18px', ...(p.popular?{background:'var(--pc)',color:'#fff'}:{}) }}
              onClick={()=>{
                if (p.id==='free') { setPlan('free'); showToast('You’re on the Free plan', 'check'); return; }
                if (isCurrent) { go('library'); return; }
                checkout(p.id);
              }}>
              {busy===p.id ? 'Opening checkout…' : isCurrent ? 'Current plan' : p.id==='free' ? 'Current plan' : <><Icon name="spark" size={16} />Upgrade to {p.name}</>}
            </button>
            <div className="stack" style={{ gap:11 }}>
              {p.features.map((f,i)=>(
                <div key={i} className="row" style={{ gap:10, alignItems:'flex-start' }}>
                  <span className="center" style={{ width:22, height:22, borderRadius:7, background:'color-mix(in srgb,var(--pc) 14%, transparent)', color:'var(--pc)', flex:'none', marginTop:1 }}><Icon name={f[0]} size={13} /></span>
                  <span style={{ fontSize:13.5, lineHeight:1.4, fontWeight: f[1].endsWith('plus:')?700:500 }}>{f[1]}</span>
                </div>
              ))}
            </div>
            <span className="faint" style={{ fontSize:11.5, display:'block', marginTop:16 }}>{p.note}</span>
          </div>
        );})}
      </div>

      {/* trust + payment strip */}
      <div className="card card-pad" style={{ marginTop:'var(--gap)', background:'var(--surface-2)' }}>
        <div className="grid g-3" style={{ gap:'var(--gap)' }}>
          {[
            ['lock','Private by default','Your audio is encrypted and never used to train shared models — on every plan.'],
            ['shield','Secure checkout','Payments run through Razorpay — UPI, cards, net-banking & wallets. We never see your card.'],
            ['refresh','Cancel anytime','Downgrade and your captures + 60-day history stay free, always.'],
          ].map((x,i)=>(
            <div key={i} className="row" style={{ gap:12, alignItems:'flex-start' }}>
              <span className="center" style={{ width:38, height:38, borderRadius:11, background:'var(--accent-soft)', color:'var(--accent-strong)', flex:'none' }}><Icon name={x[0]} size={19} /></span>
              <div className="stack" style={{ gap:2 }}>
                <span style={{ fontWeight:650, fontSize:13.5 }}>{x[1]}</span>
                <span className="faint" style={{ fontSize:12.5, lineHeight:1.45 }}>{x[2]}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Pricing });


export { Pricing };
