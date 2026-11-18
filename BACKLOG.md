# Review backlog

Findings from a full read of the repo (156 apps, gallery, tooling, game, notes) in November 2026.

- **Severity**: `[H]` wrong output, crash, hang or script injection; `[M]` a feature that misbehaves in normal use; `[L]` edge cases, polish, accessibility.
- **Line numbers** refer to commit `fa7d24b`. The repo-wide fixes below shifted lines by -2 after `escapeHtml` in 14 apps.
- **Verification**: findings were traced in code, and many were run in node or jsdom. None were checked in a real browser, so layout-dependent items are marked `(unverified)`.
- Tick the box when fixed. Rule numbers refer to `DEVELOPMENT_GUIDELINES.md`.

## Done: repo-wide fixes

- [x] `escapeHtml` did not escape quotes (the guideline's own snippet). Replaced in 14 apps and in rule 1. This closes the attribute-injection findings in invoice-generator, receipt-splitter and data-explorer (attribute uses only), and makes jwt-decoder's key/string highlighting work.
- [x] `URL.revokeObjectURL` called immediately after `a.click()` (rule 8): audio-fade, audio-waveform, pdf-watermark, photo-time-lapse-creator, svg-path-animator, speech-to-text-notes.
- [x] Load test dropped local scripts with a `?v=` suffix, so lantern-labyrinth passed without running. It now strips the suffix and fails on a missing local script.
- [x] Load test: fails on `console.error` at startup, fails on `<script type="module">` (jsdom can't run it), runs `defer` scripts after the body, covers the gallery and `notes/`, and runs pages in parallel (5 min down to under 1 min). The `ce` fixture is in the regression test.
- [x] `check-syntax.js`: catches protocol-relative and unquoted remote `src`, `href`-before-`rel` stylesheets, remote `import`/`Worker`; no longer skips `type="text/JavaScript"` or `data-type=` blocks; compiles classic scripts as classic (rejects top-level `await`); checks every first-party `.js` file.
- [x] `check-syntax.js` validates `metadata.json` (required fields, unique ids, paths exist, tag case clashes, every `apps/*` directory has an entry).
- [x] Gallery: escapes metadata fields, tolerates entries without `tags`, validates `?category=`/`?tags=` against known values, checks `response.ok`, Tags arrow starts in the right state, relative favicon paths.
- [x] `metadata.json`: merged `3D`/`3d`, `CSS`/`css`, `JSON`/`json`, `CSV`/`csv`, `Image`/`Images`, `Developer Tools`/`Developer`.
- [x] `auto-brainstorm.sh`: no `eval`, exits if `claude` is missing, gives up after 5 failed brainstorms, re-runs the checks after the fix pass and stops if they still fail, optional `MAX_ITERATIONS`, executable bit.
- [x] Docs: guideline numbering (now 1-24 in order), five new rules (20-24) from recurring bugs, `libs/README.md` three.js users, `notes/README.md` hardcoded `/tmp` path.

## Open: repo-wide

- [ ] `[M]` **Clipboard without guard or fallback (rule 7)**: `navigator.clipboard.writeText` is called bare, so on plain http it throws before `.catch`. Apps: palette-generator, pdf-text-extract, css-glass-morphism-builder, csv-json, code-screenshot, hash-generator, image-to-ascii, markdown-preview, lorem-generator, remove-duplicates, random-password, url-encode, xml-json, yaml-json. Correct versions to copy: jwt-decoder, uuid-generator, unix-timestamp, svg-path-animator.
- [ ] `[M]` **Async loops guarded only by a boolean (rule 20)**: mst, dijkstra, fsm, turing, huffman, bst, convex-hull, pdf-to-images, pdf-rotate, photo-mosaic-generator, hash-generator.
- [ ] `[M]` **UTC date from `toISOString()` (rule 21)**: habit-streak-tracker, countdown-date, invoice-generator, timezone-converter, unix-timestamp, time-progress, git-commit-visualizer, date-difference.
- [ ] `[M]` **Raw user strings in `innerHTML` (rule 1)**: data-explorer, git-commit-visualizer, data-story-builder, dependency-graph-visualizer, budget-sankey, blueprint-annotation-tool, walkthrough-creator, midi-pad.
- [ ] `[M]` **Re-render destroys the focused or dragged element (rule 23)**: invoice-generator, receipt-splitter, data-explorer, data-flow-animator, gradient-mesh-editor.
- [ ] `[M]` **Global key handlers without target/modifier checks (rule 10)**: midi-pad, synth, arpeggios, keyboard-heatmap, signature-studio, dice-roller, coin-flip, reaction-test, photo-time-lapse-creator, walkthrough-creator.
- [ ] `[M]` **Mouse-only or mouse+touch canvases instead of Pointer Events (rule 4)**: blueprint-annotation-tool, circuit-diagram-builder, dependency-graph-visualizer, git-commit-visualizer, data-flow-animator, walkthrough-creator, 3d-globe-visualizer, 3d-room-planner, audio-trim, arpeggios, motion-trail-painter, pdf-redact, gradient-mesh-editor, image-crop, kaleidoscope, lorenz, mandelbrot, metaballs, midi-pad, springs, signature-studio, svg-path-animator, synth, shader, cloth, terrain.
- [ ] `[L]` **Resize wipes or regenerates state (rule 24)**: astar, mst, bfs-dfs, dijkstra, dla, fluid, flowfield, fire, kaleidoscope, langton, maze, springs, reaction-diffusion, quadtree. Not redrawn after resize: neural-network-viz, bst, rbtree.
- [ ] `[L]` **Speed tied to frame rate (rule 22)**: gravity, langton, lorenz, marching-squares, metaballs, kaleidoscope, pendulum, raymarching, data-flow-animator.
- [ ] `[L]` **Fixed control panel with no small-screen rule or `max-height` (rules 5, 6)**: delaunay, dijkstra, dla, fire, fsm, game-of-life, kaleidoscope, langton, lorenz, lsystem, mandelbrot, marching-squares, maze, metaballs, pendulum, quadtree, rbtree, raymarching, reaction-diffusion, synth, sorting, terrain, voronoi, wfc, huffman, 3d-room-planner, bfs-dfs, apollonian-gasket.
- [ ] `[L]` **Labels without `for`, click-only divs (rule 13)**: most apps with a control panel; listed per family in the review, not repeated per app here.
- [ ] `[L]` **No `devicePixelRatio` handling**: nearly every full-window canvas app is soft on hi-DPI screens. budget-sankey hardcodes 2x.
- [ ] `[L]` **URL params applied without allowlists (rule 3)**: arpeggios, name-generator, dice-roller, timer-stopwatch, unix-timestamp, timezone-converter, uuid-generator, random-password, spin-wheel.
- [ ] `[L]` **Loose numeric coercion** (`!isNaN(str)` then `parseFloat`) mangles leading zeros, hex and big integers: csv-json, data-explorer, xml-json.
- [ ] `[L]` **Mode toggle swaps input/output even when the mode didn't change**: url-encode, xml-json, yaml-json.
- [ ] `[L]` **File inputs never reset**, so re-selecting the same file does nothing; image loaders lack `onerror`: photo-mosaic-generator, photo-time-lapse-creator, qr-code-studio, walkthrough-creator, font-specimen-generator, the image tools.

### Shared code worth extracting

- [ ] **PDF tools (10 apps)**: about 150 lines of identical CSS plus drop zone, `handleFile`, `showStatus`, thumbnail grid and download code. Drift so far: revoke delay, strict `file.type !== 'application/pdf'` check (rejects PDFs with an empty MIME type in 8 apps; pdf-merge and pdf-to-images fall back to the extension), keyboard support, no `pdfDoc.destroy()` on "Choose Different File".
- [ ] **Image tools (6 apps)**: shared drop zone/FileReader/download code. Shared defects: output type taken from input type (GIF/BMP/SVG saved as PNG data with the wrong extension), `toDataURL` instead of `toBlob`, no `onerror`, full-resolution re-render on every slider event, state not reset on "Choose Different Image".
- [ ] **Audio tools (5 apps)**: `audioBufferToWav`, `drawWaveform`, drop zone, `formatTime`, play/stop/reset are verbatim copies. Shared defects: waveform drawn while the panel is hidden; "Sample rate" shown is the device rate, not the file's; error status never cleared on a later successful load.
- [ ] **Colour maths**: color-converter and color-picker carry identical conversion functions; `hslToRgb` is copied in dla, fire, fluid, mandelbrot, metaballs.
- [ ] **xml-json / yaml-json** share about 300 lines of shell; **remove-duplicates / sort-lines** are near-identical and sort-lines already has a dedupe option.

### Tooling and repo, still open

- [ ] `[L]` Gallery needs `fetch('metadata.json')`, which fails on `file://` (contradicts rule 16). Ship the data as a `.js` global or inline it.
- [ ] `[M]` `auto-brainstorm.sh` still gives `claude -p` unrestricted Bash/Edit/Write, and `--continue` resumes whichever conversation is most recent in the directory, so a concurrent session there gets the "implement the TOP 3" prompt. Capture and resume an explicit session id; restrict Bash to the check commands.
- [ ] `[L]` No single entry point or CI: add one command that runs check-syntax, loadtest, the loadtest regression test, the game and notes tests, and "build.py leaves git clean".
- [ ] `[L]` Load test library stubs have no `Papa` (papaparse); a startup use would be a false failure.
- [ ] `[L]` `?v=N` cache-busters in `notes/build.py:32-33` and the game's `index.html` are bumped by hand; derive from a content hash.
- [ ] `[L]` 155 of 156 app pages declare no favicon.
- [ ] `[L]` `todo.md` is a fully checked-off list plus an old brainstorm table.

### Game: lantern-labyrinth

- [ ] `[L]` `game.js:807-812,926`: the 25% death penalty is applied only when "Return to town" is clicked; reloading on the death screen keeps all coins.
- [ ] `[L]` `progress.js:8,13-16`: out-of-range saved values reset to 0 instead of clamping (coins over the cap read back as 0).
- [ ] `[L]` `game.js:69,94-96`: a missing `town.js`/`progress.js`/`enemy-audio.js` is reported as "WebGL is required".
- [ ] `[L]` `game.js:1085-1103,696-703`: renders at full rate while paused; failed saves retry every frame.
- [ ] `[L]` Dead code and stale copy: `#newMaze` never shown; "Outfitter" advertised but excluded (`game.js:942`); `maze.fences` always empty (`game.js:271-285`); `MazeWorld.generate` used only by tests; header comment says "no minimap".
- [ ] `[L]` `tests/game.test.js:35-38` injects hooks by string-replacing source; a reformat makes it a silent no-op. Assert the replacement happened.

### Notes

- [ ] `[L]` `notes/build.py:103-117`: the build only adds files, so a renamed or deleted topic leaves its old page and `math/` stub behind.
- [ ] `[L]` `notes/content.py:356,492,498-499`: the function-series sheet has the same exercise twice; index-based patches at the end of the file override earlier entries (lines 71 and 96 are dead text).
- [ ] `[L]` `notes/build.py:104-117`: `write_text` without `encoding='utf-8'` (unverified on a non-UTF-8 locale).

## Open: per app (A-L)

### 3d-globe-visualizer
- [ ] `[M]` `:396-398` Plane dot interpolates linearly in lon/lat while the route is a great-circle arc. Use `d3.geoInterpolate`.
- [ ] `[M]` `:213` Land data loaded with `fetch`, which fails on `file://`; no visible error. Ship it as a `.js` global.

### 3d-room-planner
- [ ] `[L]` `:949-958, 555-559` Room clamp ignores item rotation.
- [ ] `[L]` `:510-512` Drag state only cleared by `mouseup` on the canvas; releasing elsewhere leaves the item stuck to the cursor.
- [ ] `[L]` `:601-603, 1051-1053` Room dimensions not range-checked; furniture not re-clamped when the room shrinks.
- [ ] `[L]` `:863-868` Deselecting sets emissive to black, permanently removing the lamp and TV glow.
- [ ] `[L]` `:30-37` 280px sidebar with no breakpoint; unusable on phones.

### age-calculator
- [ ] `[M]` `:229-233` Day borrow can go negative (DOB Jan 31 viewed Mar 1 shows "-2 days").
- [ ] `[L]` `:210-211, 258-261` Stale result when the date is cleared; Feb 29 birthdays report Mar 1 even when next year is a leap year.

### apollonian-gasket
- [ ] `[H]` `:214-234` Generator accepts both candidate centres with no tangency check and drops the sign of the outer curvature: 1037 of 2247 circles fall outside the outer circle. Keep only the tangent candidate and skip `k4 <= 0`.
- [ ] `[L]` `:41-50, 129, 195-203, 319` "Regenerate" does nothing visible; controls clip on phones; `circleExists` is a linear scan.

### arpeggios
- [ ] `[M]` `:1225-1235` Release scheduled without checking attack+decay fits the note, so most instruments (guitar, strings, harp, synth, marimba) play a broken envelope at default speed.
- [ ] `[M]` `:1982-2027` URL params unvalidated: `?favorites=5` leaves the loading overlay up forever; `?instrument=foo` throws on every click.
- [ ] `[L]` `:2062, 1529-1536` Stored favorites overwrite the ones in a shared link.
- [ ] `[L]` `:1743-1806` Keydown ignores modifiers and `e.repeat`: Cmd+R changes key and blocks reload; held keys stack oscillators.
- [ ] `[L]` `:1194, 1036, 1717` Volume applied twice (50% slider gives 25%); per-instrument release values never used (`:1222`).
- [ ] `[L]` `:1384-1395` Chord cells `preventDefault` on `touchstart`, so the grid can't be scrolled on a phone; favorites need Alt+click.

### astar
- [ ] `[L]` `:342-350` Start and end can be placed on the same cell, after which one is erased.
- [ ] `[L]` `:109, 167` Heuristic uses `Math.SQRT2`, step cost 1.414; not admissible as commented (tiny effect).

### audio-fade
- [ ] `[H]` `:332-336` Waveform and overlays drawn while the panel is hidden; blank until resize. Unhide first.
- [ ] `[L]` `:328-330` Slider labels not refreshed after `max` is lowered for a short file.
- [ ] `[L]` `:339` Error status never cleared on a later successful load (also audio-reverse `:267`).

### audio-merge
- [ ] `[L]` `:253` Files with an empty or non-`audio/*` MIME type are skipped silently.
- [ ] `[L]` `:423, 435-439` Negative gap accepted; a large one throws with no message. The resampling branch (`:425-464`) is dead code.

### audio-recorder
- [ ] `[M]` `:405-407, 657-663` Double-clicking Record starts two pipelines; the first mic stream is never stopped.
- [ ] `[M]` `:425-433, 546` WAV button does nothing; Safari's MP4 recording is saved as `.webm`. Derive the extension from `mediaRecorder.mimeType`.
- [ ] `[L]` `:647-654` Deleting a playing recording leaves it playing with no control.
- [ ] `[L]` `:470-473` Every failure reported as "Microphone access denied".

### audio-reverse
- [ ] `[H]` `:260-264` Waveform drawn while hidden (see audio-fade).

### audio-speed
- [ ] `[H]` `:306-309` Waveform drawn while hidden (see audio-fade).
- [ ] `[L]` `:375, 398` Changing speed during preview doesn't change the playing audio.

### audio-trim
- [ ] `[H]` `:291-295` Waveform and trim overlay drawn while hidden; handles stacked at the left until the first click.
- [ ] `[M]` `:308-314, 457-467` `parseTime` can return NaN, which poisons the trim state; `1:30:00` parses as 1 second.
- [ ] `[L]` `:394-408, 428-430` The `isDragging` click guard never fires, so releasing a drag moves the other handle.

### audio-visualizer
- [ ] `[H]` `:278-280` Audio graph wired once: switching to mic plays it through the speakers; switching back leaves the file silent.
- [ ] `[M]` `:511` Spectrum `step` is 0 on windows wider than 1024px, so every column reads bin 0.
- [ ] `[L]` `:228-237` Mic tears down file playback before permission resolves; object URLs never revoked.

### audio-volume
- [ ] `[M]` `:435-444` Normalize displays the unclamped gain but applies the 300% slider cap (status says 1000%, output is 300%).
- [ ] `[L]` `:406-412` Slider doesn't change gain during playback.
- [ ] `[L]` `:320-321` Error status not cleared on success (also audio-waveform `:366-367`).

### audio-waveform
- [ ] `[L]` `:600-608` Width/Height not validated; clearing Width exports an empty file.
- [ ] `[L]` `:411-434` Preview bar count comes from screen width, export from `settings.width`; three near-identical draw routines.

### base64-encode
- [ ] `[L]` `:200-206` URL-safe decode pads using length including whitespace; a trailing newline gives "Invalid input".

### bfs-dfs
- [ ] `[M]` `:266-269` "DFS" marks neighbours when pushed and never re-pushes, so the order is not depth-first.
- [ ] `[M]` `:302-305` Moving the Grid slider mid-run throws and leaves the button stuck on "Running...".
- [ ] `[L]` `:19-24` Control bar doesn't wrap; clipped below about 500px.

### bifurcation
- [ ] `[M]` `:342-343` Zoom bounds stored in range inputs with `step=0.01`, so deep zoom snaps back wider.
- [ ] `[L]` `:301-310, 332-333` Drag draws a 2-D box but only the r-range is applied.

### blueprint-annotation-tool
- [ ] `[M]` `:839` Label text from `prompt()` into `innerHTML` unescaped.
- [ ] `[M]` `:563, 577, 536` Annotation sizes are in image pixels, so text is about 3px tall on a 4000px scan.
- [ ] `[M]` `:884-889` Zoom In clips the image; pan variables exist (`:374`) but pan is not implemented.
- [ ] `[M]` `:419-421` `initCanvas()` runs while the editor is hidden, so the canvas is always 800px.
- [ ] `[L]` `:761-784` `mouseleave` clears drawing but not dragging.

### bmi-calc
- [ ] `[L]` `:210-216` Scale labels are evenly spaced but the colour stops and marker use 0/14/40/60/100%.
- [ ] `[L]` `:303-310` Category uses unrounded BMI while the display rounds (shows "25.0 Normal weight").

### bst
- [ ] `[M]` `:274` Child spread shrinks by 0.55 per level, so subtrees cross and nodes overlap by depth 5.
- [ ] `[M]` `:220-241` New node is linked before its position is set; an edge to (0,0) shows for about 0.8s.
- [ ] `[L]` `:107-112` Resize updates targets but draws from current positions.
- [ ] `[L]` `:232-237, 313-317, 531-539` Deferred timeouts and Clear not coordinated with running traversals.

### budget-sankey
- [ ] `[M]` `:321, 329` Item name interpolated raw into `value="..."`.
- [ ] `[M]` `:494, 523` Heights scaled by income only: expenses over income run off the canvas; zero income gives NaN.
- [ ] `[M]` `:547, 568` Labels clipped at the canvas edge; short nodes get no label; the tooltip (`:614-621`) is a stub.
- [ ] `[M]` `:300-308` Canvas may grow a few pixels per redraw from the inline baseline gap (unverified).

### case-converter
- [ ] `[M]` `:195` Title Case treats `'` as a word boundary ("Don'T").
- [ ] `[M]` `:199-242` Programmer cases lose camelCase boundaries and treat non-ASCII letters as separators.

### circuit-diagram-builder
- [ ] `[H]` `:1076` `simulate()` ignores wires and sums every component as one series loop. Build a node graph, or relabel the feature.
- [ ] `[L]` `:1087-1109, 634-648` Simulation state goes stale after edits and on error paths.
- [ ] `[L]` `:598-599, 673-674` Component terminals don't land on the wire grid, so wires can't meet them.
- [ ] `[L]` `:724-727` Hit-testing ignores rotation.
- [ ] `[L]` `:1230` NaN and negative values accepted for component properties.
- [ ] `[L]` `:1256-1259` SVG export writes bare rectangles.
- [ ] `[L]` `:559` `mouseup` bound to the canvas only; `:711-722` properties panel not refreshed after toggle/drag/rotate.

### cloth
- [ ] `[H]` `:124` `Stick.update` divides by `dist` with no zero guard; the whole cloth goes NaN. Skip when `dist === 0`.
- [ ] `[M]` `:67` `tearDistance` is a fixed 50px while spacing scales with the window, so the cloth tears itself on large screens.

### code-screenshot
- [ ] `[H]` `:776` PNG export parses computed `background` assuming hex colours; `addColorStop` throws for every background (unverified in a browser). Build the gradient from state.
- [ ] `[M]` `:754` Line numbers are one inline-block before the code, so only line 1 aligns (unverified).
- [ ] `[L]` `:845` Export has no syntax colours, ignores the shadow slider, and rotates the gradient; angle labels at `:327-328` are swapped.
- [ ] `[L]` `:650` `//` and `/*` treated as comments in every language.

### coin-flip
- [ ] `[L]` `:228` Reset during a flip is overwritten by the pending timeout; Space handler doesn't exclude buttons (`:182`).

### collatz
- [ ] `[L]` `:215` "Steps" counts the starting number (27 shows 112, not 111); start 1 draws nothing (`:268`).

### color-blindness-simulator
- [ ] `[L]` `:682` Slider never clears the canvas (transparent PNGs blend); download exports the 800px working copy (`:768`); no `img.onerror` (`:403`).

### color-converter
- [ ] `[M]` `:339` HSL/HSV/CMYK inputs not clamped: `hsl(0,200%,50%)` gives `#17f-7f-7f`.

### convex-hull
- [ ] `[M]` `:141` Stop is reported as "Hull complete" with a filled partial hull; Jarvis's inner loop (`:112`) ignores Stop.

### countdown-date
- [ ] `[M]` `:595` Default date and presets (`:706, 712`) use the UTC date; "1 Month" overflows (Jan 31 to Mar 3).
- [ ] `[L]` `:779` Alarm fires for any past date and leaks an AudioContext each time (`:737`).
- [ ] `[L]` `:492` Settings header is a click-only div; unguarded `localStorage` (`:541, 548`) can abort startup.

### csv-json
- [ ] `[M]` `:302` Numeric coercion corrupts `"02134"`, `"0x1A"`, big integers (also `:315`).
- [ ] `[L]` `:360` `trim()` strips a leading tab, shifting every TSV column.
- [ ] `[L]` `:335` Nested values become `[object Object]`; a `null` row throws.

### data-explorer
- [ ] `[H]` `:919` Headers and cells interpolated raw into `innerHTML` at `:919, 956, 1120, 1143-1158, 1240-1250, 1265-1266, 1279, 1294`.
- [ ] `[H]` `:595` `#loadNewBtn` carries class `view-btn`, so after loading a new file the table still shows the previous one.
- [ ] `[M]` `:1072` Scatter card hidden for a 1-numeric-column file never reappears; select listeners added on every load (`:1087-1088`).
- [ ] `[M]` `:1312` Typing in a numeric filter re-renders the table and destroys the input.
- [ ] `[M]` `:981` `Math.max(...)` over a data-sized array throws past about 130k distinct values (rule 19); `findMode` (`:997`) is dead.
- [ ] `[M]` `:1273` Nothing capped: full table, one scatter div per row, one div per unique value.
- [ ] `[L]` `:821` A column is numeric if any one cell parses; numeric filter matches the raw number, not the displayed string (`:1201`).

### data-flow-animator
- [ ] `[H]` `:503` Dragging a node re-renders and moves a detached element; the visible node stays put.
- [ ] `[L]` `:359` "Export as GIF" saves a static PNG; "click to edit" has no edit; connections can't be deleted; dead preview code (`:690-696`).
- [ ] `[L]` `:464` Mouse-only drag, hover-only delete, presets clipped at 768px.

### data-story-builder
- [ ] `[M]` `:1050-1060, 1070-1080` Stagger delays grow without bound: the 11th line point is NaN and never appears; later pie slices and labels stay hidden.
- [ ] `[M]` `:787-790, 874-876` `stroke-dasharray` is a guessed length, so short series draw a truncated line. Use `getTotalLength()`.
- [ ] `[M]` `:710, 718, 770, 794, 920, 948, 965` Headers and labels raw into `innerHTML`.
- [ ] `[M]` `:984-989, 1093-1103` Pause/seek ignore `speed`, so progress jumps at 2x and 0.5x.
- [ ] `[M]` `:1117-1148` Exported SVG/PNG lack the page stylesheet (black fills, invisible grid); title and legend never exported.
- [ ] `[L]` `:915-917` A 100% pie slice renders nothing.
- [ ] `[L]` `:546-550, 683` Empty cells become NaN and hide all bars; quoted commas split.

### date-difference
- [ ] `[M]` `:267-281` Dates parsed as UTC but months read with local getters; day-of-month ignored (Jan 31 to Feb 1 is "1 month").
- [ ] `[M]` `:290-293` Breakdown uses 365-day years and 30-day months (Jan 1 to Jan 1 next leap year is "1 year, 1 day").

### delaunay
- [ ] `[M]` `:73` Super-triangle margin of 10x drops hull triangles in about 30% of random point sets. Use 1000x.

### dependency-graph-visualizer
- [ ] `[M]` `:793-798, 897-901` Package names and versions raw into `innerHTML`.
- [ ] `[M]` `:512-534` Invents 1-3 random "transitive" dependencies per package and counts them in the stats.
- [ ] `[M]` `:979-988` Canvas is mouse-only.
- [ ] `[L]` `:544, 561` requirements.txt parser misreads `zope.interface==5.0`, `-r base.txt`, extras; invalid package.json fails silently.

### dice-roller
- [ ] `[L]` `:220-226` Space/Enter handler swallows Enter on focused buttons and the Back link.
- [ ] `[L]` `:188-189` `?sides=` not validated.

### dijkstra
- [ ] `[H]` `:289-299` Resize or New Graph mid-run throws inside the async loop and leaves `running` true; app dead until reload (via `:95-99, 366-370`).
- [ ] `[M]` `:120-157` Graph is usually disconnected at default settings (start and end connected 16% of the time at 1080p).

### dla
- [ ] `[L]` `:94, 110, 140` Circle seed spawns walkers on the seed ring, giving a solid ring.
- [ ] `[L]` `:231-247` Walkers pass through occupied cells and stick on them, inflating the count.
- [ ] `[L]` `:297-299` Lowering the walker count leaves their pixels behind.

### favicon-generator
- [ ] `[M]` `:314` Smoothing disabled for small sizes, so large sources downscale by nearest-neighbour (also `:402, 562`).
- [ ] `[M]` `:421-429, 574-580` ICO entries declare an AND mask that isn't written (unverified against strict decoders); two near-identical ICO builders.

### fluid
- [ ] `[H]` `:160, 190` 2D solver uses 3D constants (`1 + 6*a`, `c = 6`); dye drains about 20% per frame at 1080p. Use `1 + 4*a` and `4`.
- [ ] `[M]` `:104-108` Grid scales with the window; about 4 fps at 4K. Cap the grid.

### font-pairing-preview
- [ ] `[L]` `:522` Exported `@import` requests a weight the family lacks, so Google drops the family (Bebas Neue at 700).
- [ ] `[L]` `:402-410` Depends on remote Google Fonts with no offline notice (also font-specimen-generator `:396-405`).

### font-specimen-generator
- [ ] `[L]` `:483-488` After a custom font upload the dropdown still shows the old font, so re-picking it does nothing.

### fourier
- [ ] `[H]` `:128, 146, 225` DFT bins above N/2 used as positive frequencies; path zig-zags at non-integer speeds. Use `k > N/2 ? k - N : k`.

### fsm
- [ ] `[H]` `:395-401` "REJECTED (invalid symbol)" is overwritten by `updateUI()`, so invalid input can show ACCEPTED (also `:449-455`).
- [ ] `[L]` `:422-486` Reset and preset change don't cancel the run loop.
- [ ] `[L]` `:221-244` Self-loop labels drawn on top of each other.

### game-of-life
- [ ] `[L]` `:255-265` A tap with slight movement re-sets the cell it just cleared.

### git-commit-visualizer
- [ ] `[H]` `:727` Tooltip built with `innerHTML` from pasted author, message and hash.
- [ ] `[M]` `:429` Branch detection never fires for real `git log --graph` output; custom format hardcodes branch 0 (`:411`).
- [ ] `[M]` `:445` Any parenthesised text in the subject is taken as the author (`feat(ui):` gives author "ui").
- [ ] `[M]` `:403` Plain `git log` output parses to zero commits with no message.
- [ ] `[M]` `:795` Canvas is mouse/wheel only; long logs can't be scrolled on touch.
- [ ] `[L]` `:408` `YYYY-MM-DD` parsed as UTC, shown a day early in the Americas.
- [ ] `[L]` `:496` Heatmap covers only the last 52 weeks from today, so the sample data renders empty.

### gradient-mesh-editor
- [ ] `[M]` `:623` SVG export centres each gradient relative to its own circle; blur differs from PNG.
- [ ] `[M]` `:419` Markers, pointer mapping and rendering use three coordinate mappings (16px offsets).
- [ ] `[M]` `:487` `touchstart` re-renders markers, detaching the touch target (unverified on a device).

### gravity
- [ ] `[L]` `:135` Merge keeps the lower-index body's position and colour regardless of mass; `pointercancel` unhandled.

### habit-streak-tracker
- [ ] `[H]` `:280` `formatDate` uses UTC while the heatmap is local; "Mark Today" stores the wrong day for part of every day outside UTC.

### hash-generator
- [ ] `[H]` `:212` MD5 is wrong for almost every input: sparse `words` holes reach `addUnsigned` as `undefined`. Zero-fill before the rounds (`:248-256`).
- [ ] `[L]` `:350` SHA failures only logged; `crypto.subtle` missing leaves rows at "-" with no message.
- [ ] `[L]` `:329` No staleness check across the three awaits (unverified).

### huffman
- [ ] `[M]` `:378` Cancel flag is reset immediately, so a second encode runs two animation loops (`:328`).
- [ ] `[M]` `:184` Leaves overlap from depth 4 (0.55 spread factor).
- [ ] `[M]` `:12` Fixed 320px sidebar, no media query; canvas is 55px wide on a phone.

### hyperbolic-tiling
- [ ] `[H]` `:279` Neighbours generated by Euclidean reflection (`:279-292`), so this is not a Poincare-disk tiling; vertices leave the unit disk. The Mobius helpers (`:196-218`) are dead code. Reflect by circle inversion and traverse breadth-first.

### image-convert
- [ ] `[L]` `:219` `#sizeEstimate` never written; status not cleared on a later successful load.
- [ ] `[L]` `:351` WebP result not checked; a browser without the encoder saves PNG data as `.webp` (unverified).

### image-crop
- [ ] `[M]` `:548` Output encoded with the input's type; GIF/SVG inputs become PNG data with the wrong extension (same in image-filters `:383`, image-rotate `:310`, image-watermark `:579`, image-resize `:430`).
- [ ] `[M]` `:457` Resize clamps each side independently, breaking the aspect lock and the anchor corner.

### image-filters
- [ ] `[M]` `:343` Depends on `ctx.filter` with no feature detection (unverified in Safari; also gradient-mesh-editor `:389, 599`).

### image-resize
- [ ] `[L]` `:433` JPEG output has no background fill, so transparency turns black.
- [ ] `[L]` `:338` With the aspect lock, a computed height of 0 falls back to the original height.

### image-rotate
- [ ] `[M]` `:263` Flip is applied before rotation, so after 90/270 degrees the flip buttons act on the wrong axis.

### image-to-ascii
- [ ] `[H]` `:322` "Detailed" `data-chars` uses `\"` inside a double-quoted attribute, cutting the ramp to 6 characters and breaking the button label. Use `&quot;` or a JS map.
- [ ] `[L]` `:521` Target height can round to 0 and throw.
- [ ] `[L]` `:573` Light background renders a negative unless Invert is also ticked.

### image-watermark
- [ ] `[L]` `:493` Tiled watermark doesn't cover elongated images (wider than 2.27:1 or narrower than 1:2; also `:519`).

### invoice-generator
- [ ] `[M]` `:669` Items with an empty description are hidden but still summed (`:679`).
- [ ] `[M]` `:646` Every `change` re-renders all rows, dropping focus on Tab.
- [ ] `[L]` `:590` Default dates use the UTC date.
- [ ] `[L]` `:717` Multi-line notes collapse to one line (needs `white-space: pre-wrap`).

### json-formatter
- [ ] `[L]` `:224` Round-trips through `JSON.parse`, silently changing big integers, `1.0` and duplicate keys.

### julia-sets
- [ ] `[M]` `:155` "Click Mandelbrot point to explore" but there is no Mandelbrot view and no canvas listener.

### jwt-decoder
- [ ] `[M]` `:276` A failed decode leaves the previous token's payload and claims on screen (also `:267`).
- [ ] `[L]` `:241` Number highlighting also wraps digits inside string values.

### kaleidoscope
- [ ] `[M]` `:580` Setting the label's `textContent` deletes the file input nested inside it; a second image can only be dropped.
- [ ] `[M]` `:380` `startWebcam` races with `stopWebcam` and leaks camera streams.
- [ ] `[L]` `:24` Controls unreachable on short viewports; resize (`:344`) wipes the drawing.

### keyboard-heatmap
- [ ] `[M]` `:569` While recording, Tab and Ctrl/Cmd combos are swallowed, so a keyboard user can't reach Stop (partly unverified).

### langton
- [ ] `[L]` `:119` Ant start offsets go negative on narrow screens.

### list-picker
- [ ] `[L]` `:184` Items joined by `,` in the URL, so "Smith, John" reloads as two items.

### loan-calc
- [ ] `[L]` `:286` Empty or zero term silently computes a 1-year loan; subtitle promises amortization the page doesn't have.

### lsystem
- [ ] `[M]` `:182` No fit-to-view: the default tree is 1260px tall and runs off the top.
- [ ] `[L]` `:264` Iteration cap only applied on preset change; "Stochastic Tree" is deterministic; "Regenerate" redraws the same image.

## Open: per app (M-Z)

### marching-squares
- [ ] `[L]` `:140` Field re-evaluated four times per cell per contour level (about 10M calls per frame at 1080p). Sample once into a grid.
- [ ] `[L]` `:214` Thresholds are in (0, 2) but Sine Waves ranges over about [-1.5, 1.5], so half the field has no contours.
- [ ] `[L]` `:182` Out-of-bounds balls flip velocity every frame and jitter (also metaballs `:72`).

### markdown-preview
- [ ] `[H]` `:265` Link and image URLs unvalidated: `[x](javascript:...)` gives a live link. (The attribute break-out via `"` is closed by the `escapeHtml` fix.) Allow only `https?:`, `mailto:`, `#` and relative URLs.
- [ ] `[M]` `:200` HR and Code Block buttons insert a literal `\n`.
- [ ] `[M]` `:350` Link, Image and Code Block buttons delete the selection instead of wrapping it.
- [ ] `[M]` `:243` Code blocks and spans aren't protected from later passes (emphasis, headings and lists run inside them).
- [ ] `[L]` `:273` `***` renders as emphasis, task lists lose their `<ul>`, `*` bullets with emphasis are eaten.

### midi-pad
- [ ] `[H]` `:2837` Keydown handler has no target check: pad keys can't be typed into the name and BPM fields; Ctrl/Cmd combos swallowed.
- [ ] `[H]` `:2919` Drive slider passes a string into `makeDistortionCurve`, so `3 + amount` concatenates: output 7-30x louder. Wrap in `Number()`.
- [ ] `[M]` `:2533` Recording quantizes to the next step, not the nearest, causing a double trigger.
- [ ] `[M]` `:2882` Changing Bars or Quantize while playing leaves the interval on old values; note steps aren't rescaled.
- [ ] `[M]` `:2130` `touchstart` `preventDefault` suppresses the click that selects a pad, so pads can't be configured on touch.
- [ ] `[M]` `:2650` Import applies JSON unvalidated; a bad `bank` breaks every pad hit; `"bars": 1000` freezes the tab.
- [ ] `[L]` `:2218` Pad name interpolated raw into `value="..."`.
- [ ] `[L]` `:2018` `volume || 0.8` treats 0 as unset (also `:2071, 2365`).
- [ ] `[L]` `:991` Chord octave is one below the Synth bank's convention.
- [ ] `[L]` `:2905` Sliders moved before the AudioContext exists are ignored.
- [ ] `[L]` `:2237` Pitch and Decay sliders can't represent several presets (8000 Hz hi-hat pegs at 2000).
- [ ] `[L]` `:1994` A new 2-second noise buffer per noise voice.
- [ ] `[L]` `:2541` Velocity always recorded as 1; MIDI badge never clears after unplugging (`:2770`).
- [ ] `[L]` `:1158` Nothing calls `audioCtx.resume()` (unverified).

### motion-trail-painter
- [ ] `[L]` `:143` Below 768px the info panel covers the Back link.

### mst
- [ ] `[M]` `:356` "New Graph" mid-run lets the old coroutine write into the new graph.
- [ ] `[L]` `:85` Any idle resize regenerates the graph and discards the result.

### music-chord-visualizer
- [ ] `[M]` `:527` Black keys are shifted about 32px right, sitting on top of D, E, G, A, B.
- [ ] `[M]` `:609` Guitar "fingering" takes the lowest chord tone per string and can omit the root (C Maj7 shows E minor).
- [ ] `[L]` `:505` Keys labelled C4 play C3.

### name-generator
- [ ] `[L]` `:398` `count` never clamped (`?count=200000` freezes the tab); unknown `?type=` yields an empty card.
- [ ] `[L]` `:329` "Alliterative" silently falls back for vowels and V/Q/Z; Unique returns fewer names with no message.

### neural-network-viz
- [ ] `[L]` `:509` Resize clears the canvas and doesn't redraw.
- [ ] `[L]` `:744` Ten full redraws and accuracy passes per frame; only the last is seen.

### palette-generator
- [ ] `[L]` `:399` "Generate New" and Space are deterministic in six of seven modes, so nothing changes.

### particle-life
- [ ] `[L]` `:293` Force wraps at the edges but neighbour lookup doesn't, so clusters tear at the border.

### pdf-page-numbers
- [ ] `[M]` `:479` Placement ignores `/Rotate`, CropBox and MediaBox origin; preview and output disagree on rotated pages.
- [ ] `[L]` `:491` Top positions sit a full font size too high.
- [ ] `[L]` `:485` Text width guessed, so centre/right alignment drifts. Use `font.widthOfTextAtSize`.
- [ ] `[L]` `:383` Preview total differs from the output total when Start From Page is above 1 (`:482`).
- [ ] `[L]` `:385` Preview overlay ignores CSS shrink of the canvas (`:128`).
- [ ] `[L]` `:470` Start From Page beyond the page count numbers nothing and reports success.

### pdf-redact
- [ ] `[H]` `:584` Export scales boxes by a fixed `RENDER_SCALE`, but the canvas is CSS-shrunk (`:119, 305-306`): on a phone or wide page the boxes land in the wrong place and the text stays visible. Store boxes as fractions of the displayed rect.
- [ ] `[L]` `:443` `touchstart` blocks page scroll; delete button is hover-only (`:150-153`); `cursor: move` with no move handler (`:133`).
- [ ] `[L]` `:486` No `touchcancel`: an interrupted drag leaves a box on screen that isn't exported (unverified).
- [ ] `[L]` `:217, 286` Progress bar hidden during load; all pages rendered at 2x and kept (about 770MB for 100 pages).

### pdf-rotate
- [ ] `[M]` `:302` Preview replaces the page's own `/Rotate` instead of adding to it, so pre-rotated scans preview sideways while save (`:376`) is correct.
- [ ] `[L]` `:359` Overlapping renders on one canvas (unverified); initial previews un-awaited (`:292`).

### pdf-split
- [ ] `[L]` `:328` Lenient range parsing: "1-3-5" becomes 1-3, "2x" becomes 2, en dash ranges become one page.
- [ ] `[L]` `:367` One download per page; browsers block most of them. Zip with the vendored JSZip (also pdf-to-images `:380`).

### pdf-text-extract
- [ ] `[L]` `:171` Progress bar is inside the hidden result panel during the first extraction.

### pdf-to-images
- [ ] `[M]` `:403` Changing Scale re-enters the async render: duplicate pages, mixed scales, double handlers (`:344`).
- [ ] `[M]` `:329` Every page rendered at export scale as its thumbnail: 50 pages at 4x is about 1.5GB.

### pdf-watermark
- [ ] `[M]` `:457` PDF rotation direction is mirrored and pivots at the text's left baseline, so output doesn't match the preview.
- [ ] `[L]` `:457` Non-Latin watermark text previews fine, then fails with a raw "WinAnsi cannot encode" error.
- [ ] `[L]` `:360` Preview font ignores CSS shrink of the canvas.

### pendulum
- [ ] `[L]` `:109` Trail can never shrink when Trail Length is lowered.

### photo-mosaic-generator
- [ ] `[M]` `:538` `generateMosaic` has no re-entrancy guard; two runs draw into the same canvas.
- [ ] `[L]` `:657` Halftone dot radius is inverted for the dark background.

### photo-time-lapse-creator
- [ ] `[H]` `:461` Photos pushed in decode-completion order, not selection order. Write into a pre-sized array by index.
- [ ] `[M]` `:472` No `onerror`: one undecodable file means the editor never opens.
- [ ] `[M]` `:852` Export paces frames with chained `setTimeout`, so the video always runs long, and far longer if the tab is backgrounded.
- [ ] `[M]` `:763` Scrubbing rebuilds every thumbnail from a full-resolution data URL on each mousemove (`:468`).
- [ ] `[L]` `:597` Exported video ends by fading back to photo 1.
- [ ] `[L]` `:565` Dropping a desktop file on a thumbnail silently reorders photos.
- [ ] `[L]` `:760` Scrubbing to the far right shows "N+1 / N".
- [ ] `[L]` `:782` Export has no feature detection; Safari's container saved as `.webm` (`:812`); editing stays live during export.
- [ ] `[L]` `:873` Space shortcut doesn't exclude buttons (unverified).

### physics-sandbox
- [ ] `[M]` `:432` "Drag" mode button is wired to nothing (`:322`).
- [ ] `[M]` `:512` Resize ignores `pixelRatio`, so pointers stop matching bodies on hi-DPI; the fall-off cull (`:497`) uses the load-time height.

### pomodoro-flow
- [ ] `[H]` `:582` Countdown decrements per `setInterval` tick (`:593`), so it runs late in background tabs. Store an end time and compute from `Date.now()`.
- [ ] `[M]` `:519` Long break uses the short-break total, so the ring is wrong until under 5:00.
- [ ] `[M]` `:650` Skip credits a full work session to the stats.
- [ ] `[L]` `:480` Unguarded storage and AudioContext; daily reset only happens at load (`:487`).

### primes
- [ ] `[M]` `:290` Cells drawn 0px wide when the grid side is 301 or more, so Max above 90,000 is blank (also `:361, 430`).
- [ ] `[M]` `:403` Gap chart shows only the first 580 gaps at the default Max.
- [ ] `[L]` `:299` Ulam spiral start is off by one for even grid sides; the outer ring is lost.

### qr-code-studio
- [ ] `[H]` `:393` Default byte encoder mangles non-ASCII content. Set `qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8']`.
- [ ] `[M]` `:434` Wi-Fi payload doesn't escape `\ ; , : "` in SSID or password.
- [ ] `[M]` `:583` `logoImage` assigned before load with no `onerror`; a bad drop breaks every later render.
- [ ] `[L]` `:513` Leaving the Scan tab doesn't stop the camera.
- [ ] `[L]` `:429` Empty input encodes `https://example.com`; on failure the previous QR stays downloadable.
- [ ] `[L]` `:624` SVG export omits the logo.
- [ ] `[L]` `:500` Logo patch drawn regardless of error-correction level; quiet zone is 2 modules (unverified scan failure).

### random-number
- [ ] `[M]` `:188` `parseInt(max) || 100` treats 0 as missing.
- [ ] `[M]` `:209` No-duplicates mode allocates the whole range; a billion-wide range freezes the tab.

### random-password
- [ ] `[L]` `:198` `?len=` written verbatim to the label while the slider clamps it.

### raymarching
- [ ] `[H]` `:95` `sdTorus` calls a 3-component `length` on 2-element arrays; always NaN, so the torus scene is blank. Use `Math.hypot`.
- [ ] `[M]` `:189` CPU per-pixel renderer allocates per vector op: 1-10 fps at 1080p.

### rbtree
- [ ] `[L]` `:183` Layout spread factor 0.6 makes subtrees cross from depth 4.
- [ ] `[L]` `:247` Resize updates targets but nothing animates.
- [ ] `[L]` `:229` Each insert starts another rAF loop.

### reaction-diffusion
- [ ] `[L]` `:208` Ten steps per frame over a half-resolution grid: about 12 fps at 1080p. Cap the grid.

### reaction-test
- [ ] `[L]` `:347` Timing stops on `click` (button release), inflating results. Use `pointerdown`.
- [ ] `[L]` `:369` Space handler has no target or `e.repeat` check.

### receipt-splitter
- [ ] `[M]` `:575` Unassigned items are dropped silently (the default flow gives a $0.00 total); extras dropped when subtotal is 0 (`:611`).
- [ ] `[M]` `:633` Shares rounded independently: $10 three ways shows $9.99 against a $10.00 total. Work in cents.
- [ ] `[L]` `:526` Editing a price re-renders the list on blur and loses focus.
- [ ] `[L]` `:447` Colour chosen by `people.length`, so colours repeat after a removal.

### regex-tester
- [ ] `[H]` `:319-325` Zero-length match with the `u`/`v` flag on astral characters loops forever. Advance by code point or use `matchAll`, and cap matches.
- [ ] `[L]` `:309-336` Matching runs synchronously on every keystroke; `(a+)+$` freezes the tab.

### remove-duplicates
- [ ] `[L]` `:169` Empty input reports 1 line (also sort-lines `:278`).

### resume-ats-analyzer
- [ ] `[M]` `:567-571` Bidirectional substring "partial match" inflates the score ("UI" matches "requires").
- [ ] `[M]` `:670-673` Sequential highlighting corrupts its own inserted markup (keywords "class", "span"); `c++` and `c#` never highlight.
- [ ] `[L]` `:625-635` A score of 0 leaves the previous score on screen; intervals not cleared.

### shader
- [ ] `[L]` `:306-310, 341` `resize()` throws when WebGL is unavailable; buffers and shaders leak on each switch (`:293`).

### signature-studio
- [ ] `[M]` `:1517-1549` Multi-page PDFs: placement is not per page and export contains only the visible page.
- [ ] `[M]` `:1298, 1276` No way to replace a loaded document; `loadPDF` has no error handling.
- [ ] `[L]` `:1422, 348` Rotate handle has no listener; resize handle is mouse-only (`:1490`).
- [ ] `[L]` `:968-969, 631` Smoothing at 1.0 means the pen never moves.
- [ ] `[L]` `:1073` Saving with an empty name stores a signature reading "Your Name".
- [ ] `[L]` `:1382, 1413` Deleting a saved signature leaves a stale selection index that throws.
- [ ] `[L]` `:1585-1594` Ctrl/Cmd+Z captured while typing in the name field.
- [ ] `[L]` `:939, 1035-1042` "Pressure sensitive" does nothing with mouse/touch events.
- [ ] `[L]` `:1264-1274, 1328-1340` Rapid page changes start overlapping renders (unverified).
- [ ] `[L]` `:121-124, 599` 700px canvases have no `max-width` (unverified on a phone).

### sort-lines
- [ ] `[L]` `:248-256` Numeric sort reads a hyphen separator as a minus sign (`task-10` sorts before `task-2`).

### sorting
- [ ] `[L]` `:159-165, 236-246` Final comparison and swap counts are short; the algorithms themselves are correct.
- [ ] `[L]` `:19-23, 10` Control panel covers the first sorter card.

### speech-to-text-notes
- [ ] `[M]` `:558-563` Mic stream and AudioContext never released; the mic indicator stays on.
- [ ] `[M]` `:594-598, 643-654` Recognition restarts forever on errors other than `not-allowed`.
- [ ] `[M]` `:591, 550-552` Each auto-restart adds another visualizer rAF loop.
- [ ] `[M]` `:734-751, 944-948` Each new tab re-saves the same note under a new id, evicting real history.
- [ ] `[M]` `:929-931, 638` Typing while recording appends the interim phrase twice.
- [ ] `[L]` `:841-848` "Load" overwrites the current note without confirmation.

### spin-wheel
- [ ] `[H]` `:391` Winner formula is off by one slice. Use `(N - 1 - floor(Rn / s) + N) % N`.
- [ ] `[L]` `:271` `decodeURIComponent` on `?options=` not wrapped; a stray `%` breaks startup.

### spirograph
- [ ] `[L]` `:172, 192-208` No fit-to-canvas scale; clips on phones.
- [ ] `[L]` `:282, 242-256` Fixed animation step gives polygonal curves; static rainbow mode can issue about 468k strokes per slider event.

### springs
- [ ] `[M]` `:225-228` Dragged node's old position isn't updated, so release flings it by the whole drag distance.
- [ ] `[L]` `:160-170, 108-109` Cloth is a fixed 550px wide; anchors are off-screen on phones.

### svg-path-animator
- [ ] `[M]` `:678-679` Resume treats eased progress as linear time; Play is dead after a non-loop run until Reset.
- [ ] `[M]` `:724-740, 968-980` Exports ignore easing, direction and loop; typed colour names export as `#000000` (`:873-874`).
- [ ] `[L]` `:757-773, 656` Drawing while playing fights the animation loop; a 2-point drag leaves stale code (`:780`).
- [ ] `[L]` `:979` Pasted path `d` unescaped in the downloaded SVG.

### synth
- [ ] `[M]` `:284-291` Keydown ignores modifiers and target; Cmd+letter plays a stuck note.
- [ ] `[L]` `:161` `playNote` throws if AudioContext creation failed; no `touchcancel`.

### system-info
- [ ] `[M]` `:460-461` Apple Silicon reported as Intel when the renderer string lacks "Apple M" (unverified).
- [ ] `[L]` `:512-513, 399-400, 586` Each refresh adds battery listeners and WebGL contexts; rtt 0 shows "Unknown" (`:529`); Opera/CriOS/FxiOS mislabelled (`:549-553`).

### terrain
- [ ] `[M]` `:429` `screenToGrid` never returns null, so a plain drag always sculpts and "Drag to rotate" (`:437`) is unreachable; no rotation or zoom on touch.

### text-diff
- [ ] `[M]` `:332` Above 5M LCS cells the fallback is a positional compare with no notice (one inserted line marks everything changed).
- [ ] `[L]` `:270` Empty side treated as one line; quadratic `unshift`; "No differences found!" (`:291`) unreachable.
- [ ] `[L]` `:280` Block spans followed by `\n` in a `pre-wrap` container likely double-space rows (unverified).

### time-progress
- [ ] `[M]` `:410` Last day of Spring, Summer and Fall matches no season and shows "Winter, -93 days remaining".
- [ ] `[M]` `:471` Day counts floor across DST, so they're off by one for weeks (`:424, 471, 552, 597`).
- [ ] `[L]` `:380` Unguarded `localStorage` blanks the page when storage is blocked; a tooltip sticks when the per-minute render fires.

### timer-stopwatch
- [ ] `[M]` `:431` `Notification.permission` read without checking `Notification` exists; on iOS Safari the timer end throws before the beep.
- [ ] `[L]` `:396` Editing inputs while paused updates the display, but Resume uses the old remainder.
- [ ] `[L]` `:255` Display not initialised from inputs or URL at startup; `?mode=x` hides both panels.
- [ ] `[L]` `:413` Countdown floors, so 5:00 shows 4:59 immediately.

### timezone-converter
- [ ] `[H]` `:233` A local zone outside the 18 listed sets the select to `''` and the app opens to "Invalid time zone" (also `?from=bogus`, `:218`). Add the local zone as an option or fall back.
- [ ] `[M]` `:269` Offset computed in one pass at the wrong instant; an hour off near DST transitions.
- [ ] `[M]` `:239` "Now" pairs the UTC date with the local time (also unix-timestamp `:323`, time-progress `:377`).

### turing
- [ ] `[L]` `:311` No run token: Stop then Run within 200ms doubles the speed; status stays "Running..." after Stop.

### typing-test
- [ ] `[L]` `:433` Passage is swapped the moment typing starts; passages are too short for the 2-minute mode.

### unit-converter
- [ ] `[L]` `:346` Zero displays as "0.0000e+0"; values above 99,999,999 cut to 5 significant digits.

### unix-timestamp
- [ ] `[L]` `:363` Double-clicking a result copies the literal "Copied!" and leaves it there.
- [ ] `[L]` `:290` `parseInt` accepts trailing junk ("1,704,067,200" converts as 1).

### url-encode
- [ ] `[L]` `:274` Clicking the active mode double-encodes.
- [ ] `[L]` `:206` Reference table lists `!` and `'` as encoded, but `encodeURIComponent` leaves them.

### uuid-generator
- [ ] `[L]` `:256` "Version 1" puts Unix milliseconds in the time fields, so decoders read a date in the 1580s.

### walkthrough-creator
- [ ] `[M]` `:1613` Undo is off by one: one annotation can't be undone; two are removed together.
- [ ] `[M]` `:1393` A zero-size Blur annotation makes `getImageData` throw on every later render and breaks PDF export (`:1602, 2059`).
- [ ] `[M]` `:1158` "Load Project" assigns unvalidated JSON; `step.image`, `step.number` (`:1161`) and `step.logo` (`:1258`) go into `innerHTML`.
- [ ] `[M]` `:1523` Drag preview re-decodes the image on every mousemove and is wiped by the async redraw.
- [ ] `[L]` `:1475` Select tool is a no-op; annotations can't be moved or deleted.
- [ ] `[L]` `:1068` Step-list bugs on delete and reorder (stale index, cover can't be re-added, drop indicator on the wrong side, `:1224`).
- [ ] `[L]` `:34` Below 1200px the sidebar loses its scroll, clipping Export/Save/Load (unverified).
- [ ] `[L]` `:1857` PDF logo stretched to 40x20mm; long titles not wrapped.
- [ ] `[L]` `:1297-1415, 1924-2080` Annotation drawing code exists twice (canvas and PDF).

### wfc
- [ ] `[L]` `:303` Step pauses the run and nothing resumes it except Regenerate.

### word-counter
- [ ] `[L]` `:228` Unique Words strips everything outside a-z (0 for Cyrillic or CJK).

### xml-json
- [ ] `[M]` `:267` Leaf text coerced with `Number()`: `02134` becomes 2134, big ids lose digits.
- [ ] `[L]` `:244` `<constructor>` collides with the inherited property; JSON to XML never validates names; empty arrays dropped.

### yaml-json
- [ ] `[H]` `:254` Objects in lists lose every key after the first (frame pushed with `indent + 2`, popped at `:221`). The built-in sample is wrong.
- [ ] `[H]` `:241` Lists at the same indent as their key (Kubernetes style) keep only the last item.
- [ ] `[H]` `:346` JSON to YAML flattens nesting inside array-of-objects items.
- [ ] `[M]` `:293` Inline comments not stripped; top-level lists (`:234`), `- key:` maps (`:248`) and empty keys mis-parse.
- [ ] `[M]` `:377` Emitter doesn't quote type-like strings, mis-indents block scalars (`:375`), drops empty containers.

## Reviewed with nothing to report

bezier, boids, color-picker, contrast-checker, css-glass-morphism-builder, discount-calc, fire, flowfield, lorenz, mandelbrot, maze, pdf-extract, pdf-merge, pdf-remove, pdf-reorder, percentage-calc, quadtree, text-banner, tip-calc, voronoi (repo-wide items above may still apply).
