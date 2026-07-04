// Runtime CDN loader for pdf.js (kept out of the bundle for size).
// Tests mock this module and return the local pdfjs-dist devDependency.
const PDFJS_CDN: string = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/+esm';
const PDFJS_WORKER: string =
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';

let pdfjsPromise: Promise<any> | null = null;

export function loadPdfJs(): Promise<any> {
  if (!pdfjsPromise) {
    pdfjsPromise = import(/* @vite-ignore */ PDFJS_CDN).then((m: any) => {
      const lib = m.default ?? m;
      try { lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER; } catch { /* worker optional */ }
      return lib;
    });
  }
  return pdfjsPromise;
}

export function __setPdfJsForTests(fake: any) {
  pdfjsPromise = Promise.resolve(fake);
}
