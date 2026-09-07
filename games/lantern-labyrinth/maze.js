/* Seeded maze generation and collision, shared by the game and its tests. */
(function (root) {
    'use strict';
    function random(seed) {
        let state = 2166136261;
        for (const ch of String(seed)) state = Math.imul(state ^ ch.charCodeAt(0), 16777619);
        return () => {
            state += 0x6D2B79F5;
            let t = Math.imul(state ^ state >>> 15, 1 | state);
            t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }
    const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    function paths(grid, start) {
        const queue = [start], distance = new Map([[start.join(','), 0]]), parent = new Map();
        for (let i = 0; i < queue.length; i++) {
            const [x, z] = queue[i];
            for (const [dx, dz] of directions) {
                const next = [x + dx, z + dz], key = next.join(',');
                if (grid[next[1]]?.[next[0]] === 0 && !distance.has(key)) {
                    distance.set(key, distance.get(`${x},${z}`) + 1);
                    parent.set(key, [x, z]);
                    queue.push(next);
                }
            }
        }
        return { queue, distance, parent };
    }
    function generate(size, seed) {
        if (!Number.isInteger(size) || size < 7 || size > 51 || size % 2 === 0) throw new Error('Maze size must be an odd number from 7 to 51.');
        const rng = random(seed), grid = Array.from({ length: size }, () => Array(size).fill(1));
        const start = [1, 1], stack = [start];
        grid[1][1] = 0;
        while (stack.length) {
            const [x, z] = stack[stack.length - 1];
            const available = directions.filter(([dx, dz]) => x + dx * 2 > 0 && z + dz * 2 > 0 && x + dx * 2 < size - 1 && z + dz * 2 < size - 1 && grid[z + dz * 2][x + dx * 2]);
            if (!available.length) { stack.pop(); continue; }
            const [dx, dz] = available[Math.floor(rng() * available.length)];
            grid[z + dz][x + dx] = 0;
            grid[z + dz * 2][x + dx * 2] = 0;
            stack.push([x + dx * 2, z + dz * 2]);
        }
        // Reconnect a few corridors: cycles make following one wall less reliable.
        const connectors = [];
        for (let z = 1; z < size - 1; z++) for (let x = 1; x < size - 1; x++) {
            if (grid[z][x] && ((x % 2 === 0 && z % 2 === 1 && !grid[z][x - 1] && !grid[z][x + 1]) ||
                (z % 2 === 0 && x % 2 === 1 && !grid[z - 1][x] && !grid[z + 1][x]))) connectors.push([x, z]);
        }
        for (let i = connectors.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [connectors[i], connectors[j]] = [connectors[j], connectors[i]];
        }
        for (const [x, z] of connectors.slice(0, Math.max(1, Math.floor(connectors.length * 0.12)))) grid[z][x] = 0;
        // Start in the interior, without a perimeter to orient against.
        const rooms = Math.floor(size / 2), low = Math.floor(rooms / 3), span = Math.max(1, Math.floor(rooms / 3));
        const entrance = [1 + 2 * (low + Math.floor(rng() * span)), 1 + 2 * (low + Math.floor(rng() * span))];
        const fromStart = paths(grid, entrance);
        const boundary = fromStart.queue.filter(([x, z]) => x === 1 || z === 1 || x === size - 2 || z === size - 2);
        boundary.sort((a, b) => fromStart.distance.get(b.join(',')) - fromStart.distance.get(a.join(',')));
        const end = boundary[0];
        const outward = end[0] === 1 ? [-1, 0] : end[0] === size - 2 ? [1, 0] : end[1] === 1 ? [0, -1] : [0, 1];
        const exit = [end[0] + outward[0], end[1] + outward[1]];
        grid[exit[1]][exit[0]] = 0;
        return { size, seed: String(seed), grid, start: entrance, exit, outward };
    }

    function route(grid, start, end) {
        const { parent, distance } = paths(grid, start);
        if (!distance.has(end.join(','))) return [];
        const result = [end];
        while (result[0].join(',') !== start.join(',')) result.unshift(parent.get(result[0].join(',')));
        return result;
    }
    // World centers are cell * spacing. Circle-versus-box prevents corner clipping.
    function canStand(grid, x, z, spacing = 2.4, radius = 0.3) {
        const cx = Math.round(x / spacing), cz = Math.round(z / spacing);
        for (let iz = cz - 1; iz <= cz + 1; iz++) for (let ix = cx - 1; ix <= cx + 1; ix++) {
            if (grid[iz]?.[ix] === 0 && !grid.blocked?.has(`${ix},${iz}`)) continue;
            const nx = Math.max(ix * spacing - spacing / 2, Math.min(x, ix * spacing + spacing / 2));
            const nz = Math.max(iz * spacing - spacing / 2, Math.min(z, iz * spacing + spacing / 2));
            if ((x - nx) ** 2 + (z - nz) ** 2 < radius * radius) return false;
        }
        return true;
    }
    function cameraPosition(grid, start, desired, spacing = 3.2, radius = 0.24) {
        const dx = desired.x - start.x, dz = desired.z - start.z;
        const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.04));
        let result = { x: start.x, z: start.z };
        for (let i = 1; i <= steps; i++) {
            const next = { x: start.x + dx * i / steps, z: start.z + dz * i / steps };
            if (!canStand(grid, next.x, next.z, spacing, radius)) break;
            result = next;
        }
        return result;
    }
    function dungeon(size, seed) {
        if (!Number.isInteger(size) || size < 19 || size > 51 || size % 2 === 0) throw new Error('Dungeon size must be odd, from 19 to 51.');
        const rng = random(seed + '-architecture'), grid = Array.from({ length: size }, () => Array(size).fill(1));
        const rooms = [], doors = [], fences = [], stride = Math.floor((size - 2) / 3);
        const carve = (x, z) => { if (x > 0 && z > 0 && x < size - 1 && z < size - 1) grid[z][x] = 0; };
        for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
            const jitter = () => stride >= 8 ? Math.floor(rng() * 3) - 1 : 0;
            const cx = 1 + col * stride + Math.floor(stride / 2) + jitter(), cz = 1 + row * stride + Math.floor(stride / 2) + jitter();
            const rx = Math.max(1, (stride - 3) / 2), rz = Math.max(1, (stride - 3) / 2);
            const room = { cx, cz, x1: Math.ceil(cx - rx), x2: Math.floor(cx + rx), z1: Math.ceil(cz - rz), z2: Math.floor(cz + rz), kind: 'cavern', cells: [] };
            rooms.push(room);
            const phase = rng() * Math.PI * 2;
            // Uneven, overlapping lobes rather than rectangular rooms. Each row
            // includes the central spine so the whole chamber remains connected.
            for (let z = room.z1; z <= room.z2; z++) {
                const dz = (z - cz) / (rz + 0.5);
                const width = Math.max(1, rx * Math.sqrt(1 - dz * dz));
                const shift = Math.sin(dz * 3 + phase) * rx * 0.3;
                const left = Math.max(1, Math.min(cx, Math.ceil(cx - width + shift)));
                const right = Math.min(size - 2, Math.max(cx, Math.floor(cx + width + shift)));
                for (let x = left; x <= right; x++) { carve(x, z); room.cells.push([x, z]); }
            }
            room.x1 = Math.min(...room.cells.map(c => c[0])); room.x2 = Math.max(...room.cells.map(c => c[0]));
        }
        const linked = new Set([0]), links = new Set();
        function connect(a, b) {
            const key = [a, b].sort((x, y) => x - y).join(','); if (links.has(key)) return;
            links.add(key); const first = rooms[a], second = rooms[b];
            const horizontal = Math.abs(first.cx - second.cx) > Math.abs(first.cz - second.cz);
            const from = horizontal ? [first.cx, first.cz] : [first.cz, first.cx];
            const to = horizontal ? [second.cx, second.cz] : [second.cz, second.cx];
            if (from[0] > to[0]) { const copy = [...from]; from.splice(0, 2, ...to); to.splice(0, 2, ...copy); }
            const bend = (rng() - 0.5) * 4;
            let previous = from[1];
            for (let u = from[0]; u <= to[0]; u++) {
                const t = (u - from[0]) / (to[0] - from[0]);
                const v = Math.round(from[1] + (to[1] - from[1]) * t + Math.sin(t * Math.PI) * bend);
                for (let w = Math.min(previous, v); w <= Math.max(previous, v); w++) {
                    if (horizontal) carve(u, w); else carve(w, u);
                }
                previous = v;
            }
        }

        while (linked.size < rooms.length) {
            const edges = [];
            for (const a of linked) for (const b of [a - 3, a + 3, ...(a % 3 ? [a - 1] : []), ...(a % 3 < 2 ? [a + 1] : [])]) {
                if (b >= 0 && b < 9 && !linked.has(b)) edges.push([a, b]);
            }
            const [a, b] = edges[Math.floor(rng() * edges.length)]; connect(a, b); linked.add(b);
        }
        // A few deliberate alternate routes, without the dense twists of a maze.
        for (let a = 0; a < 9; a++) {
            if (a % 3 < 2 && rng() < 0.4) connect(a, a + 1);
            if (a < 6 && rng() < 0.4) connect(a, a + 3);
        }
        // Fit doors only into actual straight necks, after all passages are carved.
        // Widely spaced doors leave the irregular chambers open for combat.
        for (let z = 2; z < size - 2; z++) for (let x = 2; x < size - 2; x++) {
            if (grid[z][x] || rooms.some(r => Math.hypot(x - r.cx, z - r.cz) < 3)) continue;
            const axis = grid[z - 1][x] && grid[z + 1][x] && !grid[z][x - 1] && !grid[z][x + 1] ? 'x'
                : grid[z][x - 1] && grid[z][x + 1] && !grid[z - 1][x] && !grid[z + 1][x] ? 'z' : null;
            if (axis && !doors.some(d => Math.hypot(d.x - x, d.z - z) < 6)) doors.push({ x, z, axis, open: false });
        }
        const start = [rooms[0].cx, rooms[0].cz], distances = paths(grid, start).distance;
        const far = rooms.reduce((best, room) => distances.get([room.cx, room.cz].join(',')) > distances.get([best.cx, best.cz].join(',')) ? room : best);
        grid.blocked = new Set(doors.map(door => `${door.x},${door.z}`));
        return { size, seed, grid, rooms, doors, fences, start, exit: [far.cx, far.cz], outward: [0, -1] };
    }
    function town() {
        const size = 15, grid = Array.from({ length: size }, (_, z) => Array.from({ length: size }, (_, x) => x === 0 || z === 0 || x === size - 1 || z === size - 1 ? 1 : 0));
        for (const [x, z] of [[2, 3], [10, 3], [2, 9], [10, 9]]) {
            for (let dz = 0; dz < 3; dz++) for (let dx = 0; dx < 3; dx++) grid[z + dz][x + dx] = 1;
        }
        return { size, seed: 'town', grid, start: [7, 10], exit: [7, 2], outward: [0, -1] };
    }
    const api = { random, generate, dungeon, town, paths, route, canStand, cameraPosition };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.MazeWorld = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
