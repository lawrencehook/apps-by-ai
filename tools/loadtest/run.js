// Runtime load test: opens each app in a stubbed jsdom and reports uncaught errors
// thrown during initial load (ReferenceError, TypeError, ...). Complements
// check-syntax.js, which only proves the code parses.
//
// Setup once:  cd tools/loadtest && npm install
// Usage:       node tools/loadtest/run.js [appName ...]   (no args = all apps)
// Exit code is non-zero if any app throws. Vendored libraries (libs/) are
// replaced with permissive stubs, so errors that only appear with the real
// library are out of scope; so is anything behind user interaction.
// LOADTEST_REAL_LIBS=1 executes the real library code instead — useful after
// upgrading a library, but expect three.js to fail on the fake WebGL context.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const APPS_ROOT = path.resolve(__dirname, '..', '..', 'apps');
const HERE = __dirname;
const TIMEOUT_MS = 5000;

let apps = process.argv.slice(2);
if (!apps.length) {
  apps = fs.readdirSync(APPS_ROOT).filter((d) => fs.existsSync(path.join(APPS_ROOT, d, 'index.html'))).sort();
}

const results = [];
for (const app of apps) {
  const dir = path.join(APPS_ROOT, app);
  const r = spawnSync(process.execPath, [path.join(HERE, 'child.js'), dir], { timeout: TIMEOUT_MS, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  let res;
  if (r.error && r.error.code === 'ETIMEDOUT' || r.signal === 'SIGTERM') {
    res = { app, status: 'timeout', errors: [], rejections: [], externalLibs: [], stderr: (r.stderr || '').slice(-2000) };
  } else {
    try { res = JSON.parse(r.stdout); }
    catch (e) { res = { app, status: 'child-crash', errors: [], rejections: [], externalLibs: [], stdout: (r.stdout || '').slice(-2000), stderr: (r.stderr || '').slice(-4000), exit: r.status }; }
  }
  results.push(res);
  const flag = res.status !== 'ok' ? res.status.toUpperCase() : (res.errors.length ? 'ERR' : (res.rejections.length ? 'rej' : 'ok '));
  console.log(`${flag.padEnd(8)} ${app}${res.externalLibs && res.externalLibs.length ? '  [ext: ' + res.externalLibs.map((s) => s.split('/').pop()).join(', ') + ']' : ''}`);
  for (const e of res.errors) console.log(`         ! ${e.name}: ${e.message}${e.line ? ` (line ${e.line}:${e.col})` : ''}`);
  for (const e of res.rejections) console.log(`         ~ rejection ${e.name}: ${e.message}`);
}
fs.writeFileSync(path.join(HERE, 'results.json'), JSON.stringify(results, null, 2));
const clean = results.filter((r) => r.status === 'ok' && !r.errors.length && !r.rejections.length).length;
console.log(`\n${results.length} apps, ${clean} fully clean, ${results.filter((r) => r.errors.length).length} with uncaught errors, ${results.filter((r) => r.status !== 'ok').length} non-ok status`);
process.exit(results.some((r) => r.status !== 'ok' || r.errors.length) ? 1 : 0);
