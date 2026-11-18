# Notes

A personal, undergraduate-to-early-graduate reference for mathematics, computer science, and theory of computation at `/notes/`. It starts with 54 topic sheets across 17 branches and 113 original exercises with hints and worked solutions. Each sheet includes definitions, theorem assumptions, applications, pitfalls, prerequisites, connections, and further-reading links.

## Grow the tree

Edit `content.py`, the authoring source. Each `add(...)` call defines one sheet. Its field and slug determine its stable URL: `notes/<field>/<slug>/index.html`.

1. Add a field to `FIELDS` if needed, with a name and description, and add its further-reading links to `SOURCES`.
2. Add a topic using the existing schema: summary, formula, prerequisite topic keys, definitions, theorems, applications, pitfalls, exercise tuples, and related topic keys.
3. An exercise tuple contains `(kind, question, hint, solution)`. Keep the question self-contained and explain the reasoning in the solution.
4. Run `python3 notes/build.py`. Commit the generated HTML and search index alongside the source; the site needs no Python at runtime.

The builder generates branch overviews, navigation, breadcrumbs, counts, and the search index. Each sheet has at least two exercises; the template counts exercises automatically. Prerequisites also generate reverse “Build on this” links. Search results include a matching definition, theorem, or application when available. Update coverage tests deliberately when adding sheets or exercises. Keep existing slugs stable when renaming titles. Remove obsolete generated directories explicitly when deleting or moving a topic.

`formulas.py` supplies native MathML for display formulas that need fractions, limits, or overbars; plain-text formulas are the fallback.

`build.py` owns the page template. `style.css` owns the dark gallery-aligned layout and print styles. `app.js` adds search and the mobile tree; all content, navigation links, and solution disclosures work without JavaScript. Search requires JavaScript. `/` focuses search; Escape clears it. On a narrow screen, open Topics to search or browse.

## Editorial conventions

- State the scalar field, dimension, regularity, and probability assumptions where relevant.
- Separate a definition from a theorem and an application.
- Include a computation and/or a short proof or counterexample, not just recall prompts.
- Cross-link prerequisites and related concepts rather than repeating entire sheets.
- Write original explanations and exercises. Further-reading links point to full treatments; they are not claims that every exercise was taken from those sources.
- These are reference summaries, not substitutes for full proofs or complete courses.

Useful next branches: differential equations, functional analysis, optimization, Bayesian inference, modules, Lie groups, programming languages, and distributed systems. Expand one coherent branch at a time; avoid empty placeholder pages.

## Verify

```sh
python3 notes/build.py
node check-syntax.js
NODE_PATH=tools/smoketest/node_modules node --test notes/tests/*.test.js
```

The Node tests require the repository's existing `tools/smoketest` jsdom dependency. Set NODE_PATH to that installation if it is elsewhere. Tests check generated routes, fragments, exercise structure, search, and keyboard behavior. They do not certify mathematical correctness; review theorem assumptions and solutions as content changes.

The site is static, uses no external runtime scripts, makes no search requests, and does not save visitor data. No new hosting service is required; it follows the repository's existing deployment workflow.

The tree includes mathematics, computer science, algorithms, and theory of computation, alongside real and complex analysis, measure theory, topology and the fundamental group, knots and braids, and category theory. The builder also maintains redirects from the former `/math/` URLs, preserving query strings and fragment anchors.
