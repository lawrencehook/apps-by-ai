// Run in the document head so native controls and page colors agree on first paint.
(() => {
    const key = 'apps-by-ai-theme';
    const system = window.matchMedia?.('(prefers-color-scheme: dark)');
    const root = document.documentElement;
    let preference = 'system';
    let picker;

    function readPreference() {
        try {
            const saved = localStorage.getItem(key) ?? localStorage.getItem('countdown-theme');
            preference = ['dark', 'light'].includes(saved) ? saved : 'system';
        } catch { /* The control still works when storage is unavailable. */ }
    }

    function apply() {
        const theme = preference === 'system' ? (system?.matches ? 'dark' : 'light') : preference;
        root.dataset.theme = theme;
        root.style.colorScheme = theme;
        if (picker) picker.value = preference;
    }

    readPreference();
    apply();
    system?.addEventListener('change', apply);
    window.addEventListener('storage', event => {
        if (event.key === key || event.key === null) {
            readPreference();
            apply();
        }
    });
    window.addEventListener('pageshow', event => {
        if (event.persisted) { readPreference(); apply(); }
    });

    document.addEventListener('DOMContentLoaded', () => {
        const host = document.createElement('site-theme-control');
        const nav = document.querySelector('nav[aria-label="Site sections"], [data-site-theme-slot]');
        if (nav) nav.append(host);
        else document.body.append(host);
        const shadow = host.attachShadow({mode: 'open'});
        shadow.innerHTML = `
            <style>
                :host { display:inline-flex; align-items:center; margin-inline-start:auto; }
                :host([floating]) { position:fixed; z-index:2147483646; right:max(10px,env(safe-area-inset-right)); bottom:max(10px,env(safe-area-inset-bottom)); }
                select { font:13px/1.2 system-ui,sans-serif; cursor:pointer; border-radius:6px; padding:5px 4px; min-height:32px;
                    background:light-dark(#fafaf9,#242728); color:light-dark(#30353a,#e5e8ea); border:1px solid light-dark(#b6babc,#53585a); }
                select:focus-visible { outline:2px solid light-dark(#007871,#69d6ce); outline-offset:2px; }
                @media print { :host { display:none; } }
            </style>
            <select aria-label="Color theme" title="Color theme">
                <option value="system">◐ Auto</option><option value="light">☀ Light</option><option value="dark">☾ Dark</option>
            </select>`;
        host.toggleAttribute('floating', !nav);
        picker = shadow.querySelector('select');
        picker.value = preference;
        for (const type of ['keydown', 'keyup']) picker.addEventListener(type, event => event.stopPropagation());
        picker.addEventListener('change', () => {
            preference = picker.value;
            try { localStorage.setItem(key, preference); } catch {}
            apply();
        });
    });
})();
