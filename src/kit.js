/* ============================================================
   Kithra — shared "kit" barrel
   Re-exports the primitives every screen builds on: icons, logo,
   waveforms, charts, the app context/router, and the live-tweaks
   controls. Screens import what they need from here instead of
   reaching for globals (as the original prototype did).
   ============================================================ */
export * from './components.jsx';
export * from './charts.jsx';
export * from './app-core.jsx';
export * from './tweaks-panel.jsx';
