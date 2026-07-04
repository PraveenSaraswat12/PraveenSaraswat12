// File reading with FileReader fallback (jsdom and older Safari lack Blob.text).
export function readFileText(f: File | Blob): Promise<string> {
  if (typeof (f as any).text === 'function') {
    try { return (f as any).text(); } catch { /* fall through */ }
  }
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ''));
    r.onerror = () => reject(r.error ?? new Error('Could not read file'));
    r.readAsText(f);
  });
}

export function readFileArrayBuffer(f: File | Blob): Promise<ArrayBuffer> {
  if (typeof (f as any).arrayBuffer === 'function') {
    try { return (f as any).arrayBuffer(); } catch { /* fall through */ }
  }
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as ArrayBuffer);
    r.onerror = () => reject(r.error ?? new Error('Could not read file'));
    r.readAsArrayBuffer(f);
  });
}
