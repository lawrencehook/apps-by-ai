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
        if (picker) picker.querySelector('input[value="' + preference + '"]').checked = true;
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
        if (nav) (nav.closest('.masthead') || nav).append(host);
        else document.body.append(host);
        const shadow = host.attachShadow({mode: 'open'});
        shadow.innerHTML = `
            <style>
                :host { display:inline-flex; align-items:center; margin-inline-start:auto; }
                :host([floating]) { position:fixed; z-index:2147483646; right:max(10px,env(safe-area-inset-right)); bottom:max(10px,env(safe-area-inset-bottom)); }
                .switch { display:inline-flex; overflow:hidden; border:1px solid light-dark(#d4d4d4,#55585b);
                    border-radius:8px; background:light-dark(#f6f6f6,#26282a); color:light-dark(#666,#c4c6c8); }
                label { display:grid; position:relative; cursor:pointer; }
                input { position:absolute; width:1px; height:1px; opacity:0; }
                span { display:grid; place-items:center; width:33px; height:32px; }
                svg { width:17px; height:17px; }
                input:checked + span { background:#2862e9; color:white; }
                input:focus-visible + span { outline:2px solid currentColor; outline-offset:-4px; }
                @media print { :host { display:none; } }
            </style>
            <div class="switch" role="radiogroup" aria-label="Color theme">
                <label title="Use device theme"><input type="radio" name="theme" value="system" aria-label="Use device theme">
                    <span><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4">
                        <rect x="2" y="4" width="20" height="14" rx="1.6"/><path d="M12 18v3m-5 0h10"/>
                    </svg></span></label>
                <label title="Light theme"><input type="radio" name="theme" value="light" aria-label="Light theme">
                    <span><svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="12" r="5"/><path fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>
                    </svg></span></label>
                <label title="Dark theme"><input type="radio" name="theme" value="dark" aria-label="Dark theme">
                    <span><svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.9 13.1a9.1 9.1 0 0 1-10-11A9.5 9.5 0 1 0 21.9 12a7 7 0 0 1-1 1.1Z"/>
                    </svg></span></label>
            </div>`;
        host.toggleAttribute('floating', !nav);
        picker = shadow.querySelector('.switch');
        apply();
        for (const type of ['keydown', 'keyup']) picker.addEventListener(type, event => event.stopPropagation());
        picker.addEventListener('change', event => {
            preference = event.target.value;
            try { localStorage.setItem(key, preference); } catch {}
            apply();
        });
    });
})();
