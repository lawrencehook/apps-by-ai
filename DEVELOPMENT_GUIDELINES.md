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

4. **Always add touch event handlers alongside mouse handlers.** Any `mousedown`/`mousemove`/`mouseup` interaction needs matching `touchstart`/`touchmove`/`touchend` listeners with `{ passive: false }` and `e.preventDefault()` to suppress scroll interference.

5. **Avoid `overflow: hidden` on body.** It clips controls on small screens. Use `overflow-x: hidden` if you only need to suppress horizontal scroll, or add responsive breakpoints that reflow the layout.

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
