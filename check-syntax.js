#!/usr/bin/env node
// Syntax-checks inline scripts and local first-party JS for apps, games, notes and galleries,
// rejects code loaded from outside the repo, and validates metadata.json.
// Usage: node check-syntax.js [app-name ...]   (no args = everything)
// Exits non-zero if anything fails. Run this before committing.
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const root = __dirname;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'apps-syntax-'));

const wanted = process.argv.slice(2);
function sectionFiles(section) {
    const dir = path.join(root, section);
    if (!fs.existsSync(dir)) return [];
    return [path.join(dir, 'index.html'), ...fs.readdirSync(dir)
        .map(d => path.join(dir, d, 'index.html'))].filter(f => fs.existsSync(f));
}
function mathFiles(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? mathFiles(path.join(dir, entry.name)) : entry.name === 'index.html' ? [path.join(dir, entry.name)] : []);
}
const files = wanted.length
    ? wanted.map(n => path.join(root, 'apps', n, 'index.html'))
    : [path.join(root, 'index.html'), ...sectionFiles('apps'), ...sectionFiles('games'), ...mathFiles(path.join(root, 'math')), ...mathFiles(path.join(root, 'notes'))];

const scriptRe = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi;
// Code must come from the repo (see libs/README.md). Google Fonts is the one
// allowed remote host: two apps preview arbitrary fonts by design, and that is data, not code.
const remote = /^\s*(https?:)?\/\//i;
function attr(attrs, name) {
    const m = (attrs || '').match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
    return m ? (m[1] ?? m[2] ?? m[3]) : null;
}
function remoteCode(html) {
    for (const m of html.matchAll(/<script(\s[^>]*)?>/gi)) {
        const src = attr(m[1], 'src');
        if (src && remote.test(src)) return m[0];
    }
    for (const m of html.matchAll(/<link(\s[^>]*)?>/gi)) {
        const href = attr(m[1], 'href');
        if (/stylesheet/i.test(attr(m[1], 'rel') || '') && href && remote.test(href) && !/^\s*(https:)?\/\/fonts\.googleapis\.com\//i.test(href)) return m[0];
    }
    // Remote code pulled in from script text: imports, workers, importScripts, pdf.js workerSrc
    const inScript = html.match(/(\bfrom\s*|\bimport\s*\(?\s*|importScripts\(\s*|new\s+(?:Shared)?Worker\(\s*|workerSrc\s*=\s*)["'`](https?:)?\/\/[^"'`\s]+/);
    return inScript ? inScript[0] : null;
}
// Empty type, a JavaScript MIME type or "module" is code; anything else (GLSL, JSON) is data
const jsType = /^(|module|(text|application)\/(javascript|ecmascript))$/i;
let ok = 0;
const failures = [];
const checkedLocal = new Set();

for (const file of files) {
    const name = path.relative(root, file);
    const html = fs.readFileSync(file, 'utf8');
    const ext = remoteCode(html);
    if (ext) failures.push({ name, msg: `loads code from a URL: ${ext}… — vendor it into libs/ instead` });
    let match, idx = 0;
    while ((match = scriptRe.exec(html))) {
        const attrs = match[1] || '';
        const src = attr(attrs, 'src');
        if (src) {
            if (remote.test(src)) continue; // already reported above
            const local = path.resolve(path.dirname(file), src.split(/[?#]/)[0]);
            if (!fs.existsSync(local)) {
                failures.push({ name, msg: `Missing script: ${src}` });
            } else if (!local.startsWith(path.join(root, 'libs') + path.sep) && !checkedLocal.has(local)) {
                checkedLocal.add(local);
                try { execFileSync(process.execPath, ['--check', local], { stdio: ['ignore', 'ignore', 'pipe'] }); ok++; }
                catch (e) { failures.push({ name, msg: e.stderr.toString().split('\n').slice(0, 6).join('\n') }); }
            }
            continue;
        }
        // Skip non-JS blocks such as GLSL shaders or JSON data
        const type = (attr(attrs, 'type') || '').trim();
        if (!jsType.test(type)) continue;
        idx++;
        if (type.toLowerCase() !== 'module') {
            // Compile as a classic script, the way a browser will (node --check would allow top-level await)
            try { new vm.Script(match[2], { filename: `${name} <script ${idx}>` }); ok++; }
            catch (e) { failures.push({ name, msg: `${e.name}: ${e.message}\n${(e.stack || '').split('\n').slice(0, 4).join('\n')}` }); }
            continue;
        }
        const out = path.join(tmp, `${name.replace(/[^a-zA-Z0-9_-]/g, '_')}-${idx}.mjs`);
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

if (!wanted.length) {
    // First-party JS that no <script src> names (workers, imports, tests) still has to parse
    const walk = dir => !fs.existsSync(dir) ? [] : fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
        e.name === 'node_modules' ? [] : e.isDirectory() ? walk(path.join(dir, e.name)) : /\.m?js$/.test(e.name) ? [path.join(dir, e.name)] : []);
    for (const local of ['apps', 'games', 'notes', 'tools'].flatMap(d => walk(path.join(root, d)))) {
        if (checkedLocal.has(local)) continue;
        try { execFileSync(process.execPath, ['--check', local], { stdio: ['ignore', 'ignore', 'pipe'] }); ok++; }
        catch (e) { failures.push({ name: path.relative(root, local), msg: e.stderr.toString().split('\n').slice(0, 6).join('\n') }); }
    }

    // metadata.json feeds the gallery; a bad entry there breaks the page for every app
    const bad = msg => failures.push({ name: 'metadata.json', msg });
    let entries = [];
    try { entries = JSON.parse(fs.readFileSync(path.join(root, 'metadata.json'), 'utf8')); }
    catch (e) { bad(`does not parse: ${e.message}`); }
    if (!Array.isArray(entries)) { bad('must be an array of entries'); entries = []; }
    const ids = new Set(), paths = new Set(), tagCase = new Map();
    for (const [i, app] of entries.entries()) {
        const who = app && app.id ? app.id : `entry ${i}`;
        if (!app || typeof app !== 'object') { bad(`${who}: not an object`); continue; }
        for (const key of ['id', 'title', 'description', 'path']) {
            if (typeof app[key] !== 'string' || !app[key].trim()) bad(`${who}: "${key}" must be a non-empty string`);
        }
        if (ids.has(app.id)) bad(`${who}: duplicate id`);
        ids.add(app.id);
        if (typeof app.path === 'string') {
            const target = path.join(root, app.path.split(/[?#]/)[0]);
            if (!fs.existsSync(target) || !fs.existsSync(target.endsWith('.html') ? target : path.join(target, 'index.html'))) bad(`${who}: path "${app.path}" does not exist`);
            paths.add(path.normalize(app.path.split(/[?#]/)[0]).replace(/(^|[\\/])index\.html$/, '').replace(/[\\/]$/, ''));
        }
        if (!Array.isArray(app.tags) || app.tags.some(t => typeof t !== 'string' || !t.trim())) bad(`${who}: "tags" must be an array of strings`);
        else for (const tag of app.tags) {
            const seen = tagCase.get(tag.toLowerCase());
            if (seen && seen !== tag) bad(`${who}: tag "${tag}" differs only by case from "${seen}"`);
            tagCase.set(tag.toLowerCase(), seen || tag);
        }
        if (app.category !== undefined && (typeof app.category !== 'string' || !app.category.trim())) bad(`${who}: "category" must be a non-empty string`);
        if (app.completeness !== undefined && ![1, 2, 3, 4, 5].includes(app.completeness)) bad(`${who}: "completeness" must be an integer 1-5`);
        if (app.link !== undefined && !/^https?:\/\//.test(app.link)) bad(`${who}: "link" must be an http(s) URL`);
    }
    for (const dir of fs.readdirSync(path.join(root, 'apps'))) {
        if (fs.existsSync(path.join(root, 'apps', dir, 'index.html')) && !paths.has(path.join('apps', dir))) bad(`apps/${dir} has no metadata.json entry`);
    }
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`${ok} scripts OK, ${failures.length} failed`);
for (const f of failures) console.log(`\n### ${f.name}\n${f.msg}`);
process.exit(failures.length ? 1 : 0);
