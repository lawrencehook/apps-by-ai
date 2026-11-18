// Runtime load test: opens each app in a stubbed jsdom and reports uncaught errors
// thrown during initial load (ReferenceError, TypeError, ...). Complements
// check-syntax.js, which only proves the code parses.
//
// Setup once:  cd tools/loadtest && npm install
// Usage:       node tools/loadtest/run.js [appName ...]   (no args = all apps, games, the gallery and notes)
// Exit code is non-zero if any app throws or has an unhandled rejection. Vendored libraries (libs/) are
// replaced with permissive stubs, so errors that only appear with the real
// library are out of scope; so is anything behind user interaction.
// LOADTEST_REAL_LIBS=1 executes the real library code instead — useful after
// upgrading a library, but expect three.js to fail on the fake WebGL context.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');

const APPS_ROOT = path.resolve(__dirname, '..', '..', 'apps');
const HERE = __dirname;
const TIMEOUT_MS = 5000;

let apps = process.argv.slice(2);
if (!apps.length) {
  apps = fs.readdirSync(APPS_ROOT).filter((d) => fs.existsSync(path.join(APPS_ROOT, d, 'index.html'))).sort();
  const gamesRoot = path.resolve(APPS_ROOT, '..', 'games');
  if (fs.existsSync(gamesRoot)) {
    apps.push('../games');
    apps.push(...fs.readdirSync(gamesRoot).filter(d => fs.existsSync(path.join(gamesRoot, d, 'index.html'))).sort().map(d => `../games/${d}`));
  }
  // The gallery and the notes home page (one notes page stands in for the generated set: they share app.js)
  apps.push('..');
  if (fs.existsSync(path.resolve(APPS_ROOT, '..', 'notes', 'index.html'))) apps.push('../notes');
}

function load(app) {
  return new Promise((resolve) => {
    execFile(process.execPath, [path.join(HERE, 'child.js'), path.join(APPS_ROOT, app)], { timeout: TIMEOUT_MS, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error && (error.killed || error.signal === 'SIGTERM')) {
        return resolve({ app, status: 'timeout', errors: [], rejections: [], externalLibs: [], stderr: (stderr || '').slice(-2000) });
      }
      try { resolve(JSON.parse(stdout)); }
      catch (e) { resolve({ app, status: 'child-crash', errors: [], rejections: [], externalLibs: [], stdout: (stdout || '').slice(-2000), stderr: (stderr || '').slice(-4000), exit: error && error.code }); }
    });
  });
}

function report(app, res) {
  const flag = res.status !== 'ok' ? res.status.toUpperCase() : (res.errors.length ? 'ERR' : (res.rejections.length ? 'rej' : ((res.consoleErrors || []).length ? 'log' : 'ok ')));
  console.log(`${flag.padEnd(8)} ${app}${res.externalLibs && res.externalLibs.length ? '  [ext: ' + res.externalLibs.map((s) => s.split('/').pop()).join(', ') + ']' : ''}`);
  for (const e of res.errors) console.log(`         ! ${e.name}: ${e.message}${e.line ? ` (line ${e.line}:${e.col})` : ''}`);
  for (const e of res.rejections) console.log(`         ~ rejection ${e.name}: ${e.message}`);
  for (const e of res.consoleErrors || []) console.log(`         ? console.error: ${e}`);
}

(async () => {
// Each page is its own process, so run a few at once; results print in order
const results = new Array(apps.length);
let next = 0;
await Promise.all(Array.from({ length: Math.min(apps.length, Math.max(1, os.cpus().length - 1)) }, async () => {
  while (next < apps.length) {
    const i = next++;
    results[i] = await load(apps[i]);
  }
}));
apps.forEach((app, i) => report(app, results[i]));
fs.writeFileSync(path.join(HERE, 'results.json'), JSON.stringify(results, null, 2));
// A startup failure the app catches and logs is still a failure
const logged = (r) => (r.consoleErrors || []).length;
const clean = results.filter((r) => r.status === 'ok' && !r.errors.length && !r.rejections.length && !logged(r)).length;
console.log(`\n${results.length} apps, ${clean} fully clean, ${results.filter((r) => r.errors.length).length} with uncaught errors, ${results.filter((r) => r.rejections.length).length} with unhandled rejections, ${results.filter(logged).length} with console errors, ${results.filter((r) => r.status !== 'ok').length} non-ok status`);
process.exit(clean === results.length ? 0 : 1);
})();
