const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const root = path.resolve(__dirname, '..');
function pages(dir) { return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e => e.isDirectory() && !e.name.startsWith('.') ? pages(path.join(dir,e.name)) : e.name === 'index.html' ? [path.join(dir,e.name)] : []); }
function open(relative='index.html') {
    const dom = new JSDOM(fs.readFileSync(path.join(root,relative),'utf8'), {runScripts:'outside-only',url:'http://localhost/notes/'+relative});
    for (const script of ['search-index.js','app.js']) dom.window.eval(fs.readFileSync(path.join(root,script),'utf8'));
    return dom;
}
test('all generated pages have valid internal routes, assets, and fragment targets', () => {
    const all = pages(root); assert.equal(all.length,72);
    for (const file of all) {
        const dom = new JSDOM(fs.readFileSync(file,'utf8'));
        const doc = dom.window.document;
        assert.equal(doc.querySelectorAll('h1').length,2); // page and initially hidden search heading
        for (const node of doc.querySelectorAll('a[href],script[src],link[href]')) {
            const href = node.getAttribute('href') || node.getAttribute('src');
            if (/^https?:/.test(href)) continue;
            const [pathname,fragment] = href.split('#');
            const target = pathname ? path.resolve(path.dirname(file),pathname.split('?')[0]) : file;
            assert.ok(fs.existsSync(target),`${file}: missing ${href}`);
            if (fragment && target === file) assert.ok(doc.getElementById(fragment),`${file}: missing #${fragment}`);
        }
        if (file.split(path.sep).length === root.split(path.sep).length+3) {
            for (const id of ['definitions','theorems','applications','exercises']) assert.ok(doc.getElementById(id));
            assert.ok(doc.querySelectorAll('.exercise').length>=2);
            assert.equal(doc.querySelectorAll('.solution[open]').length,0);
            assert.equal(doc.querySelectorAll('.tree a[aria-current="page"]').length,1);
        }
        dom.window.close();
    }
});
test('search finds theorem text, safely handles markup, and recovers from no results', () => {
    const dom=open(), doc=dom.window.document, input=doc.getElementById('topic-search');
    const search=q=>{ input.value=q;input.dispatchEvent(new dom.window.Event('input')); };
    search('Maschke'); assert.match(doc.querySelector('.search-excerpt').textContent,/Maschke/); assert.ok(doc.querySelector('#result-list a').href.endsWith('/representations/basics/index.html'));
    assert.equal(doc.getElementById('page-content').hidden,true);
    search('<img src=x onerror=alert(1)>'); assert.equal(doc.querySelectorAll('#result-list img').length,0);
    assert.match(doc.getElementById('search-status').textContent,/0 sheets/);
    search(''); assert.equal(doc.getElementById('page-content').hidden,false); assert.equal(doc.getElementById('search-results').hidden,true);
    dom.window.close();
});
test('nested sheets resolve search results from the section root and keyboard controls work', () => {
    const dom=open('statistics/regression/index.html'), doc=dom.window.document, input=doc.getElementById('topic-search');
    doc.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'/',bubbles:true}));
    assert.equal(doc.activeElement,input);
    input.value='Bayes'; input.dispatchEvent(new dom.window.Event('input'));
    assert.ok([...doc.querySelectorAll('#result-list a')].some(a=>a.href==='http://localhost/notes/probability/conditioning/index.html'));
    doc.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    assert.equal(input.value,''); assert.equal(doc.getElementById('page-content').hidden,false);
    doc.getElementById('tree-toggle').click(); assert.equal(doc.getElementById('tree-toggle').getAttribute('aria-expanded'),'false');
    dom.window.close();
});

test('new branches are indexed by their definitions and named theorems', () => {
    const dom=open(), doc=dom.window.document, input=doc.getElementById('topic-search');
    for (const [query, target] of [['Dijkstra','algorithms/graphs'],['NAND','computer-science/logic-circuits'],['Cook–Levin','computation/complexity'],['dominated convergence','measure-theory/convergence'],['Yoneda','category-theory/functors'],['Reidemeister','knots-braids/knots'],['van Kampen','topology/coverings'],['Cauchy sequence','real-analysis/completeness'],['residue','complex-analysis/residues']]) {
        input.value=query; input.dispatchEvent(new dom.window.Event('input'));
        assert.ok([...doc.querySelectorAll('#result-list a')].some(a=>a.href.endsWith('/'+target+'/index.html')), query);
    }
    assert.equal(dom.window.MATH_INDEX.length,54);
    dom.window.close();
});

test('prerequisite backlinks connect analysis to prediction', () => {
    const dom=open('measure-theory/integration/index.html');
    const section=[...dom.window.document.querySelectorAll('.connections')].find(s=>s.querySelector('h2').textContent==='Build on this');
    assert.ok([...section.querySelectorAll('a')].some(a=>a.href.endsWith('/probability/conditional-expectation/index.html')));
    dom.window.close();
});
