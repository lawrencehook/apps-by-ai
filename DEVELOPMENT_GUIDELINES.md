# Development Guidelines

Rules and patterns derived from reviewing all 156 apps in this repo. Follow these when building new single-file HTML apps.

## Security

1. **Never use `innerHTML` with user input.** Use `textContent` for plain text, or sanitize with an `escapeHtml()` helper before inserting into templates. This includes filenames from file uploads, text field values, and any string the user controls.

```javascript
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
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

## Verification

16. **Run `node check-syntax.js` before every commit.** It parses the inline `<script>` of every app. This is the minimum bar: one app in this repo shipped with a `SyntaxError` (curly quotes flattened to `'''`) and sat dead through a full read-only review that "fixed" four other things in it. Reading code is not running code.

17. **When reviewing a fix, re-derive it from the code — don't restore the old value because it looks more familiar.** A review pass reverted the BMI scale stops from 14/40/60 back to 18.5/25/30 because the latter are the well-known thresholds; but the marker formula maps BMI 15–40 onto 0–100%, so 14/40/60 was correct. When a change touches a number, find the formula it has to agree with and check the arithmetic; leave a comment that names the constraint so the next reader doesn't have to.

18. **Keep the `Math.max(...array)` guard proportional to the array.** Spreading a fixed-size array (histogram buckets, 12 note names, a few files) is fine and clearer. Spreading anything derived from user data or a size slider — CSV rows, prime lists, audio samples — must be a loop or `reduce`, since V8 throws past roughly 100k arguments.
