/* Shared town shell geometry, stair supports, and three-dimensional collision. */
(function (root) {
    'use strict';
    function build(map) {
        const boxes = [], ramps = [], floors = [], bounds = [];
        const box = (x, y, z, w, h, d, kind = 'wall', building) => boxes.push({ x, y, z, w, h, d, kind, building });
        for (const b of map.buildings) {
            const x = b.x * 3.2, z = b.z * 3.2, w = b.width * 3.2, d = b.length * 3.2;
            const x1 = x - w / 2, x2 = x + w / 2, z1 = z - d / 2, z2 = z + d / 2;
            const stories = Math.max(1, Math.floor((b.height - 0.3) / 2.8));
            bounds.push({ x1, x2, z1, z2, building: b.id });
            // Cut actual apertures into each wall; windows have no opaque backing.
            function wall(axis, fixed, lo, hi, front) {
                const holes = [];
                if (front) holes.push({ lo: z - 0.7, hi: z + 0.7, bottom: 0, top: 2.3 });
                for (let level = 0; level < stories; level++) {
                    const centers = front ? [z - 1.9, z + 1.9] : [(lo + hi) / 2];
                    for (const center of centers) holes.push({ lo: center - 0.48, hi: center + 0.48, bottom: level * 2.8 + 1.05, top: level * 2.8 + 2.15 });
                }
                const cuts = [...new Set([lo, hi, ...holes.flatMap(h => [h.lo, h.hi])])].sort((a, b) => a - b);
                for (let i = 1; i < cuts.length; i++) {
                    const a = cuts[i - 1], c = cuts[i], center = (a + c) / 2;
                    if (center < lo || center > hi) continue;
                    const spans = holes.filter(h => center > h.lo && center < h.hi).sort((a, b) => a.bottom - b.bottom);
                    let bottom = 0;
                    for (const span of [...spans, { bottom: b.height, top: b.height }]) {
                        if (span.bottom > bottom) {
                            if (axis === 'x') box(fixed, (bottom + span.bottom) / 2, center, 0.22, span.bottom - bottom, c - a, 'wall', b.id);
                            else box(center, (bottom + span.bottom) / 2, fixed, c - a, span.bottom - bottom, 0.22, 'wall', b.id);
                        }
                        bottom = Math.max(bottom, span.top);
                    }
                }
            }
            wall('x', x1, z1, z2, x > 22.4); wall('x', x2, z1, z2, x < 22.4);
            wall('z', z1, x1, x2, false); wall('z', z2, x1, x2, false);
            const stairX = x < 22.4 ? x1 + 1.65 : x2 - 1.65;
            const stairLeft = stairX - 1.4, stairRight = stairX + 1.4;
            for (let level = 1; level < stories; level++) {
                const y = level * 2.8;
                // A central floor and end landings leave a real stairwell opening.
                for (const [a, c] of [[x1 + 0.12, stairLeft], [stairRight, x2 - 0.12]]) if (c > a) box((a + c) / 2, y - 0.1, z, c - a, 0.2, d - 0.24, 'floor', b.id);
                for (const end of [z1 + 0.55, z2 - 0.55]) box(stairX, y - 0.1, end, 2.8, 0.2, 0.86, 'floor', b.id);
                const reverse = level % 2 === 0;
                const laneX = stairX + (reverse ? 0.7 : -0.7);
                const ramp = { x1: laneX - 0.7, x2: laneX + 0.7, z1: z1 + 0.98, z2: z2 - 0.98, base: y - 2.8, top: y, reverse, building: b.id };
                ramps.push(ramp);
                const count = 16, length = ramp.z2 - ramp.z1;
                for (let step = 0; step < count; step++) {
                    const t = (step + 0.5) / count;
                    box(laneX, ramp.base + (step + 1) / count * 2.8 - 0.075,
                        reverse ? ramp.z2 - t * length : ramp.z1 + t * length, 1.4, 0.15, length / count + 0.01, 'step', b.id);
                }
            }
            box(x, b.height - 0.1, z, w - 0.2, 0.2, d - 0.2, 'ceiling', b.id);
            // A narrow sideboard gives the room a purpose without blocking stairs.
            box(x < 22.4 ? x2 - 0.65 : x1 + 0.65, 0.45, z + 2, 0.7, 0.9, 1.2, 'furniture', b.id);
        }
        box(5.8 * 3.2, 0.42, 6.4 * 3.2, 2.35, 0.84, 2.35, 'fountain');
        for (const b of boxes) if (b.kind === 'floor') floors.push(b);
        return { boxes, ramps, floors, bounds };
    }
    function rampHeight(r, z) { const t = Math.max(0, Math.min(1, (z - r.z1) / (r.z2 - r.z1))); return r.base + (r.reverse ? 1 - t : t) * (r.top - r.base); }
    function support(town, x, z, feet) {
        let y = 0;
        for (const f of town.floors) if (Math.abs(x - f.x) <= f.w / 2 && Math.abs(z - f.z) <= f.d / 2 && f.y + f.h / 2 <= feet + 0.32) y = Math.max(y, f.y + f.h / 2);
        for (const r of town.ramps) if (x >= r.x1 && x <= r.x2 && z >= r.z1 && z <= r.z2) {
            const height = rampHeight(r, z);
            if (height <= feet + 0.32) y = Math.max(y, height);
        }
        return y;
    }
    function canStand(map, town, x, z, feet, radius = 0.32, height = 1.75) {
        const cx = Math.round(x / 3.2), cz = Math.round(z / 3.2);
        for (let iz = cz - 1; iz <= cz + 1; iz++) for (let ix = cx - 1; ix <= cx + 1; ix++) {
            if (map.grid[iz]?.[ix] === 0 || map.buildings.some(b => b.cells.some(c => c[0] === ix && c[1] === iz))) continue;
            const dx = Math.max(0, Math.abs(x - ix * 3.2) - 1.6), dz = Math.max(0, Math.abs(z - iz * 3.2) - 1.6);
            if (dx * dx + dz * dz < radius * radius) return false;
        }
        for (const b of town.boxes) {
            if (b.kind === 'step' || feet >= b.y + b.h / 2 - (b.kind === 'floor' ? 0.32 : 0.015) || feet + height <= b.y - b.h / 2) continue;
            const dx = Math.max(0, Math.abs(x - b.x) - b.w / 2), dz = Math.max(0, Math.abs(z - b.z) - b.d / 2);
            if (dx * dx + dz * dz < radius * radius) return false;
        }
        for (const r of town.ramps) if (x >= r.x1 && x <= r.x2 && z >= r.z1 && z <= r.z2) {
            const y = rampHeight(r, z);
            if (y > feet + 0.32 && feet + height > y - 0.2) return false;
        }
        return true;
    }
    const api = { build, support, canStand, rampHeight };
    if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TownWorld = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
