#!/usr/bin/env node
// Syntax-checks the inline <script> blocks of every app (and the gallery).
// Usage: node check-syntax.js [app-name ...]   (no args = all apps)
// Exits non-zero if any script fails to parse. Run this before committing.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const root = __dirname;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'apps-syntax-'));

const wanted = process.argv.slice(2);
const files = wanted.length
    ? wanted.map(n => path.join(root, 'apps', n, 'index.html'))
    : [path.join(root, 'index.html'), ...fs.readdirSync(path.join(root, 'apps'))
        .map(d => path.join(root, 'apps', d, 'index.html'))
        .filter(f => fs.existsSync(f))];

const scriptRe = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi;
// Code must come from the repo (see libs/README.md). Google Fonts is the one
// allowed remote host: two apps preview arbitrary fonts by design, and that is data, not code.
const externalRe = /<script[^>]*\ssrc\s*=\s*["']https?:\/\/|workerSrc\s*=\s*["'`]https?:\/\/|importScripts\(\s*["'`]https?:\/\/|<link[^>]*rel\s*=\s*["']stylesheet["'][^>]*href\s*=\s*["']https?:\/\/(?!fonts\.googleapis\.com)/i;
let ok = 0;
const failures = [];

for (const file of files) {
    const name = file.includes(`${path.sep}apps${path.sep}`) ? path.basename(path.dirname(file)) : 'gallery';
    const html = fs.readFileSync(file, 'utf8');
    const ext = html.match(externalRe);
    if (ext) failures.push({ name, msg: `loads code from a URL: ${ext[0]}… — vendor it into libs/ instead` });
    let match, idx = 0;
    while ((match = scriptRe.exec(html))) {
        const attrs = match[1] || '';
        if (/\bsrc\s*=/.test(attrs)) continue;
        // Skip non-JS blocks such as GLSL shaders or JSON data
        if (/type\s*=\s*["'](?!(module|text\/javascript|application\/javascript)["'])/.test(attrs)) continue;
        const isModule = /type\s*=\s*["']module["']/.test(attrs);
        const out = path.join(tmp, `${name}-${idx++}.${isModule ? 'mjs' : 'js'}`);
        fs.writeFileSync(out, match[2]);
        try {
            execFileSync(process.execPath, ['--check', out], { stdio: ['ignore', 'ignore', 'pipe'] });
            ok++;
        } catch (e) {
            // Node reports the temp path; map it back to the app for readability
            const msg = e.stderr.toString().replace(new RegExp(out.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), file);
            failures.push({ name, msg: msg.split('\n').slice(0, 6).join('\n') });
        }
    }
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`${ok} script blocks OK, ${failures.length} failed`);
for (const f of failures) console.log(`\n### ${f.name}\n${f.msg}`);
process.exit(failures.length ? 1 : 0);
