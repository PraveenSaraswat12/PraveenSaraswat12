/* ============================================================
   LUMEN — mock data (window.LUMEN)
   ============================================================ */
(function () {
  // tiny helpers to build series
  const series = (arr) => arr.map((v, i) => ({ x: i, y: v }));

  const business = {
    label: 'Business',
    org: 'Northwind Sales',
    metrics: [
      { id:'win', label:'Win-rate signal', value:'34', unit:'%', delta:+6, deltaLabel:'vs last qtr', spark:[20,22,21,24,26,25,28,30,29,32,33,34] },
      { id:'sent', label:'Avg. call sentiment', value:'+0.42', unit:'', delta:+0.08, deltaLabel:'trending up', spark:[0.2,0.25,0.22,0.3,0.28,0.34,0.31,0.36,0.38,0.37,0.4,0.42] },
      { id:'talk', label:'Rep talk-ratio', value:'58', unit:'%', delta:-5, deltaLabel:'more listening', good:true, spark:[68,66,67,64,63,62,61,60,59,59,58,58] },
      { id:'deals', label:'Deals at risk', value:'12', unit:'', delta:+3, deltaLabel:'need attention', good:false, spark:[6,7,7,8,9,8,10,9,11,10,11,12] },
    ],
    winPatterns: [
      { t:'Multi-threading to 3+ stakeholders', lift:'+28% win', detail:'Deals looping in a second stakeholder by call 2 close far more often.', n:412 },
      { t:'Quantified pain in discovery', lift:'+22% win', detail:'Reps who anchor a dollar cost to the problem hold price better.', n:367 },
      { t:'Next step booked on the call', lift:'+19% win', detail:'Verbal "let\u2019s get time on the calendar" before hanging up.', n:531 },
      { t:'Mentioning a peer customer', lift:'+14% win', detail:'A relevant logo reference shifts sentiment positive within 90s.', n:288 },
    ],
    objections: [
      { t:'Price / budget', share:31, trend:+4, sample:'\u201cThis is more than we set aside this quarter.\u201d' },
      { t:'Already using a competitor', share:24, trend:-2, sample:'\u201cWe\u2019re pretty locked in with our current tool.\u201d' },
      { t:'No urgency / timing', share:19, trend:+1, sample:'\u201cLet\u2019s revisit next quarter.\u201d' },
      { t:'Need more stakeholders', share:14, trend:-3, sample:'\u201cI\u2019d have to run this by my VP.\u201d' },
      { t:'Integration concerns', share:12, trend:+2, sample:'\u201cNot sure it plays nice with our stack.\u201d' },
    ],
    nextActions: [
      { who:'Meridian Health', avatar:'MH', color:'#5566d6', risk:'warm', action:'Send the ROI one-pager \u2014 they raised budget twice but liked the peer story.', val:'$48k', stage:'Proposal' },
      { who:'Atlas Logistics', avatar:'AL', color:'#2bb3a3', risk:'hot', action:'Book the technical review \u2014 champion is ready, blocker is integration.', val:'$120k', stage:'Negotiation' },
      { who:'Brightwave', avatar:'BW', color:'#e0a23f', risk:'cool', action:'Re-engage with urgency \u2014 sentiment dropped after pricing call.', val:'$26k', stage:'Discovery' },
      { who:'Kepler Dynamics', avatar:'KD', color:'#e2647d', risk:'hot', action:'Loop in their VP Ops \u2014 single-threaded for 3 calls now.', val:'$87k', stage:'Proposal' },
    ],
    recent: [
      { id:'c1', title:'Meridian Health \u2014 Pricing review', who:'Dana R. \u00b7 with Priya M.', dur:'32:14', when:'2h ago', sent:'pos', status:'analyzed', tag:'Proposal' },
      { id:'c2', title:'Atlas Logistics \u2014 Technical deep-dive', who:'Sam K. \u00b7 with Theo V.', dur:'47:02', when:'5h ago', sent:'pos', status:'analyzed', tag:'Negotiation' },
      { id:'c3', title:'Brightwave \u2014 Discovery', who:'Dana R. \u00b7 with Lena W.', dur:'28:39', when:'Yesterday', sent:'neg', status:'analyzed', tag:'Discovery' },
      { id:'c4', title:'Kepler Dynamics \u2014 Follow-up', who:'Sam K. \u00b7 with Omar H.', dur:'19:51', when:'Yesterday', sent:'neu', status:'transcribing', tag:'Proposal' },
      { id:'c5', title:'Vertex Retail \u2014 Intro call', who:'Dana R. \u00b7 with Cara B.', dur:'24:08', when:'2 days ago', sent:'pos', status:'analyzed', tag:'Discovery' },
    ],
    sentimentTrend: series([0.18,0.22,0.2,0.28,0.26,0.32,0.3,0.35,0.33,0.38,0.4,0.42]),
    topicsTrend: [
      { name:'Pricing', color:'var(--viz-1)', data:series([30,32,34,33,38,40,42,41,44,46,45,48]) },
      { name:'Onboarding', color:'var(--viz-2)', data:series([12,14,13,16,15,18,20,19,22,21,24,26]) },
      { name:'Security', color:'var(--viz-3)', data:series([8,9,11,10,14,13,16,18,17,20,22,24]) },
    ],
    evidence: [
      { title:'SPIN Selling', author:'Neil Rackham', type:'book' },
      { title:'The Challenger Sale', author:'Dixon & Adamson', type:'book' },
      { title:'Never Split the Difference', author:'Chris Voss', type:'book' },
      { title:'MEDDIC qualification', author:'B2B sales framework', type:'framework' },
    ],
    evidenceNote: 'Kithra benchmarks your calls against established sales methodologies — so recommendations reflect proven practice, not guesswork.',
  };

  const personal = {
    label: 'Personal',
    org: 'Your reflections',
    metrics: [
      { id:'calm', label:'Calm-tone days', value:'18', unit:'/30', delta:+4, deltaLabel:'this month', spark:[10,11,12,11,13,12,14,13,15,16,17,18] },
      { id:'talk', label:'Listening balance', value:'46', unit:'%', delta:+7, deltaLabel:'more space for others', good:true, spark:[34,36,35,38,39,40,41,42,44,45,45,46] },
      { id:'streak', label:'Reflection streak', value:'12', unit:' days', delta:+12, deltaLabel:'keep going', spark:[1,2,3,4,5,6,7,8,9,10,11,12] },
      { id:'trig', label:'Trigger moments', value:'5', unit:'', delta:-3, deltaLabel:'fewer flare-ups', good:true, spark:[10,9,9,8,7,8,6,6,5,6,5,5] },
    ],
    behaviors: [
      { t:'You interrupt most when tired', detail:'Evening conversations show 2.4\u00d7 more interruptions than mornings.', n:'34 talks', tone:'warn', source:'Linked to sleep & cognitive load research' },
      { t:'\u201cSorry\u201d as a reflex', detail:'You open with an apology in 1 of 3 work conversations \u2014 often unnecessary.', n:'29 talks', tone:'neutral', source:'Nonviolent Communication framework' },
      { t:'You light up talking about projects', detail:'Tone lifts noticeably when the topic turns to things you\u2019re building.', n:'41 talks', tone:'good', source:'Self-Determination Theory (intrinsic motivation)' },
      { t:'Stress spikes around scheduling', detail:'Calendar and time-pressure topics correlate with a tenser voice.', n:'18 talks', tone:'warn', source:'Mindfulness-Based Stress Reduction' },
    ],
    steps: [
      { t:'Pause before replying', detail:'A 2-second breath when you feel rushed \u2014 you tried it twice last week and it helped.', done:false, source:{ title:'Mindfulness-Based Stress Reduction', author:'Jon Kabat-Zinn', type:'practice' } },
      { t:'Drop one reflex \u201csorry\u201d a day', detail:'Notice it, swap for \u201cthanks for waiting.\u201d', done:true, source:{ title:'Nonviolent Communication', author:'Marshall B. Rosenberg', type:'book' } },
      { t:'Schedule hard talks before 4pm', detail:'Your calm-tone window is clearly earlier in the day.', done:false, source:{ title:'Why We Sleep', author:'Matthew Walker', type:'book' } },
    ],
    themes: [
      { t:'Work & purpose', share:34, mood:'pos', sample:'You speak with energy and forward motion here.' },
      { t:'Family & home', share:26, mood:'pos', sample:'Warm, slower-paced, lots of listening.' },
      { t:'Time & overwhelm', share:22, mood:'neg', sample:'Faster speech, more filler, audible tension.' },
      { t:'Health & rest', share:18, mood:'neu', sample:'Reflective but a little avoidant in tone.' },
    ],
    recent: [
      { id:'p1', title:'Morning walk \u2014 thinking out loud', who:'Voice memo', dur:'08:42', when:'Today', sent:'pos', status:'analyzed', tag:'Reflection' },
      { id:'p2', title:'Hard conversation with Jordan', who:'Recorded note', dur:'21:15', when:'Yesterday', sent:'neg', status:'analyzed', tag:'Relationships' },
      { id:'p3', title:'Weekly review', who:'Voice memo', dur:'12:30', when:'2 days ago', sent:'neu', status:'analyzed', tag:'Reflection' },
      { id:'p4', title:'Call with Mom', who:'Recorded call', dur:'34:06', when:'3 days ago', sent:'pos', status:'analyzed', tag:'Family' },
      { id:'p5', title:'Late-night journal', who:'Voice memo', dur:'06:18', when:'4 days ago', sent:'neu', status:'transcribing', tag:'Reflection' },
    ],
    sentimentTrend: series([0.1,0.14,0.08,0.2,0.16,0.24,0.18,0.3,0.22,0.28,0.32,0.36]),
    topicsTrend: [
      { name:'Work', color:'var(--viz-5)', data:series([20,22,24,21,26,25,28,30,29,31,33,34]) },
      { name:'Rest', color:'var(--viz-2)', data:series([8,10,9,12,11,14,13,16,15,17,18,18]) },
      { name:'Overwhelm', color:'var(--viz-4)', data:series([28,26,27,24,25,22,23,20,21,19,18,17]) },
    ],
    evidence: [
      { title:'Nonviolent Communication', author:'Marshall B. Rosenberg', type:'book' },
      { title:'Emotional Intelligence', author:'Daniel Goleman', type:'book' },
      { title:'Active, reflective listening', author:'Carl Rogers, client-centered therapy', type:'research' },
      { title:'Mindfulness-Based Stress Reduction', author:'Jon Kabat-Zinn', type:'practice' },
      { title:'Atomic Habits', author:'James Clear', type:'book' },
    ],
    evidenceNote: 'Kithra\u2019s reflections draw on established communication and well-being research, cross-referenced across multiple sources \u2014 so suggestions are grounded, not invented.',
  };

  // ----- goal chips for onboarding -----
  const goals = {
    business: ['Close more deals','Improve my pitch','Understand objections','Coach my team','Spot at-risk deals','Shorten sales cycles'],
    personal: ['Understand my habits','Communicate better','Manage stress & triggers','Track a goal','Be a better listener','Sleep & energy'],
  };

  // ----- transcript for deep-dive -----
  const transcript = {
    business: {
      title:'Meridian Health \u2014 Pricing review',
      meta:'Dana R. (you) with Priya M., VP Operations \u00b7 32:14 \u00b7 Today',
      tldr:'Priya is bought in on value but anchored to a tighter Q3 budget. She responded strongly to the peer ROI story and asked for a one-pager to share upward. Clear path to close if you arm her champion.',
      sentiment:0.41, actions:[
        'Send the ROI one-pager referencing the peer customer',
        'Offer a phased start to fit the Q3 budget',
        'Book the stakeholder review with her VP for next week',
      ],
      next:'Send the one-pager today while sentiment is high, then propose a phased rollout to clear the budget objection.',
      lines:[
        { t:'00:42', who:'You', side:'rep', text:'Before we get into numbers \u2014 what would make this an easy yes for your team?' },
        { t:'00:58', who:'Priya', side:'cust', text:'Honestly the value is clear. It\u2019s really about the budget we set for this quarter.', tag:{k:'objection',l:'Objection \u2014 budget'} },
        { t:'02:14', who:'You', side:'rep', text:'Totally fair. A similar ops team at Brightline started with just two regions and expanded once it paid for itself.', tag:{k:'pos',l:'Peer story'} },
        { t:'02:51', who:'Priya', side:'cust', text:'Oh interesting \u2014 how quickly did they see that return?', tag:{k:'signal',l:'Buying signal'} },
        { t:'03:20', who:'You', side:'rep', text:'About six weeks. I can put the exact numbers in a one-pager you could forward up.' },
        { t:'03:44', who:'Priya', side:'cust', text:'That would actually help me a lot internally.', tag:{k:'pos',l:'Positive shift'} },
        { t:'06:10', who:'Priya', side:'cust', text:'My only worry is getting my VP on board before quarter-end.', tag:{k:'shift',l:'New stakeholder'} },
        { t:'06:32', who:'You', side:'rep', text:'Let\u2019s get 20 minutes with them next week \u2014 I\u2019ll handle the ROI part.' },
      ],
    },
    personal: {
      title:'Hard conversation with Jordan',
      meta:'Recorded note \u00b7 21:15 \u00b7 Yesterday',
      tldr:'You started tense and apologetic, then settled once you slowed down. The turning point was when you asked a question instead of defending. Tone softened and the conversation opened up.',
      sentiment:-0.12, actions:[
        'Notice the reflex apology at the open',
        'Keep asking instead of defending \u2014 it worked',
        'Revisit when rested; evening tension was high',
      ],
      next:'You did the hard part. Next time, try the pause earlier \u2014 your tone improved the moment you slowed down.',
      lines:[
        { t:'00:20', who:'You', side:'rep', text:'Sorry, I know this is probably a bad time to bring this up\u2026', tag:{k:'shift',l:'Reflex apology'} },
        { t:'00:38', who:'Jordan', side:'cust', text:'It\u2019s fine. What\u2019s going on?' },
        { t:'01:55', who:'You', side:'rep', text:'I just felt like I wasn\u2019t being heard earlier and it got to me.', tag:{k:'objection',l:'Tension rising'} },
        { t:'03:12', who:'You', side:'rep', text:'\u2026okay. Can you help me understand how it looked from your side?', tag:{k:'pos',l:'Asked instead of defended'} },
        { t:'03:40', who:'Jordan', side:'cust', text:'Yeah \u2014 I think we both got defensive too fast.' },
        { t:'04:18', who:'You', side:'rep', text:'That\u2019s fair. I want to get this right.', tag:{k:'pos',l:'Tone softened'} },
        { t:'07:02', who:'You', side:'rep', text:'I notice I get short when I\u2019m tired \u2014 that\u2019s on me.', tag:{k:'signal',l:'Self-awareness'} },
      ],
    },
  };

  // ----- canned Ask Kithra answers -----
  const ask = {
    business: {
      suggestions:['What objections come up most?','Which patterns win deals?','Who\u2019s most at risk this week?','How is sentiment trending?'],
      answers:{
        'What objections come up most?':{
          text:'Across 1,000 analyzed calls, **price / budget** is the most common objection at **31%**, up 4 points this quarter. **Competitor lock-in** (24%) and **no urgency** (19%) follow. Budget objections cluster in late-stage Proposal calls.',
          cites:[{c:'Meridian Health \u2014 Pricing review',m:'00:58'},{c:'Brightwave \u2014 Discovery',m:'14:20'},{c:'Vertex Retail \u2014 Intro call',m:'09:05'}],
          chart:'objections',
          informedBy:[{title:'Never Split the Difference',author:'Chris Voss',type:'book'},{title:'SPIN Selling',author:'Neil Rackham',type:'book'}],
        },
        'Which patterns win deals?':{
          text:'The strongest signal is **multi-threading to 3+ stakeholders** (+28% win-rate). Reps who **quantify pain in discovery** and **book a next step on the call** also close meaningfully more often.',
          cites:[{c:'Atlas Logistics \u2014 Technical deep-dive',m:'31:10'},{c:'Kepler Dynamics \u2014 Follow-up',m:'12:44'}],
          chart:'patterns',
          informedBy:[{title:'The Challenger Sale',author:'Dixon & Adamson',type:'book'},{title:'MEDDIC qualification',author:'B2B sales framework',type:'framework'}],
        },
        default:{
          text:'I looked across all analyzed calls. The clearest theme is that **deals progress when a second stakeholder is involved early** and stall when reps stay single-threaded. Want me to break this down by rep or by stage?',
          cites:[{c:'Kepler Dynamics \u2014 Follow-up',m:'12:44'},{c:'Meridian Health \u2014 Pricing review',m:'06:10'}],
          informedBy:[{title:'The Challenger Sale',author:'Dixon & Adamson',type:'book'}],
        },
      },
    },
    personal: {
      suggestions:['When do I sound most stressed?','What do I talk about most?','Am I listening more?','What\u2019s one thing to try?'],
      answers:{
        'When do I sound most stressed?':{
          text:'Your voice carries the most tension around **time and scheduling**, especially in **evening** recordings. Stress markers \u2014 faster pace, more filler words \u2014 spike 2.4\u00d7 after 7pm compared to mornings.',
          cites:[{c:'Hard conversation with Jordan',m:'01:55'},{c:'Weekly review',m:'08:30'}],
          chart:'emotion',
          informedBy:[{title:'Mindfulness-Based Stress Reduction',author:'Jon Kabat-Zinn',type:'practice'},{title:'Emotional Intelligence',author:'Daniel Goleman',type:'book'}],
        },
        'Am I listening more?':{
          text:'Yes \u2014 your **listening balance** rose from 39% to **46%** this month. You\u2019re leaving more space, especially in family conversations. Work calls are still a little rep-heavy.',
          cites:[{c:'Call with Mom',m:'12:10'},{c:'Weekly review',m:'04:02'}],
          chart:'emotion',
          informedBy:[{title:'Active, reflective listening',author:'Carl Rogers',type:'research'},{title:'Nonviolent Communication',author:'Marshall B. Rosenberg',type:'book'}],
        },
        default:{
          text:'Here\u2019s a gentle one: you tend to **open with an unnecessary apology** in work conversations. Next time, try swapping \u201csorry\u201d for \u201cthanks for waiting.\u201d Small, but it shifts how the conversation starts.',
          cites:[{c:'Hard conversation with Jordan',m:'00:20'},{c:'Morning walk \u2014 thinking out loud',m:'03:40'}],
          informedBy:[{title:'Nonviolent Communication',author:'Marshall B. Rosenberg',type:'book'},{title:'Atomic Habits',author:'James Clear',type:'book'}],
        },
      },
    },
  };

  // import queue sample
  const importQueue = [
    { name:'Meridian-Health-pricing.m4a', dur:'32:14', size:'29 MB', status:'analyzed' },
    { name:'Atlas-Logistics-technical.mp3', dur:'47:02', size:'44 MB', status:'analyzed' },
    { name:'Brightwave-discovery.wav', dur:'28:39', size:'61 MB', status:'transcribing' },
    { name:'Q3-pipeline-notes.pdf', dur:'\u2014', size:'1.2 MB', status:'queued', doc:true },
    { name:'Kepler-followup.m4a', dur:'19:51', size:'18 MB', status:'queued' },
  ];

  window.LUMEN = { business, personal, goals, transcript, ask, importQueue };
})();
