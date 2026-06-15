/* ============================================================
   KITHRA — native system / meeting audio capture bridge
   Wraps the Android `SystemAudio` Capacitor plugin (MediaProjection
   + AudioPlaybackCapture). On the web or unsupported devices every
   call degrades gracefully so the UI can simply hide the feature.
   Note: the OS forbids capturing phone-call audio, so this is for
   meetings / media playing on the device — calls stay mic-only.
   ============================================================ */
import { registerPlugin, Capacitor } from '@capacitor/core';

const SystemAudio = registerPlugin('SystemAudio');

let _supported = null;

async function isSupported() {
  if (_supported !== null) return _supported;
  try {
    if (!Capacitor.isNativePlatform || !Capacitor.isNativePlatform()) { _supported = false; return false; }
    const r = await SystemAudio.isSupported();
    _supported = !!(r && r.supported);
  } catch (e) {
    _supported = false;
  }
  return _supported;
}

async function isRunning() {
  try { const r = await SystemAudio.isRunning(); return !!(r && r.running); }
  catch (e) { return false; }
}

// Begins capture. The OS shows its "start recording / casting" consent first.
// Resolves once recording has started; rejects if denied/unsupported.
async function start() {
  return await SystemAudio.start();
}

// Turn a native file path into a WebView-loadable URL + a Blob/File the rest
// of the app (analysis, transcription) can consume just like an upload.
async function fileFromPath(path, mimeType = 'audio/wav', name) {
  const url = Capacitor.convertFileSrc(path);
  const resp = await fetch(url);
  const blob = await resp.blob();
  const file = new File([blob], name || `meeting-${Date.now()}.wav`, { type: mimeType });
  return { url, blob, file };
}

// Stops capture. Returns { path, uri, mimeType, durationMs, size } plus a
// WebView-loadable `url` and (best-effort) a `blob` + `file` for analysis.
async function stop() {
  const r = await SystemAudio.stop();
  const out = { ...r };
  try {
    Object.assign(out, await fileFromPath(r.path, r.mimeType || 'audio/wav'));
  } catch (e) {
    // conversion failed — caller still has the native path
  }
  return out;
}

// Fires when the OS / user ends capture from the system UI (not via stop()).
function onStopped(cb) {
  try { return SystemAudio.addListener('stopped', cb); } catch (e) { return null; }
}

const KithraSystemAudio = { isSupported, isRunning, start, stop, onStopped, fileFromPath, _plugin: SystemAudio };
if (typeof window !== 'undefined') window.KithraSystemAudio = KithraSystemAudio;

export { isSupported, isRunning, start, stop, onStopped, fileFromPath };
export default KithraSystemAudio;
