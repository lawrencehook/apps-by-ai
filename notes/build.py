#!/usr/bin/env python3
"""Generate static, individually linkable reference pages. Run: python3 notes/build.py"""
import html
import json
from pathlib import Path
from content import FIELDS, SOURCES, TOPICS
from formulas import FORMULAS
ROOT = Path(__file__).resolve().parent
LOOKUP = {f"{t['field']}/{t['slug']}": t for t in TOPICS}
e = html.escape

def link(key, base):
    return f'<a href="{base}{key}/index.html">{e(LOOKUP[key]["title"])}</a>'

def tree(base, current):
    out = []
    for field, (name, _) in FIELDS.items():
        topics = [t for t in TOPICS if t['field'] == field]
        opened = ' open' if current.startswith(field) else ''
        rows = []
        for t in topics:
            key = field + '/' + t['slug']
            active = ' aria-current="page"' if key == current else ''
            rows.append(f'<li><a href="{base}{key}/index.html"{active}>{e(t["title"])}</a></li>')
        out.append(f'<details{opened}><summary>{e(name)} <span>{len(topics)}</span></summary><a class="branch-link" href="{base}{field}/index.html">Branch overview →</a><ul>{"".join(rows)}</ul></details>')
    return ''.join(out)

def shell(title, body, base='', current='', description='A personal reference for mathematics, computer science, and theory of computation.'):
    return f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{e(title)} · Notes</title><meta name="description" content="{e(description, quote=True)}">
<link rel="icon" href="{base}../favicons/favicon.ico"><link rel="stylesheet" href="{base}style.css?v=4">
<script src="{base}search-index.js?v=3" defer></script><script src="{base}app.js?v=2" defer></script></head>
<body data-base="{base}"><a class="skip" href="#main">Skip to content</a>
<header class="masthead"><a class="brand" href="{base}index.html"><span aria-hidden="true">ℳ</span> Notes</a><nav aria-label="Site sections"><a href="{base}../index.html">Apps</a><a href="{base}../games/index.html">Games</a><a aria-current="page" href="{base}index.html">Notes</a></nav><button id="tree-toggle" aria-expanded="false" aria-controls="sidebar">Topics</button></header>
<div class="layout"><aside id="sidebar"><a class="all-topics" href="{base}index.html">All topics <span>↗</span></a><form role="search" id="search-form"><label for="topic-search">Find a concept</label><div class="search-box"><input id="topic-search" type="search" placeholder="e.g. eigenvalues" autocomplete="off"><kbd>/</kbd></div><p id="search-status" class="search-status" role="status"></p></form><nav aria-label="Topic tree" class="tree">{tree(base,current)}</nav><p class="sidebar-note">Undergraduate → early graduate<br>{len(TOPICS)} sheets · {sum(len(t["exercises"]) for t in TOPICS)} exercises</p></aside>
<main id="main" tabindex="-1"><section id="search-results" hidden aria-label="Search results"><h1>Find a concept</h1><div id="result-list"></div></section><div id="page-content">{body}</div></main></div>
<footer>Notes <span>Definitions first. Then put them to work.</span><a href="{base}index.html">Topic index ↑</a></footer></body></html>'''

def topic_body(t, base):
    field = t['field']; key = field + '/' + t['slug']
    formula = ('<math xmlns="http://www.w3.org/1998/Math/MathML" display="block" aria-label="'+e(t['formula'],quote=True)+'">'+FORMULAS[key]+'</math>') if key in FORMULAS else e(t['formula'])
    prereq = ', '.join(link(k, base) for k in t['prerequisites']) or 'No prerequisites beyond basic mathematical notation.'
    body = f'''<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="{base}index.html">Notes</a><span>/</span><a href="{base}{field}/index.html">{e(FIELDS[field][0])}</a></nav>
<div class="page-heading"><p class="eyebrow">REFERENCE SHEET</p><h1>{e(t['title'])}</h1><p class="lead">{e(t['summary'])}</p></div>
<p class="prerequisites"><strong>Before this</strong> {prereq}</p><div class="formula" role="math" aria-label="{e(t['formula'],quote=True)}">{formula}</div>
<nav class="section-nav" aria-label="On this page"><a href="#definitions">Definitions</a><a href="#theorems">Theorems</a><a href="#applications">Applications</a><a href="#exercises">Exercises <span>{len(t["exercises"])}</span></a></nav>'''
    for id_, title, items in [('definitions','Definitions',t['definitions']),('theorems','Key theorems',t['theorems']),('applications','Notable applications',t['applications'])]:
        body += f'<section id="{id_}" class="content-section"><h2>{title}</h2>'
        for i, (name, text) in enumerate(items, 1):
            body += f'<article class="entry {id_}"><span class="entry-number">{i:02}</span><div><h3>{e(name)}</h3><p>{e(text)}</p></div></article>'
        body += '</section>'
    body += '<aside class="pitfalls"><h2>Watch the assumptions</h2><ul>' + ''.join(f'<li>{e(p)}</li>' for p in t['pitfalls']) + '</ul></aside>'
    body += '<section id="exercises" class="content-section exercises"><div class="section-title"><h2>Work it out</h2><span>Try before revealing</span></div>'
    for i, (kind, question, hint, solution) in enumerate(t['exercises'], 1):
        body += f'''<article class="exercise" id="exercise-{i}"><p class="eyebrow">{i:02} / {e(kind)}</p><h3>{e(question)}</h3><details class="hint"><summary>Hint</summary><p>{e(hint)}</p></details><details class="solution"><summary>Solution</summary><p>{e(solution)}</p></details></article>'''
    body += '</section><section class="connections"><h2>Connect the ideas</h2><div>' + ''.join(link(k, base) for k in t['related']) + '</div></section>'
    dependents = [k for k, other in LOOKUP.items() if key in other['prerequisites']]
    if dependents:
        body += '<section class="connections"><h2>Build on this</h2><p>These sheets use this topic as a prerequisite.</p><div>' + ''.join(link(k, base) for k in dependents) + '</div></section>'
    body += '<section class="reading"><h2>Go deeper</h2><p>Further reading and full-length treatments:</p><ul>' + ''.join(f'<li><a href="{e(url,quote=True)}">{e(name)} ↗</a></li>' for name, url in SOURCES[field]) + '</ul></section>'
    same = [f"{v['field']}/{v['slug']}" for v in TOPICS if v['field'] == field]; index = same.index(key)
    body += '<nav class="page-turn" aria-label="Adjacent sheets">'
    body += '<div>' + ('<small>PREVIOUS</small>' + link(same[index-1], base) if index else '') + '</div>'
    body += '<div>' + ('<small>NEXT</small>' + link(same[index+1], base) if index + 1 < len(same) else f'<small>EXPLORE</small><a href="{base}index.html">Back to the tree →</a>') + '</div></nav>'
    return body

def index_body(field=None, base=''):
    heading = FIELDS[field][0] if field else 'A map of ideas'
    description = FIELDS[field][1] if field else 'Mathematics, computer science, and theory of computation. A growing tree of definitions, results, and exercises.'
    body = f'<div class="page-heading"><p class="eyebrow">{"BRANCH OVERVIEW" if field else "THE LIVING INDEX"}</p><h1>{e(heading)}</h1><p class="lead">{e(description)}</p></div>'
    if not field:
        body += '<nav class="branch-directory" aria-label="Jump to a branch">' + ''.join(f'<a href="#{slug}">{e(name)}</a>' for slug, (name, _) in FIELDS.items()) + '</nav>'
        body += f'<div class="intro-strip"><span><b>{len(FIELDS):02}</b> branches</span><span><b>{len(TOPICS)}</b> reference sheets</span><span><b>{sum(len(t["exercises"]) for t in TOPICS)}</b> exercises + solutions</span></div><p class="index-guidance">Look up a definition, check a theorem’s assumptions, then test your understanding. Follow prerequisites when an idea is unfamiliar; follow connections when it sparks another question.</p>'
    else:
        body += f'<p class="index-guidance"><a href="{base}index.html">← All branches</a> · Each sheet includes definitions, theorems, applications, and exercises with hints and worked solutions.</p>'
    body += '<section class="topic-index" aria-label="Reference sheets">'
    for i, (slug,(name, description)) in enumerate(FIELDS.items(),1):
        if field and slug != field: continue
        topics = [t for t in TOPICS if t['field'] == slug]
        body += f'<section class="branch" id="{slug}"><header><span class="branch-number">{i:02}</span><div><h2><a href="{base}{slug}/index.html">{e(name)}</a></h2><p>{e(description)}</p></div></header><ul>'
        for t in topics:
            body += f'<li><a href="{base}{slug}/{t["slug"]}/index.html"><span>{e(t["title"])}<small>{e(t["summary"])}</small></span><span class="arrow" aria-hidden="true">↗</span></a></li>'
        body += '</ul></section>'
    body += '</section>'
    if not field:
        body += '<section class="paths"><h2>Paths through the tree</h2>'
        for title, keys in [('From symmetry to matrices',['groups/basics','groups/actions','representations/basics','representations/characters']),('From randomness to inference',['probability/conditioning','probability/random-variables','probability/limits','statistics/inference']),('From geometry to fitting data',['linear-algebra/spaces-maps','linear-algebra/orthogonality','statistics/regression']),('From programs to computational limits',['computer-science/correctness','algorithms/asymptotics','computation/computability','computation/undecidability','computation/complexity']),('From limits to integration',['real-analysis/completeness','real-analysis/function-series','measure-theory/integration','measure-theory/convergence']),('From loops to structure',['topology/spaces','topology/fundamental-group','knots-braids/braids','category-theory/functors']),('From integration to prediction',['measure-theory/integration','probability/conditional-expectation','statistics/regression']),('From derivatives to residues',['complex-analysis/holomorphic','complex-analysis/contours','complex-analysis/residues'])]:
            body += f'<div><h3>{title}</h3><p>' + ' <span aria-hidden="true">→</span> '.join(link(k,base) for k in keys) + '</p></div>'
        body += '</section><p class="scope-note">A starting collection, not a complete encyclopedia. Further directions include differential equations, geometry, functional analysis, distributed systems, and programming languages.</p>'
    return body

def build():
    assert len(LOOKUP) == len(TOPICS), 'Duplicate topic URL'
    def visit(key, trail):
        assert key in LOOKUP, f'Missing prerequisite {key}'
        assert key not in trail, 'Prerequisite cycle: ' + ' → '.join(trail + [key])
        for parent in LOOKUP[key]['prerequisites']: visit(parent, trail + [key])
    for key in LOOKUP: visit(key, [])
    for t in TOPICS:
        for k in t['prerequisites'] + t['related']: assert k in LOOKUP, f'Missing topic {k}'
        assert all(t[k] for k in ('definitions','theorems','applications','exercises'))
        folder = ROOT / t['field'] / t['slug']; folder.mkdir(parents=True, exist_ok=True)
        (folder/'index.html').write_text(shell(t['title'],topic_body(t,'../../'),'../../',t['field']+'/'+t['slug'],t['summary']))
    for field in FIELDS:
        (ROOT/field/'index.html').write_text(shell(FIELDS[field][0],index_body(field,'../'),'../',field))
    (ROOT/'index.html').write_text(shell('Index',index_body()))
    data = [dict(title=t['title'],field=FIELDS[t['field']][0],url=f"{t['field']}/{t['slug']}/index.html",summary=t['summary'],passages=[name+': '+text for section in ('definitions','theorems','applications') for name,text in t[section]],text=' '.join([t['formula']]+[v for k in ('definitions','theorems','applications','exercises') for entry in t[k] for v in entry]+t['pitfalls'])) for t in TOPICS]
    (ROOT/'search-index.js').write_text('window.MATH_INDEX = '+json.dumps(data,ensure_ascii=False)+';\n')
    # Preserve previously shared math URLs, including exercise anchors.
    for page in ROOT.rglob('index.html'):
        relative = page.relative_to(ROOT)
        old = ROOT.parent / 'math' / relative
        old.parent.mkdir(parents=True, exist_ok=True)
        prefix = '../' * len(relative.parts)
        target = prefix + 'notes/' + relative.as_posix()
        old.write_text('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Moved to Notes</title><link rel="canonical" href="'+target+'"><script>location.replace('+json.dumps(target)+'+location.search+location.hash);</script></head><body><p>This page is now in <a href="'+target+'">Notes</a>.</p></body></html>')
    print(f'Built {len(TOPICS)} sheets, {len(FIELDS)} branches, and the index.')

if __name__ == '__main__': build()
