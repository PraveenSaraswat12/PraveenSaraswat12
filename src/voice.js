/* ============================================================
   LUMEN — voice helper (Web Speech API: STT + TTS)
   Exposes window.LumenVoice. Picks from the device's REAL
   voices so accent changes are actually audible, and tunes
   for a natural, human delivery.
   ============================================================ */
(function () {
  const synth = window.speechSynthesis || null;
  let voices = [];
  const loadVoices = () => { voices = synth ? synth.getVoices() : []; };
  if (synth) {
    loadVoices();
    if (typeof synth.addEventListener === 'function') synth.addEventListener('voiceschanged', loadVoices);
    else synth.onvoiceschanged = loadVoices;
  }

  const ACC = {
    'en-us':'English · US', 'en-gb':'English · UK', 'en-in':'English · Indian',
    'en-au':'English · Australian', 'en-ca':'English · Canadian', 'en-ie':'English · Irish',
    'en-za':'English · South African', 'en-gb-scotland':'English · Scottish',
    'es-es':'Spanish · Spain', 'es-mx':'Spanish · Mexico', 'es-us':'Spanish · US',
    'hi-in':'Hindi', 'fr-fr':'French', 'fr-ca':'French · Canada',
    'de-de':'German', 'pt-br':'Portuguese · Brazil', 'pt-pt':'Portuguese · Portugal',
  };
  const ALLOW = /^(en|es|hi|fr|de|pt)/i;
  const NATURAL = /natural|neural|google|siri|premium|enhanced|wavenet|studio/i;

  function accentLabel(lang) {
    const L = (lang || '').toLowerCase();
    return ACC[L] || ACC[L.split('-').slice(0,2).join('-')] || (lang || 'Voice');
  }
  function friendly(v) {
    return (v.name || 'Voice')
      .replace(/Microsoft\s+|Google\s+|Apple\s+/i, '')
      .replace(/\s*Online.*$/i, '')
      .replace(/\s*\([^)]*\)/g, '')
      .replace(/\s*-\s*(English|Spanish|Hindi|French|German|Portuguese).*$/i, '')
      .trim();
  }

  // list curated, de-duped voices with friendly accent labels (natural first)
  function listVoices() {
    if (!voices.length) loadVoices();
    const seen = new Set(), out = [];
    voices.filter(v => v.lang && ALLOW.test(v.lang)).forEach(v => {
      const uri = v.voiceURI || v.name;
      if (seen.has(uri)) return; seen.add(uri);
      out.push({
        name: v.name, lang: v.lang, uri,
        natural: NATURAL.test(v.name || ''),
        label: `${accentLabel(v.lang)} · ${friendly(v)}`,
      });
    });
    out.sort((a, b) => (b.natural - a.natural) || a.lang.toLowerCase().localeCompare(b.lang.toLowerCase()) || a.label.localeCompare(b.label));
    return out;
  }

  function findVoice(id) {
    if (!id) return null;
    if (!voices.length) loadVoices();
    return voices.find(v => (v.voiceURI || v.name) === id) || voices.find(v => v.name === id) || null;
  }
  // best natural fallback for a base language
  function pickVoice(lang) {
    if (!voices.length) loadVoices();
    if (!voices.length) return null;
    const L = (lang || 'en-US').toLowerCase();
    const exact = voices.filter(v => (v.lang || '').toLowerCase() === L);
    if (exact.length) return exact.find(v => NATURAL.test(v.name)) || exact[0];
    const base = L.split('-')[0];
    const same = voices.filter(v => (v.lang || '').toLowerCase().startsWith(base));
    if (same.length) return same.find(v => NATURAL.test(v.name)) || same[0];
    return voices.find(v => NATURAL.test(v.name)) || voices[0] || null;
  }

  // speak(text, opt) — opt: { voiceName, lang, rate, pitch, onstart, onend, onerror }
  function speak(text, opt = {}) {
    if (!synth || !text) return null;
    try { synth.cancel(); } catch (e) {}
    const u = new SpeechSynthesisUtterance(String(text).slice(0, 600));
    let v = opt.voiceName ? findVoice(opt.voiceName) : null;
    if (!v) v = pickVoice(opt.lang || 'en-US');
    if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = opt.lang || 'en-US'; }
    u.rate = opt.rate != null ? opt.rate : 0.97;   // slightly slower → more natural
    u.pitch = opt.pitch != null ? opt.pitch : 1.0;
    if (opt.onstart) u.onstart = opt.onstart;
    if (opt.onend) u.onend = opt.onend;
    if (opt.onerror) u.onerror = opt.onerror;
    try { synth.speak(u); } catch (e) { return null; }
    return u;
  }
  function stopSpeak() { try { synth && synth.cancel(); } catch (e) {} }

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  function createRecognizer(lang, handlers = {}) {
    if (!SR) return null;
    let r;
    try { r = new SR(); } catch (e) { return null; }
    r.lang = lang || 'en-US';
    r.interimResults = true;
    r.continuous = !!handlers.continuous;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      let interim = '', fin = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const tr = e.results[i][0].transcript;
        if (e.results[i].isFinal) fin += tr; else interim += tr;
      }
      if (interim && handlers.onInterim) handlers.onInterim(interim);
      if (fin && handlers.onFinal) handlers.onFinal(fin.trim());
    };
    r.onend = () => handlers.onEnd && handlers.onEnd();
    r.onerror = (e) => handlers.onError && handlers.onError(e);
    r.onstart = () => handlers.onStart && handlers.onStart();
    return r;
  }

  // preview a voice with a short natural phrase
  function preview(voiceName, lang) {
    const samples = {
      es: 'Hola, soy Kithra. Estoy aquí para escucharte.',
      hi: 'नमस्ते, मैं लूमेन हूँ। मैं आपकी बात सुन रहा हूँ।',
      fr: 'Bonjour, je suis Kithra. Je vous écoute.',
      de: 'Hallo, ich bin Kithra. Ich höre zu.',
      pt: 'Olá, eu sou a Kithra. Estou a ouvir.',
    };
    const v = voiceName ? findVoice(voiceName) : null;
    const base = ((v && v.lang) || lang || 'en').slice(0, 2).toLowerCase();
    const text = samples[base] || 'Hi, I’m Kithra. I’m listening, and I’ll keep your conversations private.';
    return speak(text, { voiceName, lang });
  }

  window.LumenVoice = {
    speak, stopSpeak, createRecognizer, pickVoice, listVoices, findVoice, accentLabel, preview,
    get sttSupported() { return !!SR; },
    get ttsSupported() { return !!synth; },
    get voices() { if (!voices.length) loadVoices(); return voices; },
  };
})();
