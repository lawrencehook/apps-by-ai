(() => {
    'use strict';
    const input = document.getElementById('topic-search');
    const results = document.getElementById('search-results');
    const list = document.getElementById('result-list');
    const content = document.getElementById('page-content');
    const status = document.getElementById('search-status');
    const toggle = document.getElementById('tree-toggle');
    const base = document.body.dataset.base;
    const normalize = text => text.normalize('NFKD').toLowerCase().replace(/[–−—]/g, '-');
    const search = () => {
        const query = input.value.trim();
        results.hidden = !query; content.hidden = !!query;
        list.replaceChildren();
        if (!query) { status.textContent = ''; return; }
        const words = normalize(query).split(/\s+/);
        const matches = (window.MATH_INDEX || []).filter(t => words.every(w => normalize(t.title+' '+t.field+' '+t.summary+' '+t.text).includes(w)))
            .sort((a,b) => Number(normalize(b.title).includes(normalize(query))) - Number(normalize(a.title).includes(normalize(query))));
        status.textContent = `${matches.length} ${matches.length === 1 ? 'sheet' : 'sheets'} found`;
        if (!matches.length) { const p = document.createElement('p'); p.textContent = 'No matching sheets yet. Try a broader term such as “variance”, “group”, or “derivative”.'; list.append(p); }
        for (const t of matches) {
            const article = document.createElement('article'), label = document.createElement('small'), h2 = document.createElement('h2'), a = document.createElement('a'), p = document.createElement('p');
            label.textContent = t.field; a.textContent = t.title; a.href = base + t.url; p.textContent = t.summary;
            const passage = (t.passages || []).find(text => words.some(w => normalize(text).includes(w)));
            if (passage && !words.every(w => normalize(t.title+' '+t.summary).includes(w))) {
                const excerpt = document.createElement('p');
                excerpt.className = 'search-excerpt'; excerpt.textContent = passage;
                article.append(excerpt);
            }
            h2.append(a); article.prepend(label,h2,p); list.append(article);
        }
    };
    input.addEventListener('input', search);
    document.getElementById('search-form').addEventListener('submit', e => {
        e.preventDefault(); search();
        if (input.value.trim()) {
            document.body.classList.remove('tree-open'); toggle.setAttribute('aria-expanded','false');
            document.getElementById('main').focus();
        }
    });
    toggle.addEventListener('click', () => { const open = document.body.classList.toggle('tree-open'); toggle.setAttribute('aria-expanded',String(open)); });
    document.addEventListener('keydown', e => {
        if (e.key === '/' && !e.ctrlKey && !e.metaKey && !['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) {
            e.preventDefault(); document.body.classList.add('tree-open'); toggle.setAttribute('aria-expanded','true'); input.focus();
        }
        if (e.key === 'Escape' && document.activeElement === input) { input.value=''; search(); input.blur(); }
    });
})();
