import React from 'react';
/* ============================================================
   LUMEN — app core: context, navigation, flow state
   ============================================================ */
const AppContext = React.createContext(null);
function useApp() { return React.useContext(AppContext); }

// route registry (label + icon for nav)
const ROUTES = {
  landing:      { app:false },
  auth:         { app:false },
  onboarding:   { app:false },
  import:       { app:false },
  processing:   { app:false },
  legal:        { app:false },
  dashboard:    { app:true,  label:'Dashboard',   icon:'grid',     group:'main' },
  conversation: { app:true,  label:'Conversation', icon:'wave',    group:'hidden' },
  ask:          { app:true,  label:'Ask Kithra',    icon:'chat',    group:'main' },
  patterns:     { app:true,  label:'Patterns',     icon:'trend',   group:'main' },
  library:      { app:true,  label:'Recordings',   icon:'layers',  group:'data' },
  books:        { app:true,  label:'Books',        icon:'book',    group:'data' },
  analyze:      { app:true,  label:'Analyze audio', icon:'mic',    group:'data' },
  sources:      { app:true,  label:'Sources',      icon:'upload',  group:'data' },
  privacy:      { app:true,  label:'Privacy & Data', icon:'shield', group:'data' },
  pricing:      { app:true,  label:'Plans',        icon:'spark',   group:'data' },
};

Object.assign(window, { AppContext, useApp, ROUTES });


export { AppContext, useApp, ROUTES };
