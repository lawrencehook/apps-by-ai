(function (root) {
    'use strict';
    const KEY = 'dungeon-progress-v1';
    function read(storage) {
        try {
            const data = JSON.parse(storage.getItem(KEY));
            if (!data || data.version !== 1) return { bowLevel: 0, speedLevel: 0, coins: 0 };
            const number = (value, max) => Number.isInteger(value) && value >= 0 && value <= max ? value : 0;
            const styles = ['balanced', 'quick', 'heavy', 'piercing'];
            const unlocks = ['balanced', ...new Set(Array.isArray(data.bowUnlocks) ? data.bowUnlocks.filter(style => styles.includes(style)) : [])];
            const bow = data.bowStyle ? { bowUnlocks: [...new Set(unlocks)], bowStyle: unlocks.includes(data.bowStyle) ? data.bowStyle : 'balanced' } : {};
            const extra = {};
            if (data.multishotLevel !== undefined) extra.multishotLevel = number(data.multishotLevel, 2);
            if (data.vitalityLevel !== undefined) extra.vitalityLevel = number(data.vitalityLevel, Number.MAX_SAFE_INTEGER / 100);
            if (data.highestDepth !== undefined) extra.highestDepth = Math.max(1, number(data.highestDepth, 10000));
            return { ...extra, ...bow, bowLevel: number(data.bowLevel, Number.MAX_SAFE_INTEGER / 100), speedLevel: number(data.speedLevel, 3), coins: number(data.coins, 100000000) };
        } catch (_) { return { bowLevel: 0, speedLevel: 0, coins: 0 }; }
    }
    function write(storage, hero) {
        try { storage.setItem(KEY, JSON.stringify({ version: 1, multishotLevel: hero.multishotLevel, vitalityLevel: hero.vitalityLevel, highestDepth: hero.highestDepth, bowStyle: hero.bowStyle, bowUnlocks: hero.bowUnlocks, bowLevel: hero.bowLevel, speedLevel: hero.speedLevel, coins: hero.coins })); return true; }
        catch (_) { return false; }
    }
    function visible(map, from, to) {
        const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / 0.16));
        const tx = Math.round(to.x / 3.2), tz = Math.round(to.z / 3.2);
        for (let i = 1; i < steps; i++) {
            const t = i / steps, x = Math.round((from.x + (to.x - from.x) * t) / 3.2), z = Math.round((from.z + (to.z - from.z) * t) / 3.2);
            const y = from.y + (to.y - from.y) * t;
            if (x === tx && z === tz) continue;
            const height = map.grid.blocked?.has(`${x},${z}`) ? 3.25 : map.grid[z]?.[x] !== 0 ?
                (map.seed === 'town' ? (map.buildings?.find(b => b.cells.some(c => c[0] === x && c[1] === z))?.height ?? 1.1) : 6) : 0;
            if (height > y && !map.fences?.some(c => c[0] === x && c[1] === z)) return false;
        }
        return true;
    }
    function reveal(map, position, clearLine, view = {}) {
        if (!map.visited) map.visited = new Set();
        if (map.seed === 'town') {
            for (let z = 0; z < map.size; z++) for (let x = 0; x < map.size; x++) map.visited.add(`${x},${z}`);
            return;
        }
        const { yaw = 0, pitch = 0, fov = 68, aspect = 1, height = 1.6, range = 28 } = view;
        const cx = Math.round(position.x / 3.2), cz = Math.round(position.z / 3.2), cells = Math.ceil(range / 3.2);
        const sy = Math.sin(yaw), cy = Math.cos(yaw), sp = Math.sin(pitch), cp = Math.cos(pitch);
        const vertical = Math.tan(fov * Math.PI / 360), horizontal = vertical * aspect;
        const eye = { x: position.x, y: height, z: position.z };
        for (let z = Math.max(0, cz - cells); z <= Math.min(map.size - 1, cz + cells); z++) {
            for (let x = Math.max(0, cx - cells); x <= Math.min(map.size - 1, cx + cells); x++) {
                if (map.visited.has(`${x},${z}`)) continue;
                const dx = x * 3.2 - eye.x, dz = z * 3.2 - eye.z;
                if (Math.hypot(dx, dz) >= range) continue;
                for (const y of map.grid[z][x] || map.grid.blocked?.has(`${x},${z}`) ? [1, 3, 5] : [0.05]) {
                    const dy = y - height, forward = -sy * cp * dx + sp * dy - cy * cp * dz;
                    const right = cy * dx - sy * dz, up = sy * sp * dx + cp * dy + cy * sp * dz;
                    if (forward <= 0 || Math.abs(right) > forward * horizontal || Math.abs(up) > forward * vertical) continue;
                    const point = { x: x * 3.2, y, z: z * 3.2 };
                    if (clearLine(eye, point)) { map.visited.add(`${x},${z}`); break; }
                }
            }
        }
        map.visited.add(`${cx},${cz}`);
    }
    const api = { KEY, read, write, reveal, visible };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.DungeonProgress = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
