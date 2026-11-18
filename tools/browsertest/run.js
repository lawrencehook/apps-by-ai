// Browser test: opens each app in real headless Chrome, at desktop and phone size, and
// reports what a real browser sees. Complements check-syntax.js (does it parse) and
// tools/smoketest (does it start in a stubbed jsdom) by running the real vendored
// libraries, a real canvas/WebGL, and real layout.
//
// Needs:   Node 22+ (built-in WebSocket) and Chrome or Chromium. No npm install.
//          Set CHROME_PATH if Chrome is not in a standard location.
// Usage:   node tools/browsertest/run.js [appName ...]     (no args = all apps and games)
//          BROWSERTEST_JOBS=4 sets how many apps load at once (default 4).
// Output:  tools/browsertest/screenshots/<app>-desktop.png and -phone.png
//          tools/browsertest/results.json
//
// An app FAILS on: an uncaught exception or unhandled rejection, a local file that fails
// to load, a script requested from outside the repo, or a page that never finishes loading.
// It gets a WARNING (exit code unaffected) for: console.error output, any other remote
// request, a dialog opened on load, or content wider than a 375px phone screen.
// Out of scope: anything behind user interaction, and whether the picture is correct;
// look at the screenshots for that.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { pathToFileURL } = require('url');

const HERE = __dirname;
const APPS_ROOT = path.resolve(HERE, '..', '..', 'apps');
const SHOTS = path.join(HERE, 'screenshots');
const JOBS = Math.max(1, parseInt(process.env.BROWSERTEST_JOBS, 10) || 4);
const LOAD_TIMEOUT_MS = 15000;
const SETTLE_MS = 1500;                 // time for first frames, timers and async startup work
const VIEWS = [
  { name: 'desktop', width: 1280, height: 800, deviceScaleFactor: 1, mobile: false },
  { name: 'phone', width: 375, height: 700, deviceScaleFactor: 2, mobile: true },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean);
  return candidates.find((p) => fs.existsSync(p));
}

function listApps() {
  const apps = fs.readdirSync(APPS_ROOT).filter((d) => fs.existsSync(path.join(APPS_ROOT, d, 'index.html'))).sort();
  const gamesRoot = path.resolve(APPS_ROOT, '..', 'games');
  if (fs.existsSync(gamesRoot)) {
    apps.push('../games');
    apps.push(...fs.readdirSync(gamesRoot).filter((d) => fs.existsSync(path.join(gamesRoot, d, 'index.html'))).sort().map((d) => `../games/${d}`));
  }
  // Same extra pages as the smoke test: the gallery and the notes home page.
  apps.push('..');
  if (fs.existsSync(path.resolve(APPS_ROOT, '..', 'notes', 'index.html'))) apps.push('../notes');
  return apps;
}

async function launchChrome() {
  const chromePath = findChrome();
  if (!chromePath) throw new Error('Chrome not found. Set CHROME_PATH to the Chrome or Chromium executable.');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'browsertest-'));
  // Port 0 lets Chrome pick a free port; it writes the choice to DevToolsActivePort.
  const proc = spawn(chromePath, [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--hide-scrollbars', '--mute-audio', '--no-first-run', '--no-default-browser-check',
    '--allow-file-access-from-files', 'about:blank',
  ], { stdio: 'ignore' });
  const portFile = path.join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 100; i++) {
    if (fs.existsSync(portFile)) {
      const port = parseInt(fs.readFileSync(portFile, 'utf8').split('\n')[0], 10);
      if (port) return { proc, port, profile };
    }
    await sleep(100);
  }
  proc.kill();
  throw new Error('Chrome started but never opened its DevTools port.');
}

// One DevTools Protocol session for one tab.
async function openTab(port) {
  const info = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(info.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve); ws.addEventListener('error', reject); });
  let nextId = 0;
  const pending = new Map();
  const listeners = [];
  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    else if (msg.method) for (const fn of listeners) fn(msg.method, msg.params);
  });
  const send = (method, params = {}) => new Promise((resolve) => {
    const id = ++nextId;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
  const close = async () => {
    try { ws.close(); } catch (e) { /* already closed */ }
    try { await fetch(`http://127.0.0.1:${port}/json/close/${info.id}`); } catch (e) { /* browser gone */ }
  };
  return { send, on: (fn) => listeners.push(fn), close };
}

async function testApp(port, app) {
  const htmlPath = path.join(APPS_ROOT, app, 'index.html');
  const url = pathToFileURL(htmlPath).href;
  const shotName = app === '..' ? 'gallery' : app.replace(/^\.\.\//, '').replace(/[\\/]/g, '_');
  const result = { app, status: 'ok', errors: [], failedRequests: [], remoteScripts: [], warnings: [], screenshots: [] };
  const tab = await openTab(port);
  let view = 'setup';
  let loaded = null;
  const requestUrls = new Map();
  const warn = (text) => { if (!result.warnings.includes(text)) result.warnings.push(text); };

  tab.on((method, p) => {
    if (method === 'Page.loadEventFired' && loaded) loaded();
    else if (method === 'Runtime.exceptionThrown') {
      const d = p.exceptionDetails;
      const text = (d.exception && (d.exception.description || d.exception.value)) || d.text || 'unknown error';
      result.errors.push({ view, message: String(text).split('\n').slice(0, 4).join('\n'), line: d.lineNumber + 1 });
    } else if (method === 'Runtime.consoleAPICalled' && p.type === 'error') {
      warn(`[${view}] console.error: ${p.args.map((a) => a.value !== undefined ? a.value : a.description || a.type).join(' ').slice(0, 300)}`);
    } else if (method === 'Network.requestWillBeSent') {
      requestUrls.set(p.requestId, p.request.url);
      if (/^https?:/i.test(p.request.url)) {
        if (p.type === 'Script') { if (!result.remoteScripts.includes(p.request.url)) result.remoteScripts.push(p.request.url); }
        else warn(`remote request: ${p.request.url.slice(0, 200)}`);
      }
    } else if (method === 'Network.loadingFailed' && !p.canceled) {
      const failedUrl = requestUrls.get(p.requestId) || '(unknown url)';
      if (/^file:/i.test(failedUrl)) result.failedRequests.push({ view, url: failedUrl, reason: p.errorText });
      else warn(`[${view}] request failed: ${failedUrl.slice(0, 200)} (${p.errorText})`);
    } else if (method === 'Page.javascriptDialogOpening') {
      warn(`[${view}] opened a ${p.type} dialog on load: ${String(p.message).slice(0, 120)}`);
      tab.send('Page.handleJavaScriptDialog', { accept: false });
    }
  });

  try {
    await tab.send('Page.enable');
    await tab.send('Runtime.enable');
    await tab.send('Network.enable');
    for (const v of VIEWS) {
      view = v.name;
      // Device metrics must be set before the page loads, or the viewport meta tag is ignored.
      await tab.send('Emulation.setDeviceMetricsOverride', { width: v.width, height: v.height, deviceScaleFactor: v.deviceScaleFactor, mobile: v.mobile });
      await tab.send('Emulation.setTouchEmulationEnabled', { enabled: v.mobile });
      const loadEvent = new Promise((resolve) => { loaded = () => resolve(true); });
      await tab.send('Page.navigate', { url });
      const ok = await Promise.race([loadEvent, sleep(LOAD_TIMEOUT_MS).then(() => false)]);
      loaded = null;
      if (!ok) { result.status = 'timeout'; break; }
      await sleep(SETTLE_MS);
      if (v.mobile) {
        const r = await tab.send('Runtime.evaluate', { expression: 'JSON.stringify([document.documentElement.scrollWidth, window.innerWidth])', returnByValue: true });
        try {
          const [scrollWidth, innerWidth] = JSON.parse(r.result.result.value);
          if (scrollWidth > innerWidth + 1) warn(`[phone] content is ${scrollWidth}px wide on a ${innerWidth}px screen (horizontal scroll)`);
        } catch (e) { /* page replaced document; nothing to measure */ }
      }
      const shot = await tab.send('Page.captureScreenshot', { format: 'png' });
      if (shot.result && shot.result.data) {
        const file = path.join(SHOTS, `${shotName}-${v.name}.png`);
        fs.writeFileSync(file, Buffer.from(shot.result.data, 'base64'));
        result.screenshots.push(path.relative(HERE, file));
      }
    }
  } catch (e) {
    result.status = 'crash';
    result.errors.push({ view, message: `browsertest: ${e.message}` });
  }
  await tab.close();
  return result;
}

const failed = (r) => r.status !== 'ok' || r.errors.length || r.failedRequests.length || r.remoteScripts.length;

function report(r) {
  const flag = r.status !== 'ok' ? r.status.toUpperCase() : failed(r) ? 'ERR' : r.warnings.length ? 'warn' : 'ok';
  console.log(`${flag.padEnd(8)} ${r.app}`);
  for (const e of r.errors) console.log(`         ! [${e.view}] ${e.message.split('\n')[0]}${e.line ? ` (line ${e.line})` : ''}`);
  for (const f of r.failedRequests) console.log(`         ! [${f.view}] failed to load ${f.url.split('/').slice(-3).join('/')} (${f.reason})`);
  for (const s of r.remoteScripts) console.log(`         ! script loaded from outside the repo: ${s}`);
  for (const w of r.warnings) console.log(`         ~ ${w}`);
}

async function main() {
  if (typeof WebSocket === 'undefined') throw new Error('Needs Node 22 or newer (built-in WebSocket).');
  const apps = process.argv.slice(2).length ? process.argv.slice(2) : listApps();
  const missing = apps.filter((a) => !fs.existsSync(path.join(APPS_ROOT, a, 'index.html')));
  if (missing.length) throw new Error(`No index.html for: ${missing.join(', ')}`);
  fs.mkdirSync(SHOTS, { recursive: true });

  const chrome = await launchChrome();
  const results = new Array(apps.length);
  let next = 0;
  try {
    await Promise.all(Array.from({ length: Math.min(JOBS, apps.length) }, async () => {
      while (next < apps.length) {
        const i = next++;
        try { results[i] = await testApp(chrome.port, apps[i]); }
        catch (e) { results[i] = { app: apps[i], status: 'crash', errors: [{ view: 'setup', message: e.message }], failedRequests: [], remoteScripts: [], warnings: [], screenshots: [] }; }
        report(results[i]);
      }
    }));
  } finally {
    chrome.proc.kill();
    await sleep(200);
    try { fs.rmSync(chrome.profile, { recursive: true, force: true }); } catch (e) { /* temp dir; the OS will clear it */ }
  }

  fs.writeFileSync(path.join(HERE, 'results.json'), JSON.stringify(results, null, 2));
  const bad = results.filter(failed).length;
  const warned = results.filter((r) => !failed(r) && r.warnings.length).length;
  console.log(`\n${results.length} apps, ${results.length - bad - warned} clean, ${warned} with warnings only, ${bad} failed`);
  console.log(`Screenshots: ${path.relative(process.cwd(), SHOTS) || '.'}`);
  process.exit(bad ? 1 : 0);
}

main().catch((e) => { console.error(e.message); process.exit(2); });
