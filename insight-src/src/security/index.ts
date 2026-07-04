// STUB — Agent 3 (Security & Data Cloud) replaces this with the full
// implementation. Must keep exporting: export const security: SecurityModule
import type { SecurityModule } from '../contracts/modules';
import type { SessionUser } from '../contracts/types';

let user: SessionUser | null = null;

export const security: SecurityModule = {
  async init() { return user; },
  currentUser() { return user; },
  onAuthChange() { return () => {}; },
  async signInWithGoogle() { throw new Error('not implemented'); },
  async sendPhoneOtp() { throw new Error('not implemented'); },
  async verifyPhoneOtp() { throw new Error('not implemented'); },
  async continueAsGuest(name) {
    user = { id: 'guest', name: name || 'Guest', provider: 'guest' };
    return user;
  },
  async signOut() { user = null; },
  async saveWorkspace() {},
  async loadWorkspace() { return null; },
  async listWorkspaces() { return []; },
  async deleteWorkspace() {},
  async exportWorkspace() { return new Blob(); },
  async importWorkspace() { throw new Error('not implemented'); },
  getCloudConsent() { return false; },
  setCloudConsent() {},
  async eraseAllLocalData() {},
};
