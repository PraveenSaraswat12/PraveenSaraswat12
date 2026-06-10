/* ============================================================
   Kithra — production entry point

   The original Kithra.html prototype assembled the app from
   in-browser Babel <script> tags sharing one global scope. This
   entry boots the same app as a real Vite + React build: styles,
   then the global data/voice helpers, then every screen module,
   and finally the app shell (which mounts into #root).
   ============================================================ */
import './styles/styles.css';
import './styles/landing.css';
import './styles/screens.css';

// Mock data + Web-Speech voice helper — set window.LUMEN / window.LumenVoice.
import './data.js';
import './voice.js';
import './app-config.js'; // built-in Supabase project keys (anon = public)
import './cloud.js'; // optional Supabase + Gemma backend (inert until connected)

// Pull every screen into the graph (mirrors the prototype's load order) so the
// app shell can resolve all routes and the conditional hosts (capture/system).
import './screens-landing.jsx';
import './screens-auth.jsx';
import './screens-onboarding.jsx';
import './screens-import.jsx';
import './screens-processing.jsx';
import './screens-dashboard.jsx';
import './screens-conversation.jsx';
import './screens-ask.jsx';
import './screens-capture.jsx';
import './screens-patterns.jsx';
import './screens-library.jsx';
import './screens-books.jsx';
import './screens-pricing.jsx';
import './screens-analyze.jsx';
import './screens-privacy.jsx';
import './screens-system.jsx';

// App shell, provider, router — mounts into #root on import.
import './app.jsx';
