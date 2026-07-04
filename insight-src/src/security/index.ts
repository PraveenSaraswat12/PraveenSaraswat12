// Security & data module: auth, encrypted persistence, consent, data rights.
import type { SecurityModule } from '../contracts/modules';
import * as auth from './auth';
import * as store from './store';
import { __resetVaultForTests } from './vault';

const CONSENT_KEY = 'ki_cloud_consent';

export const security: SecurityModule = {
  init: auth.init,
  currentUser: auth.currentUser,
  onAuthChange: auth.onAuthChange,
  signInWithGoogle: auth.signInWithGoogle,
  sendPhoneOtp: auth.sendPhoneOtp,
  verifyPhoneOtp: auth.verifyPhoneOtp,
  continueAsGuest: auth.continueAsGuest,
  signOut: auth.signOut,

  saveWorkspace: store.saveWorkspace,
  loadWorkspace: store.loadWorkspace,
  listWorkspaces: store.listWorkspaces,
  deleteWorkspace: store.deleteWorkspace,
  exportWorkspace: store.exportWorkspace,
  importWorkspace: store.importWorkspace,

  getCloudConsent() {
    try { return localStorage.getItem(CONSENT_KEY) === '1'; } catch { return false; }
  },
  setCloudConsent(v: boolean) {
    try { localStorage.setItem(CONSENT_KEY, v ? '1' : '0'); } catch { /* private mode */ }
  },

  async eraseAllLocalData() {
    await store.deleteDatabase();
    const mine: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      // only Insight's keys — never the root Kithra app's own data (kithra_dk etc.)
      if (k && (k.startsWith('ki_') || k.startsWith('kithra_insight_'))) mine.push(k);
    }
    mine.forEach((k) => localStorage.removeItem(k));
    __resetVaultForTests();
    await auth.signOut();
  },
};
