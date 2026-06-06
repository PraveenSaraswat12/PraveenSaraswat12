# Kithra — Vite + React implementation

A real, buildable React port of the **Lumen / Kithra** "conversation
intelligence" design handoff (`lumen/project/Kithra.html`). Same CSS and JSX
as the prototype (pixel-perfect), rewired from in-browser Babel + `window`
globals into proper ES modules with a Vite build.

## Run locally
```bash
npm install
npm run dev      # http://localhost:5173
```

## Build / preview
```bash
npm run build    # outputs to dist/
npm run preview
```

## Deploy to GitHub Pages
A workflow is included at `.github/workflows/deploy.yml`. One-time setup:
**repo Settings → Pages → Build and deployment → Source: "GitHub Actions"**.
It builds and publishes on every push to `main`. Because this is the
`<user>/<user>` repo, the site is served at `https://<user>.github.io/`.
(Your profile `README.md` is untouched and keeps showing on your profile.)

## How it's structured
- `index.html` — Vite entry (boot splash + `#root`).
- `src/main.jsx` — styles, global data/voice helpers, then every screen, then the app shell.
- `src/kit.js` — barrel re-exporting the shared primitives (`components`, `charts`, `app-core`, `tweaks-panel`).
- `src/screens-*.jsx` — one module per screen; they import what they need from `./kit.js`.
- `src/data.js`, `src/voice.js` — mock data + Web-Speech helper (set `window.LUMEN` / `window.LumenVoice`).
- `src/styles/` — `styles.css`, `landing.css`, `screens.css` (unchanged from the prototype).

The backend in `BACKEND.md` is a future recommendation only — this is a
frontend implementation with mocked insights, exactly like the prototype.
