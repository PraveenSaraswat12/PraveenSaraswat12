import '@testing-library/jest-dom';
import 'fake-indexeddb/auto';

// jsdom lacks some browser APIs the app uses
if (!('crypto' in globalThis) || !globalThis.crypto?.subtle) {
  // node 19+ provides webcrypto on globalThis.crypto already; this is a guard
  const { webcrypto } = await import('node:crypto');
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

if (typeof globalThis.matchMedia !== 'function') {
  globalThis.matchMedia = ((q: string) => ({
    matches: false, media: q, onchange: null,
    addListener() {}, removeListener() {},
    addEventListener() {}, removeEventListener() {},
    dispatchEvent() { return false; },
  })) as any;
}

if (typeof (globalThis as any).ResizeObserver !== 'function') {
  (globalThis as any).ResizeObserver = class {
    observe() {} unobserve() {} disconnect() {}
  };
}

// Chart.js needs canvas; jsdom's canvas is a stub — give it a 2d context shim
const proto = (globalThis as any).HTMLCanvasElement?.prototype;
if (proto && !proto.__patched2d) {
  proto.__patched2d = true;
  const noop = () => {};
  proto.getContext = function () {
    return new Proxy({}, {
      get: (_t, key) => {
        if (key === 'canvas') return this;
        if (key === 'measureText') return () => ({ width: 0 });
        if (key === 'createLinearGradient' || key === 'createRadialGradient')
          return () => ({ addColorStop: noop, toString: () => '[object CanvasGradient]' });
        if (key === 'getImageData') return () => ({ data: [] });
        return noop;
      },
      set: () => true,
    });
  };
}
