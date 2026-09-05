// Usage: node child.js <appDir>
// Loads <appDir>/index.html in a stubbed JSDOM and prints a JSON result to stdout.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const appDir = process.argv[2];
const appName = path.basename(appDir);
const htmlPath = path.join(appDir, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

const result = {
  app: appName,
  externalLibs: [],
  inlinedLocal: [],
  errors: [],          // uncaught errors (window 'error' + jsdomError)
  rejections: [],      // unhandled promise rejections
  consoleErrors: [],   // console.error calls (informational)
  notImplemented: [],  // jsdom "not implemented" notices (informational)
  status: 'ok',
};

// ---- 1. Strip remote <script src>, inline local ones -----------------------
html = html.replace(/<script\b([^>]*)\bsrc\s*=\s*["']([^"']+)["']([^>]*)>\s*<\/script>/gi, (m, pre, src, post) => {
  if (/^(https?:)?\/\//i.test(src)) {
    result.externalLibs.push(src);
    return `<!-- stripped external script ${src} -->`;
  }
  const local = path.join(appDir, src);
  if (fs.existsSync(local)) {
    result.inlinedLocal.push(src);
    const code = fs.readFileSync(local, 'utf8');
    return `<script${pre}${post}>${code.replace(/<\/script/gi, '<\\/script')}</script>`;
  }
  result.externalLibs.push(src + ' (missing local)');
  return `<!-- stripped missing script ${src} -->`;
});

// ---- 2. Error capture -------------------------------------------------------
function fmtErr(e) {
  if (e && typeof e === 'object') {
    return { name: e.name, message: e.message, stack: (e.stack || '').split('\n').slice(0, 6).join('\n') };
  }
  return { name: 'Unknown', message: String(e), stack: '' };
}

const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', (e) => {
  const msg = e && e.message || String(e);
  if (/not implemented/i.test(msg)) { result.notImplemented.push(msg.split('\n')[0]); return; }
  // jsdom wraps uncaught script errors: e.type === 'unhandled exception', e.detail is the real error
  const real = e && e.detail ? e.detail : e;
  result.errors.push({ source: 'jsdomError', ...fmtErr(real) });
});
virtualConsole.on('error', (...args) => { result.consoleErrors.push(args.map(String).join(' ').slice(0, 300)); });
virtualConsole.on('warn', () => {});
virtualConsole.on('log', () => {});
virtualConsole.on('info', () => {});
virtualConsole.on('debug', () => {});

process.on('unhandledRejection', (reason) => {
  result.rejections.push(fmtErr(reason));
});
process.on('uncaughtException', (err) => {
  result.errors.push({ source: 'uncaughtException', ...fmtErr(err) });
});

// ---- 3. Stubs ---------------------------------------------------------------
function makeStub(name = 'stub', overrides = {}) {
  const target = function () {};
  const proxy = new Proxy(target, {
    get(t, prop) {
      if (prop in overrides) return overrides[prop];
      if (prop === 'then') return undefined; // don't look like a thenable
      if (prop === Symbol.toPrimitive) return () => 0;
      if (prop === Symbol.iterator) return function* () {};
      if (prop === 'toString') return () => `[${name}]`;
      if (prop === 'valueOf') return () => 0;
      if (prop === 'length') return 0;
      if (prop === 'constructor') return target;
      if (prop === 'prototype') return t.prototype;
      return proxy;
    },
    set() { return true; },
    apply() { return proxy; },
    construct() { return proxy; },
    has() { return true; },
  });
  return proxy;
}

function beforeParse(window) {
  const doc = window.document;

  // Canvas
  const origGetContext = window.HTMLCanvasElement.prototype.getContext;
  window.HTMLCanvasElement.prototype.getContext = function (type) {
    const canvas = this;
    const ctx = makeStub('ctx:' + type, {
      canvas,
      getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(0, (w | 0) * (h | 0)) * 4), width: w | 0, height: h | 0 }),
      createImageData: (w, h) => {
        if (typeof w === 'object') { h = w.height; w = w.width; }
        return { data: new Uint8ClampedArray(Math.max(0, (w | 0) * (h | 0)) * 4), width: w | 0, height: h | 0 };
      },
      measureText: (t) => ({ width: (String(t).length * 6), actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2, actualBoundingBoxLeft: 0, actualBoundingBoxRight: 0 }),
      getParameter: () => 0,
      getExtension: () => null,
      getShaderParameter: () => true,
      getProgramParameter: () => true,
      getUniformLocation: () => ({}),
      getAttribLocation: () => 0,
      createShader: () => ({}),
      createProgram: () => ({}),
      createBuffer: () => ({}),
      createTexture: () => ({}),
      createFramebuffer: () => ({}),
      getShaderInfoLog: () => '',
      getProgramInfoLog: () => '',
      isPointInPath: () => false,
      isPointInStroke: () => false,
      getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
      getLineDash: () => [],
      createLinearGradient: () => ({ addColorStop() {} }),
      createRadialGradient: () => ({ addColorStop() {} }),
      createConicGradient: () => ({ addColorStop() {} }),
      createPattern: () => ({}),
    });
    return ctx;
  };
  window.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,';
  window.HTMLCanvasElement.prototype.toBlob = function (cb) { setTimeout(() => cb(new window.Blob([''], { type: 'image/png' })), 0); };
  window.HTMLCanvasElement.prototype.captureStream = () => makeStub('MediaStream');
  window.HTMLCanvasElement.prototype.transferControlToOffscreen = () => makeStub('OffscreenCanvas');

  class OffscreenCanvas {
    constructor(w, h) { this.width = w; this.height = h; }
    getContext(type) { return window.HTMLCanvasElement.prototype.getContext.call(this, type); }
    convertToBlob() { return Promise.resolve(new window.Blob([''])); }
    transferToImageBitmap() { return makeStub('ImageBitmap'); }
  }
  window.OffscreenCanvas = OffscreenCanvas;
  window.createImageBitmap = () => Promise.resolve(makeStub('ImageBitmap'));
  window.Path2D = class Path2D { constructor() {} moveTo() {} lineTo() {} closePath() {} arc() {} rect() {} bezierCurveTo() {} quadraticCurveTo() {} addPath() {} ellipse() {} };
  window.ImageData = window.ImageData || class ImageData { constructor(a, b, c) { if (a instanceof Uint8ClampedArray) { this.data = a; this.width = b; this.height = c; } else { this.width = a; this.height = b; this.data = new Uint8ClampedArray(a * b * 4); } } };

  // Image
  window.HTMLImageElement.prototype.decode = function () { return Promise.resolve(); };

  // Media elements
  window.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
  window.HTMLMediaElement.prototype.pause = function () {};
  window.HTMLMediaElement.prototype.load = function () {};
  window.HTMLMediaElement.prototype.canPlayType = function () { return 'maybe'; };
  window.HTMLMediaElement.prototype.captureStream = () => makeStub('MediaStream');

  // Audio
  class AudioContext {
    constructor() {
      const inst = makeStub('AudioContext', {
        state: 'suspended', sampleRate: 44100, currentTime: 0,
        destination: makeStub('AudioDestinationNode'),
        resume: () => Promise.resolve(), suspend: () => Promise.resolve(), close: () => Promise.resolve(),
        decodeAudioData: (buf, ok, err) => { const p = Promise.reject(new window.DOMException('stub decodeAudioData', 'EncodingError')); if (err) { p.catch(err); return; } return p; },
        createBuffer: (ch, len, sr) => ({ numberOfChannels: ch, length: len, sampleRate: sr, duration: len / sr, getChannelData: () => new Float32Array(len), copyToChannel() {}, copyFromChannel() {} }),
        addEventListener() {}, removeEventListener() {},
      });
      return inst;
    }
  }
  window.AudioContext = AudioContext;
  window.webkitAudioContext = AudioContext;
  window.OfflineAudioContext = AudioContext;
  window.webkitOfflineAudioContext = AudioContext;
  window.AudioBuffer = class AudioBuffer {};
  window.AudioWorkletNode = class AudioWorkletNode {};
  window.Audio = function (src) { const a = doc.createElement('audio'); if (src) a.src = src; return a; };

  // Media / recording
  window.MediaRecorder = class MediaRecorder {
    constructor() { this.state = 'inactive'; this.ondataavailable = null; }
    static isTypeSupported() { return true; }
    start() { this.state = 'recording'; } stop() { this.state = 'inactive'; } pause() {} resume() {} requestData() {}
    addEventListener() {} removeEventListener() {}
  };
  window.MediaStream = class MediaStream { constructor() {} getTracks() { return []; } getAudioTracks() { return []; } getVideoTracks() { return []; } addTrack() {} removeTrack() {} };
  window.MediaSource = class MediaSource { static isTypeSupported() { return false; } addEventListener() {} };
  Object.defineProperty(window.navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: () => Promise.reject(new window.DOMException('stub', 'NotAllowedError')),
      getDisplayMedia: () => Promise.reject(new window.DOMException('stub', 'NotAllowedError')),
      enumerateDevices: () => Promise.resolve([]),
      addEventListener() {}, removeEventListener() {},
    },
  });
  Object.defineProperty(window.navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.resolve(), readText: () => Promise.resolve(''), write: () => Promise.resolve(), read: () => Promise.resolve([]) } });
  Object.defineProperty(window.navigator, 'permissions', { configurable: true, value: { query: () => Promise.resolve({ state: 'prompt', addEventListener() {} }) } });
  Object.defineProperty(window.navigator, 'serviceWorker', { configurable: true, value: { register: () => Promise.resolve({}), ready: Promise.resolve({}), addEventListener() {}, controller: null } });
  Object.defineProperty(window.navigator, 'storage', { configurable: true, value: { estimate: () => Promise.resolve({ usage: 0, quota: 0 }), persist: () => Promise.resolve(false) } });
  Object.defineProperty(window.navigator, 'vibrate', { configurable: true, value: () => true });
  Object.defineProperty(window.navigator, 'share', { configurable: true, value: () => Promise.resolve() });
  Object.defineProperty(window.navigator, 'wakeLock', { configurable: true, value: { request: () => Promise.resolve({ release: () => Promise.resolve(), addEventListener() {} }) } });
  Object.defineProperty(window.navigator, 'getGamepads', { configurable: true, value: () => [] });
  Object.defineProperty(window.navigator, 'geolocation', { configurable: true, value: { getCurrentPosition() {}, watchPosition() { return 1; }, clearWatch() {} } });
  Object.defineProperty(window.navigator, 'hardwareConcurrency', { configurable: true, value: 4 });
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true });
  Object.defineProperty(window.navigator, 'language', { configurable: true, value: 'en-US' });
  Object.defineProperty(window.navigator, 'languages', { configurable: true, value: ['en-US', 'en'] });

  // Speech
  window.speechSynthesis = { speak() {}, cancel() {}, pause() {}, resume() {}, getVoices: () => [], speaking: false, pending: false, paused: false, onvoiceschanged: null, addEventListener() {}, removeEventListener() {} };
  window.SpeechSynthesisUtterance = class SpeechSynthesisUtterance { constructor(t) { this.text = t; } addEventListener() {} };
  window.SpeechRecognition = class SpeechRecognition { start() {} stop() {} abort() {} addEventListener() {} };
  window.webkitSpeechRecognition = window.SpeechRecognition;
  window.SpeechGrammarList = class {};
  window.webkitSpeechGrammarList = window.SpeechGrammarList;

  // Observers
  class Obs { constructor(cb) { this.cb = cb; } observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } }
  window.ResizeObserver = Obs;
  window.IntersectionObserver = Obs;
  window.PerformanceObserver = Obs;
  window.PerformanceObserver.supportedEntryTypes = [];

  // matchMedia
  window.matchMedia = (q) => ({ matches: false, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } });

  // rAF: bounded
  let rafCount = 0;
  const RAF_LIMIT = 400;
  window.requestAnimationFrame = (cb) => {
    if (rafCount++ > RAF_LIMIT) return 0;
    return window.setTimeout(() => cb(window.performance.now()), 16);
  };
  window.cancelAnimationFrame = (id) => window.clearTimeout(id);
  window.requestIdleCallback = (cb) => window.setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 50 }), 1);
  window.cancelIdleCallback = (id) => window.clearTimeout(id);

  // crypto
  if (!window.crypto || !window.crypto.subtle) {
    Object.defineProperty(window, 'crypto', { configurable: true, value: globalThis.crypto });
  }

  // Misc APIs
  window.Notification = class Notification { constructor() {} static requestPermission() { return Promise.resolve('denied'); } static get permission() { return 'denied'; } close() {} addEventListener() {} };
  window.Worker = class Worker { constructor() {} postMessage() {} terminate() {} addEventListener() {} removeEventListener() {} };
  window.SharedWorker = window.Worker;
  window.BroadcastChannel = class BroadcastChannel { constructor(n) { this.name = n; } postMessage() {} close() {} addEventListener() {} removeEventListener() {} };
  window.WebSocket = class WebSocket { constructor() { this.readyState = 0; } send() {} close() {} addEventListener() {} removeEventListener() {} };
  window.EventSource = class EventSource { constructor() {} close() {} addEventListener() {} removeEventListener() {} };
  window.RTCPeerConnection = class RTCPeerConnection { constructor() {} close() {} addEventListener() {} createDataChannel() { return makeStub('RTCDataChannel'); } };
  window.webkitRTCPeerConnection = window.RTCPeerConnection;
  window.Gamepad = class {};
  window.GamepadEvent = class extends window.Event {};
  window.DeviceOrientationEvent = window.DeviceOrientationEvent || class extends window.Event {};
  window.DeviceMotionEvent = window.DeviceMotionEvent || class extends window.Event {};
  window.PointerEvent = window.PointerEvent || window.MouseEvent;
  window.TouchEvent = window.TouchEvent || class extends window.UIEvent {};
  window.ClipboardItem = class ClipboardItem { constructor(d) { this.d = d; } static supports() { return true; } };
  window.showOpenFilePicker = () => Promise.reject(new window.DOMException('stub', 'AbortError'));
  window.showSaveFilePicker = () => Promise.reject(new window.DOMException('stub', 'AbortError'));
  window.showDirectoryPicker = () => Promise.reject(new window.DOMException('stub', 'AbortError'));
  window.scrollTo = () => {};
  window.scroll = () => {};
  window.scrollBy = () => {};
  window.alert = () => {};
  window.confirm = () => false;
  window.prompt = () => null;
  window.print = () => {};
  window.open = () => null;
  window.Element.prototype.scrollIntoView = function () {};
  window.Element.prototype.scrollTo = function () {};
  window.Element.prototype.scrollBy = function () {};
  window.Element.prototype.requestFullscreen = function () { return Promise.resolve(); };
  window.Element.prototype.requestPointerLock = function () {};
  window.Element.prototype.setPointerCapture = function () {};
  window.Element.prototype.releasePointerCapture = function () {};
  window.Element.prototype.hasPointerCapture = function () { return false; };
  window.Element.prototype.animate = function () { return makeStub('Animation', { finished: Promise.resolve(), play() {}, pause() {}, cancel() {}, finish() {}, addEventListener() {} }); };
  window.Element.prototype.getAnimations = function () { return []; };
  doc.exitFullscreen = () => Promise.resolve();
  doc.exitPointerLock = () => {};
  window.HTMLElement.prototype.showPopover = window.HTMLElement.prototype.showPopover || function () {};
  window.HTMLElement.prototype.hidePopover = window.HTMLElement.prototype.hidePopover || function () {};
  window.HTMLDialogElement.prototype.showModal = window.HTMLDialogElement.prototype.showModal || function () { this.open = true; };
  window.HTMLDialogElement.prototype.show = window.HTMLDialogElement.prototype.show || function () { this.open = true; };
  window.HTMLDialogElement.prototype.close = window.HTMLDialogElement.prototype.close || function () { this.open = false; };
  window.CSS = window.CSS || { supports: () => false, escape: (s) => String(s).replace(/[^a-zA-Z0-9_-]/g, (c) => '\\' + c) };
  window.CSS.supports = window.CSS.supports || (() => false);
  window.CSS.escape = window.CSS.escape || ((s) => String(s).replace(/[^a-zA-Z0-9_-]/g, (c) => '\\' + c));
  window.CSS.registerProperty = window.CSS.registerProperty || (() => {});
  window.CSSStyleSheet.prototype.replaceSync = window.CSSStyleSheet.prototype.replaceSync || function () {};
  window.CSSStyleSheet.prototype.replace = window.CSSStyleSheet.prototype.replace || function () { return Promise.resolve(this); };
  if (!('adoptedStyleSheets' in doc)) { doc.adoptedStyleSheets = []; }
  window.structuredClone = window.structuredClone || globalThis.structuredClone;
  window.queueMicrotask = window.queueMicrotask || ((fn) => Promise.resolve().then(fn));
  window.TextEncoder = window.TextEncoder || globalThis.TextEncoder;
  window.TextDecoder = window.TextDecoder || globalThis.TextDecoder;
  window.CompressionStream = globalThis.CompressionStream;
  window.DecompressionStream = globalThis.DecompressionStream;
  window.ReadableStream = window.ReadableStream || globalThis.ReadableStream;
  window.WritableStream = window.WritableStream || globalThis.WritableStream;
  window.TransformStream = window.TransformStream || globalThis.TransformStream;
  window.performance.memory = { usedJSHeapSize: 0, totalJSHeapSize: 0, jsHeapSizeLimit: 0 };
  window.performance.mark = window.performance.mark || (() => {});
  window.performance.measure = window.performance.measure || (() => {});
  window.indexedDB = window.indexedDB || makeStub('indexedDB', {
    open: () => { const req = { onsuccess: null, onerror: null, onupgradeneeded: null, result: null, addEventListener() {} }; setTimeout(() => { req.error = new window.DOMException('stub indexedDB', 'UnknownError'); if (req.onerror) req.onerror({ target: req }); }, 0); return req; },
    deleteDatabase: () => ({ onsuccess: null, onerror: null }),
  });
  window.caches = { open: () => Promise.reject(new Error('stub caches')), match: () => Promise.resolve(undefined), keys: () => Promise.resolve([]) };

  // fetch: serve local files, reject network
  const nodeFetch = globalThis.fetch;
  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || String(input);
    if (/^(https?:)?\/\//i.test(url) || /^data:|^blob:/i.test(url)) {
      if (/^data:/i.test(url)) return nodeFetch(url, init);
      return Promise.reject(new window.TypeError('Failed to fetch (network blocked in harness): ' + url));
    }
    const local = path.join(appDir, url.split('?')[0].split('#')[0]);
    if (fs.existsSync(local) && fs.statSync(local).isFile()) {
      const buf = fs.readFileSync(local);
      return Promise.resolve(new globalThis.Response(buf, { status: 200, headers: { 'content-type': local.endsWith('.json') ? 'application/json' : 'text/plain' } }));
    }
    return Promise.resolve(new globalThis.Response('', { status: 404 }));
  };
  window.Response = window.Response || globalThis.Response;
  window.Request = window.Request || globalThis.Request;
  window.Headers = window.Headers || globalThis.Headers;
  window.URL.createObjectURL = window.URL.createObjectURL || (() => 'blob:stub');
  window.URL.revokeObjectURL = window.URL.revokeObjectURL || (() => {});

  // Layout-ish: make clientWidth/offsetWidth etc. nonzero so divide-by-zero style code doesn't blow up
  const dims = { clientWidth: 800, clientHeight: 600, offsetWidth: 800, offsetHeight: 600, scrollWidth: 800, scrollHeight: 600, offsetTop: 0, offsetLeft: 0 };
  for (const k of Object.keys(dims)) {
    Object.defineProperty(window.HTMLElement.prototype, k, { configurable: true, get() { return dims[k]; } });
  }
  window.Element.prototype.getBoundingClientRect = function () { return { x: 0, y: 0, top: 0, left: 0, right: 800, bottom: 600, width: 800, height: 600, toJSON() {} }; };
  window.Element.prototype.getClientRects = function () { return [this.getBoundingClientRect()]; };
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
  Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1 });
  window.HTMLElement.prototype.getBBox = function () { return { x: 0, y: 0, width: 100, height: 20 }; };
  if (window.SVGElement) {
    window.SVGElement.prototype.getBBox = function () { return { x: 0, y: 0, width: 100, height: 20 }; };
    window.SVGElement.prototype.getScreenCTM = function () { return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0, inverse() { return this; } }; };
    window.SVGElement.prototype.getCTM = window.SVGElement.prototype.getScreenCTM;
    window.SVGElement.prototype.createSVGPoint = function () { return { x: 0, y: 0, matrixTransform() { return { x: 0, y: 0 }; } }; };
    window.SVGElement.prototype.getTotalLength = function () { return 100; };
    window.SVGElement.prototype.getPointAtLength = function () { return { x: 0, y: 0 }; };
  }
  window.DOMMatrix = window.DOMMatrix || class DOMMatrix { constructor() { this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0; } inverse() { return this; } multiply() { return this; } translate() { return this; } scale() { return this; } transformPoint(p) { return p; } };
  window.DOMPoint = window.DOMPoint || class DOMPoint { constructor(x = 0, y = 0) { this.x = x; this.y = y; } matrixTransform() { return this; } };
  window.FontFace = class FontFace { constructor() {} load() { return Promise.resolve(this); } };
  doc.fonts = { ready: Promise.resolve(), load: () => Promise.resolve([]), check: () => true, add() {}, addEventListener() {} };

  // Optional: stub the stripped CDN globals so the rest of the app script runs (STUB_LIBS=1)
  if (process.env.STUB_LIBS) {
    const libStub = (n) => makeStub(n, { version: '0.0.0-stub' });
    // pdf.js: getDocument returns a thenable-like object with .promise
    const pdfjsLib = makeStub('pdfjsLib', {
      GlobalWorkerOptions: { workerSrc: '' },
      getDocument: () => ({ promise: Promise.reject(new Error('stub pdfjs')), destroy() {} }),
      version: '3.11.174',
    });
    const libs = {
      d3: libStub('d3'), topojson: libStub('topojson'),
      THREE: makeStub('THREE', { version: '0.0.0-stub', domElement: doc.createElement('canvas') }),
      pdfjsLib, PDFLib: libStub('PDFLib'), Matter: libStub('Matter'), JSZip: libStub('JSZip'),
      jspdf: makeStub('jspdf', { jsPDF: libStub('jsPDF') }), jsPDF: libStub('jsPDF'),
      html2pdf: libStub('html2pdf'), qrcode: libStub('qrcode'), jsQR: () => null,
    };
    for (const [k, v] of Object.entries(libs)) { if (!(k in window)) window[k] = v; }
    result.libStubs = true;
  }

  // window error capture
  window.addEventListener('error', (ev) => {
    const e = ev.error || ev.message;
    result.errors.push({ source: 'window.error', ...fmtErr(e), file: ev.filename, line: ev.lineno, col: ev.colno });
  });
  window.addEventListener('unhandledrejection', (ev) => {
    result.rejections.push(fmtErr(ev.reason));
  });
}

// ---- 4. Run -------------------------------------------------------------------
let dom;
try {
  dom = new JSDOM(html, {
    url: 'http://localhost/apps/' + appName + '/',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    resources: undefined,
    virtualConsole,
    beforeParse,
  });
} catch (e) {
  result.status = 'jsdom-construct-failed';
  result.errors.push({ source: 'construct', ...fmtErr(e) });
  finish();
}

function finish() {
  try { if (dom) dom.window.close(); } catch (_) {}
  // de-dup errors
  const seen = new Set();
  result.errors = result.errors.filter((e) => { const k = e.name + '|' + e.message; if (seen.has(k)) return false; seen.add(k); return true; });
  const seen2 = new Set();
  result.rejections = result.rejections.filter((e) => { const k = e.name + '|' + e.message; if (seen2.has(k)) return false; seen2.add(k); return true; });
  process.stdout.write(JSON.stringify(result));
  process.exit(0);
}

if (dom) {
  // Dispatch a synthetic resize/load has already happened by the time parse completes (scripts run synchronously).
  // Wait for timers, DOMContentLoaded/load handlers, a few rAF ticks.
  const WAIT = Number(process.env.WAIT_MS || 1500);
  if (process.env.RESIZE) {
    setTimeout(() => {
      try {
        dom.window.dispatchEvent(new dom.window.Event('resize'));
        dom.window.document.dispatchEvent(new dom.window.Event('visibilitychange'));
      } catch (e) { result.errors.push({ source: 'resize-dispatch', ...fmtErr(e) }); }
    }, Math.floor(WAIT / 2));
  }
  setTimeout(finish, WAIT);
}
