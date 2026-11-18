# Development Guidelines

Rules and patterns derived from reviewing all 156 apps in this repo. Follow these when building new single-file HTML apps.

## Security

1. **Never use `innerHTML` with user input.** Use `textContent` for plain text, or sanitize with an `escapeHtml()` helper before inserting into templates. This includes filenames from file uploads, text field values, parsed file contents (CSV cells, JSON keys, pasted logs), and any string the user controls. The helper must escape quotes too, because the result often lands inside an attribute (`value="${escapeHtml(name)}"`); the older `div.textContent` → `div.innerHTML` trick leaves `"` alone and is not safe there. URLs need more than escaping: only allow `http(s):`, `mailto:`, `#` and relative targets in `href`/`src`.

```javascript
function escapeHtml(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
```

2. **Use `crypto.getRandomValues()` for passwords, UUIDs, and tokens** — never `Math.random()`. Guard against modulo bias with rejection sampling when mapping random bytes to a character set.

3. **Validate URL parameters against allowlists** before applying them as class names, state values, or CSS properties.

## Mobile & Touch

4. **Use Pointer Events for canvas interaction, not mouse events.** `pointerdown`/`pointermove`/`pointerup`/`pointerleave` fire for mouse, touch, and pen alike and expose the same `clientX`/`offsetX`/`button` properties, so one handler covers every input. Add `touch-action: none` to the interactive canvas (only the canvas — never `body` or control panels) so the browser doesn't hijack drags for scrolling. Call `canvas.setPointerCapture(e.pointerId)` in `pointerdown` if a drag must finish cleanly after leaving the canvas — but not if you rely on `pointerleave` to cancel it. Only write separate `touchstart`/`touchmove` handlers when you genuinely need multi-touch (pinch zoom).

5. **`body { overflow: hidden }` is fine for full-viewport canvas apps — but nothing else.** Most visualizations here fill the window with a canvas and correctly suppress scrollbars. The failure mode is a fixed-position control panel that grows past the viewport height and becomes unreachable. If the panel can be tall, give it `max-height` + `overflow-y: auto`, or make it `position: relative` below a small-screen breakpoint.

6. **Design responsive layouts from the start.** Use `flex-wrap`, `overflow-x: auto` on toolbars, and media queries for narrow viewports. Test that all controls are reachable at 320px width.

## Browser APIs

7. **Wrap the Clipboard API in try/catch with a fallback.** `navigator.clipboard.writeText()` fails silently in non-HTTPS contexts, iframes, and older browsers. Fall back to a hidden textarea with `document.execCommand('copy')`.

8. **Delay `URL.revokeObjectURL()` after programmatic downloads.** `a.click()` starts an async download — revoking immediately truncates it. Use `setTimeout(() => URL.revokeObjectURL(url), 1000)`.

9. **Guard all Web API usage with feature detection and try/catch.** This applies to AudioContext, WebGL, Notifications, localStorage, MediaRecorder, SpeechRecognition, and others. Show a clear error message when an API is unavailable.

## UX & Correctness

10. **Check `e.target.tagName` before handling global keyboard shortcuts.** Spacebar, Enter, and letter-key listeners fire while users are typing in form elements. Exclude `INPUT`, `SELECT`, `TEXTAREA`, and `BUTTON`.

```javascript
document.addEventListener('keydown', e => {
    if (['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(e.target.tagName)) return;
    // handle shortcut...
});
```

11. **Cancel `requestAnimationFrame` and `setInterval` on reset or state change.** Orphaned animation loops cause ghost state, resource leaks, and interfere with fresh runs.

12. **Guard against division by zero and empty inputs.** Show a placeholder like `'-'` instead of displaying `NaN` or `Infinity`. Don't default empty numeric inputs to `0` if that value is used as a denominator.

## Accessibility

13. **Always associate `<label for="">` with the input's `id`.** Add `role`, `aria-label`, and `tabindex="0"` to interactive non-form elements (clickable divs, custom controls, selectable cards).

## Performance

14. **Avoid O(n²) patterns in render loops.** Use `Map`/`Set` for lookups instead of `Array.find()` or `Array.includes()` inside inner loops. Use spatial partitioning (grids, quadtrees) for particle simulations. Cap expensive algorithms (diff, LCS) with a maximum input size and fall back to simpler methods.

## Code Quality

15. **Use `<textarea>` instead of `contentEditable` for text input.** `contentEditable` breaks paste handling (inserts HTML), loses cursor position on DOM updates, and makes highlight synchronization fragile. Use a textarea with a transparent overlay div for syntax highlighting.

## Dependencies

16. **No code from outside the repo.** Third-party scripts go in `libs/<name>-<version>/` and are referenced as `../../libs/...` — never a CDN `<script src>`, never a remote `workerSrc`. The repo must work from `file://` with the network unplugged. See `libs/README.md` for the vendoring steps; `check-syntax.js` fails on any remote script, stylesheet, worker or module import.

## Verification

17. **Run `node check-syntax.js` before every commit, and `node tools/smoketest/run.js` (after a one-time `npm install` in `tools/smoketest`) before calling an app done.** The first parses every script, rejects remote code and validates `metadata.json`; the second actually loads each page in jsdom and fails on anything thrown, rejected or logged with `console.error` at startup. Both exist because reading code is not running code: one app shipped with a `SyntaxError` (curly quotes flattened to `'''`) and another threw `TypeError` on its first frame, and both sat dead through a full read-only review that "fixed" other things in them.

18. **When reviewing a fix, re-derive it from the code — don't restore the old value because it looks more familiar.** A review pass reverted the BMI scale stops from 14/40/60 back to 18.5/25/30 because the latter are the well-known thresholds; but the marker formula maps BMI 15–40 onto 0–100%, so 14/40/60 was correct. When a change touches a number, find the formula it has to agree with and check the arithmetic; leave a comment that names the constraint so the next reader doesn't have to.

19. **Keep the `Math.max(...array)` guard proportional to the array.** Spreading a fixed-size array (histogram buckets, 12 note names, a few files) is fine and clearer. Spreading anything derived from user data or a size slider — CSV rows, prime lists, audio samples — must be a loop or `reduce`, since V8 throws past roughly 100k arguments.

25. **Run `node tools/browsertest/run.js <app>` on any app you add or change, and look at the screenshots.** It opens the app in real headless Chrome at desktop and phone size (no install needed beyond Node 22 and Chrome), fails on uncaught errors, missing local files and remote scripts, and saves `tools/browsertest/screenshots/<app>-desktop.png` and `-phone.png`. The smoke test cannot see pixels, layout, or the real vendored libraries; this can. It still loads the page without interacting, so try the controls yourself.

## State & Timing

20. **Give every async animation or step loop a run token.** A boolean `running` flag cannot tell an old loop from a new one: Reset, resize or a second click during an `await sleep()` leaves the old loop alive, and it resumes against the new state. Capture a counter when the run starts and bail out after every `await` if it has changed.

```javascript
let runId = 0;
async function run() {
    const id = ++runId;
    while (!done) {
        step();
        await sleep(delay);
        if (id !== runId) return; // reset, resize or a newer run took over
    }
}
function reset() { runId++; /* then rebuild state */ }
```

21. **Local dates come from local getters, never `toISOString()`.** `toISOString().split('T')[0]` is the UTC date, which is tomorrow or yesterday for part of every day outside UTC. Build date keys and `<input type="date">` defaults from `getFullYear()`/`getMonth()`/`getDate()`, parse `YYYY-MM-DD` with `new Date(y, m - 1, d)`, and count days between dates with `Math.round` (or `Date.UTC`) so DST days of 23 or 25 hours don't shift the result.

22. **Measure real time with the clock, not by counting callbacks.** `setInterval` and `requestAnimationFrame` are throttled in background tabs and run at the display's refresh rate. Timers store an end time and compute the remainder from `Date.now()`; simulations scale by the frame's time delta.

23. **Don't rebuild the element the user is interacting with.** Re-rendering a list with `innerHTML` from an `input`/`change`/`pointerdown` handler destroys the focused field or the element being dragged. Update the affected cell in place and re-render only on add or remove.

24. **Size and draw after showing, and keep state across resize.** A canvas measured while its panel is still `display: none` is 0x0, so unhide first. A `resize` handler should rescale or redraw what exists; regenerating the scene throws away the user's work every time a phone's URL bar hides.
