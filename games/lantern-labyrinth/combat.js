/* Small, deterministic combat simulation; rendering and input live in game.js. */
(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) module.exports = factory(require('./maze.js'));
    else root.DungeonCombat = factory(root.MazeWorld);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Maze) {
    'use strict';
    const CELL = 3.2, SPAWN_INTERVAL = 8, AMBIENT_LIMIT = 18;
    const TIERS = {
        wanderer: { name: 'Wanderer', health: 25, damage: 7, coins: 4, speed: 1.25, radius: 0.32, height: 1.35, color: 0x788775 },
        hunter: { name: 'Hunter', health: 55, damage: 11, coins: 9, speed: 1.85, radius: 0.36, height: 1.65, color: 0x9a8165 },
        sentinel: { name: 'Sentinel', health: 90, damage: 16, coins: 16, speed: 1.05, radius: 0.43, height: 1.95, color: 0x73677f },
        guardian: { name: 'Exit guardian', health: 200, damage: 22, coins: 45, speed: 1.4, radius: 0.55, height: 2.65, color: 0x8e5144 }
    };
    const BOWS = {
        balanced: { name: 'Balanced', multiplier: 1, cooldown: 0.55, price: 0, pierce: 1 },
        quick: { name: 'Quickdraw', multiplier: 0.8, cooldown: 0.28, price: 24, pierce: 1 },
        heavy: { name: 'Longbow', multiplier: 1.6, cooldown: 0.95, price: 40, pierce: 1 },
        piercing: { name: 'Piercing', multiplier: 0.9, cooldown: 0.7, price: 60, pierce: 3 }
    };
    const cell = p => [Math.round(p.x / CELL), Math.round(p.z / CELL)];
    function cylinderHit(from, to, enemy) {
        const dx = to.x - from.x, dz = to.z - from.z, dy = to.y - from.y;
        const ox = from.x - enemy.x, oz = from.z - enemy.z, a = dx * dx + dz * dz;
        let enter = 0, leave = 1;
        if (a < 1e-10) {
            if (ox * ox + oz * oz > enemy.radius * enemy.radius) return null;
        } else {
            const b = 2 * (ox * dx + oz * dz), c = ox * ox + oz * oz - enemy.radius * enemy.radius, d = b * b - 4 * a * c;
            if (d < 0) return null;
            enter = Math.max(enter, (-b - Math.sqrt(d)) / (2 * a));
            leave = Math.min(leave, (-b + Math.sqrt(d)) / (2 * a));
        }
        if (Math.abs(dy) < 1e-10) {
            if (from.y < 0 || from.y > enemy.height) return null;
        } else {
            const t1 = -from.y / dy, t2 = (enemy.height - from.y) / dy;
            enter = Math.max(enter, Math.min(t1, t2)); leave = Math.min(leave, Math.max(t1, t2));
        }
        return enter <= leave ? enter : null;
    }
    function enemyHit(from, to, enemy) {
        const body = cylinderHit(from, to, { ...enemy, height: enemy.height * 0.72 });
        const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
        const ox = from.x - enemy.x, oy = from.y - enemy.height * 0.85, oz = from.z - enemy.z;
        const radius = enemy.height * 0.14, a = dx * dx + dy * dy + dz * dz;
        const b = 2 * (ox * dx + oy * dy + oz * dz), c = ox * ox + oy * oy + oz * oz - radius * radius;
        const discriminant = b * b - 4 * a * c;
        let head = null;
        if (c <= 0) head = 0;
        else if (a > 1e-10 && discriminant >= 0) {
            const t = (-b - Math.sqrt(discriminant)) / (2 * a);
            if (t >= 0 && t <= 1) head = t;
        }
        if (head !== null && (body === null || head <= body)) return { t: head, headshot: true };
        return body === null ? null : { t: body, headshot: false };
    }
    class Run {
        constructor(maze, depth = 1) {
            this.depth = depth;
            this.maze = maze; this.rng = Maze.random(maze.seed + '-combat');
            this.bowStyle = 'balanced'; this.bowUnlocks = ['balanced']; this.chests = [];
            this.health = 100; this.coins = 0; this.bowLevel = 0; this.speedLevel = 0; this.vitalityLevel = 0; this.multishotLevel = 0; this.highestDepth = Math.max(1, depth);
            this.enemies = []; this.arrows = []; this.events = []; this.serial = 0; this.cooldown = 0; this.spawnClock = this.spawnInterval; this.time = 0;
            if (depth === 0) { this.cells = []; return; }
            this.cells = Maze.paths(maze.grid, maze.start).queue;
            const distances = Maze.paths(maze.grid, maze.start).distance;
            const choices = this.cells.filter(c => !maze.grid.blocked?.has(c.join(',')) && distances.get(c.join(',')) >= 5 && c.join(',') !== maze.exit.join(','));
            // First encounters are nearby; stronger enemies are scattered deeper into the maze.
            for (let i = 0; i < this.enemyLimit && choices.length; i++) {
                const pool = i < 3 ? choices.filter(c => distances.get(c.join(',')) <= 12) : choices;
                if (!pool.length) continue;
                const point = pool[Math.floor(this.rng() * pool.length)];
                if (this.enemies.some(e => Math.hypot(e.x - point[0] * CELL, e.z - point[1] * CELL) < 5)) continue;
                this.spawn(i < 3 && this.depth === 1 ? 'wanderer' : this.ambientTier(), point);
            }
            for (const tier of ['wanderer', 'hunter', 'sentinel']) if (!this.enemies.some(e => e.tier === tier)) {
                const point = choices.find(c => !this.enemies.some(e => Math.hypot(e.x - c[0] * CELL, e.z - c[1] * CELL) < 5));
                if (point) this.spawn(tier, point);
            }
            this.spawn('guardian', maze.exit);
            const guardian = this.enemies.find(e => e.tier === 'guardian');
            const road = Maze.route(maze.grid, maze.exit, maze.start);
            guardian.patrol = road[Math.min(12, road.length - 1)];
            for (const room of (maze.rooms || []).filter((r, i) => i > 0 && i % 2 === 0 && (r.cx !== maze.exit[0] || r.cz !== maze.exit[1])).slice(0, 3)) {
                this.chests.push({ id: ++this.serial, x: room.cx * CELL, z: room.cz * CELL, room, state: 'closed', guarded: this.chests.length === 1, guards: [], reward: 20 + depth * 12 });
            }
        }
        ambientTier() {
            const roll = this.rng(), level = Math.max(0, this.depth - 1);
            const wanderer = Math.max(0.1, 0.55 - level * 0.045);
            const sentinel = Math.min(0.6, 0.15 + level * 0.035);
            return roll < wanderer ? 'wanderer' : roll < 1 - sentinel ? 'hunter' : 'sentinel';
        }
        get maxHealth() { return 100 + this.vitalityLevel * 20; }
        get enemyLimit() { return Math.min(30, AMBIENT_LIMIT + Math.floor(this.depth / 3)); }
        get spawnInterval() { return Math.max(3, SPAWN_INTERVAL - this.depth * 0.15); }
        get damage() { return Math.round((25 + this.bowLevel * 12) * BOWS[this.bowStyle].multiplier); }
        get speed() { return 4.4 + this.speedLevel * 0.4; }
        cost(kind) {
            if (BOWS[kind]) return this.bowUnlocks.includes(kind) ? 0 : BOWS[kind].price;
            if (kind === 'bow') return 16 * (this.bowLevel + 1);
            if (kind === 'multishot') return this.multishotLevel < 2 ? [64, 160][this.multishotLevel] : null;
            if (kind === 'vitality') return 24 * (this.vitalityLevel + 1);
            if (kind === 'speed') return this.speedLevel < 3 ? 12 * (this.speedLevel + 1) : null;
            if (kind === 'heal') return this.health < this.maxHealth && this.health > 0 ? 0 : null;
            return null;
        }
        buy(kind) {
            const cost = this.cost(kind);
            if (cost === null || this.coins < cost || this.health <= 0) return false;
            this.coins -= cost;
            if (BOWS[kind]) { if (!this.bowUnlocks.includes(kind)) this.bowUnlocks.push(kind); this.bowStyle = kind; }
            else if (kind === 'multishot') this.multishotLevel++;
            else if (kind === 'vitality') { this.vitalityLevel++; this.health += 20; }
            else if (kind === 'bow') this.bowLevel++; else if (kind === 'speed') this.speedLevel++; else this.health = this.maxHealth;
            return true;
        }
        spawn(tier, point) {
            const base = TIERS[tier], level = Math.max(0, this.depth - 1);
            const stats = { ...base, speed: base.speed * (1 + 0.35 * level / (level + 8)), health: Math.round(base.health * (1 + level * 0.6 + level * level * 0.06)),
                damage: Math.round(base.damage * (1 + level * 0.25 + level * level * 0.015)), coins: Math.round(base.coins * (1 + level * 0.5 + level * level * 0.025)) };
            if (tier === 'guardian' && this.depth % 5 === 0) { stats.health = Math.round(stats.health * 1.5); stats.coins *= 2; }
            const enemy = { id: ++this.serial, tier, ...stats, maxHealth: stats.health, x: point[0] * CELL, z: point[1] * CELL,
                chargePhase: 'idle', chargeClock: 0, chargeCooldown: 2, chargeX: 0, chargeZ: 0, stagger: 0, staggerDuration: 0, alert: 0, lastSeen: null, path: [], think: 0, attack: 0.8, flash: 0, heading: 0, returning: false, patrol: point };
            this.enemies.push(enemy); return enemy;
        }
        clearLine(from, to) {
            const n = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / 0.15));
            for (let i = 1; i < n; i++) {
                const x = from.x + (to.x - from.x) * i / n, z = from.z + (to.z - from.z) * i / n;
                if ((this.maze.grid[Math.round(z / CELL)]?.[Math.round(x / CELL)] !== 0 || this.maze.grid.blocked?.has(`${Math.round(x / CELL)},${Math.round(z / CELL)}`))) return false;
            }
            return true;
        }
        shoot(origin, direction) {
            if (this.cooldown > 0 || this.health <= 0) return false;
            this.cooldown = BOWS[this.bowStyle].cooldown;
            const count = 1 + this.multishotLevel * 2, factor = [1, 0.65, 0.5][this.multishotLevel];
            for (let i = 0; i < count; i++) {
                const angle = (i - (count - 1) / 2) * Math.PI / 30, c = Math.cos(angle), s = Math.sin(angle);
                const arrow = { id: ++this.serial, x: origin.x, y: origin.y, z: origin.z,
                    vx: (direction.x * c + direction.z * s) * 32, vy: direction.y * 32,
                    vz: (-direction.x * s + direction.z * c) * 32, life: 2.5,
                    damage: Math.max(1, Math.round(this.damage * factor)), pierce: BOWS[this.bowStyle].pierce, hitIds: new Set() };
                this.arrows.push(arrow);
            }
            this.events.push({ type: 'shot' }); return true;
        }
        hurtEnemy(enemy, damage, headshot = false) {
            if (enemy.health <= 0) return;
            enemy.health -= damage; enemy.flash = 0.18;
            enemy.chargePhase = 'idle'; enemy.chargeCooldown = 2;
            enemy.staggerDuration = { wanderer: 0.42, hunter: 0.34, sentinel: 0.24, guardian: 0.16 }[enemy.tier];
            enemy.stagger = enemy.staggerDuration;
            // An interrupted attack cannot land on the exact frame recovery ends.
            enemy.attack = Math.max(enemy.attack, enemy.stagger + 0.2);
            this.events.push({ type: 'hit', id: enemy.id, headshot });
            if (enemy.health <= 0) {
                this.coins += enemy.coins; this.health = Math.min(this.maxHealth, this.health + 3);
                this.events.push({ type: 'kill', coins: enemy.coins, tier: enemy.tier });
            }
        }
        updateArrows(dt) {
            for (const arrow of this.arrows) {
                const from = { x: arrow.x, y: arrow.y, z: arrow.z };
                const to = { x: arrow.x + arrow.vx * dt, y: arrow.y + arrow.vy * dt, z: arrow.z + arrow.vz * dt };
                arrow.vy -= 3 * dt; arrow.life -= dt;
                const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z) / 0.08));
                let wallTime = Infinity;
                for (let i = 1; i <= steps; i++) {
                    const t = i / steps, x = from.x + (to.x - from.x) * t, y = from.y + (to.y - from.y) * t, z = from.z + (to.z - from.z) * t;
                    if (y < 0 || (y < 6 && (this.maze.grid[Math.round(z / CELL)]?.[Math.round(x / CELL)] !== 0 || this.maze.grid.blocked?.has(`${Math.round(x / CELL)},${Math.round(z / CELL)}`)))) { wallTime = t; break; }
                }
                const hits = [];
                for (const enemy of this.enemies) if (enemy.health > 0 && !arrow.hitIds.has(enemy.id)) {
                    const hit = enemyHit(from, to, enemy);
                    if (hit && hit.t < wallTime) hits.push({ enemy, ...hit });
                }
                hits.sort((a, b) => a.t - b.t);
                for (const hit of hits) {
                    this.hurtEnemy(hit.enemy, arrow.damage * (hit.headshot ? 2 : 1), hit.headshot);
                    arrow.hitIds.add(hit.enemy.id);
                    if (--arrow.pierce <= 0) { arrow.life = 0; break; }
                }
                if (wallTime !== Infinity) arrow.life = 0;
                arrow.x = to.x; arrow.y = to.y; arrow.z = to.z;
            }
            this.arrows = this.arrows.filter(a => a.life > 0);
        }
        openChest(chest) {
            if (!this.chests.includes(chest) || this.health <= 0 || chest.state === 'open') return false;
            if (chest.state === 'guarded' && chest.guards.some(id => this.enemies.some(e => e.id === id && e.health > 0))) return false;
            if (chest.state === 'closed' && chest.guarded) {
                const room = chest.room;
                const corners = room.cells ? [room.cells[0], room.cells[room.cells.length - 1]] : [[room.x1, room.z1], [room.x2, room.z2]];
                for (const point of corners) {
                    const guard = this.spawn('hunter', point); guard.alert = 8;
                    chest.guards.push(guard.id);
                }
                chest.state = 'guarded'; return true;
            }
            chest.state = 'open'; this.coins += chest.reward; this.health = Math.min(this.maxHealth, this.health + 10);
            this.events.push({ type: 'treasure', coins: chest.reward }); return true;
        }
        charge(enemy, dt, player, visible, distance) {
            if (enemy.tier !== 'sentinel') return false;
            enemy.chargeCooldown = Math.max(0, enemy.chargeCooldown - dt);
            if (enemy.chargePhase === 'idle' && visible && distance > 3 && distance < 12 && enemy.chargeCooldown <= 0) {
                enemy.chargePhase = 'windup'; enemy.chargeClock = 0.75;
                enemy.chargeX = (player.x - enemy.x) / distance; enemy.chargeZ = (player.z - enemy.z) / distance;
                enemy.heading = Math.atan2(-enemy.chargeX, -enemy.chargeZ);
            }
            if (enemy.chargePhase === 'idle') return false;
            enemy.chargeClock -= dt;
            if (enemy.chargePhase === 'windup') {
                if (enemy.chargeClock <= 0) { enemy.chargePhase = 'rush'; enemy.chargeClock = 0.85; }
                return true;
            }
            if (enemy.chargePhase === 'recover') {
                if (enemy.chargeClock <= 0) { enemy.chargePhase = 'idle'; enemy.chargeCooldown = 3; }
                return true;
            }
            const recover = () => { enemy.chargePhase = 'recover'; enemy.chargeClock = 0.85; enemy.attack = 1; };
            const steps = Math.max(1, Math.ceil(dt * 9 / 0.1));
            for (let i = 0; i < steps; i++) {
                const nx = enemy.x + enemy.chargeX * dt * 9 / steps, nz = enemy.z + enemy.chargeZ * dt * 9 / steps;
                if (!Maze.canStand(this.maze.grid, nx, nz, CELL, enemy.radius)) { recover(); break; }
                enemy.x = nx; enemy.z = nz;
                if (Math.hypot(enemy.x - player.x, enemy.z - player.z) < enemy.radius + 0.5 && this.clearLine(enemy, player)) {
                    const damage = Math.round(enemy.damage * 1.5); this.health = Math.max(0, this.health - damage);
                    this.events.push({ type: 'damage', amount: damage }); recover(); break;
                }
            }
            if (enemy.chargeClock <= 0) recover();
            return true;
        }
        update(dt, player) {
            if (this.health <= 0 || this.depth === 0) return;
            this.time += dt; this.cooldown = Math.max(0, this.cooldown - dt);
            this.updateArrows(dt);
            for (const door of this.maze.doors || []) if (!door.open && this.enemies.some(e => e.health > 0 && e.stagger <= 0 && Math.hypot(e.x - door.x * CELL, e.z - door.z * CELL) < 2.6)) {
                door.open = true; this.maze.grid.blocked.delete(`${door.x},${door.z}`);
            }
            const playerCell = cell(player);
            for (const enemy of this.enemies) {
                if (enemy.health <= 0) continue;
                enemy.flash = Math.max(0, enemy.flash - dt); enemy.attack = Math.max(0, enemy.attack - dt); enemy.think -= dt;
                if (enemy.stagger > 0) {
                    enemy.stagger = Math.max(0, enemy.stagger - dt);
                    continue;
                }
                const distance = Math.hypot(enemy.x - player.x, enemy.z - player.z), visible = distance < 24 && this.clearLine(enemy, player);
                if (this.charge(enemy, dt, player, visible, distance)) continue;
                const wasAlert = enemy.alert > 0;
                enemy.alert = visible ? 8 : Math.max(0, enemy.alert - dt);
                if (visible) {
                    enemy.lastSeen = playerCell.slice();
                    if (!wasAlert) { enemy.think = 0; enemy.path = []; }
                    enemy.heading = Math.atan2(enemy.x - player.x, enemy.z - player.z);
                }
                if (wasAlert && enemy.alert === 0) { enemy.think = 0; enemy.path = []; }
                if (distance < enemy.radius + 0.95 && visible && enemy.attack <= 0) {
                    this.health = Math.max(0, this.health - enemy.damage); enemy.attack = 1.25;
                    this.events.push({ type: 'damage', amount: enemy.damage });
                }
                const nearCenter = Math.hypot(enemy.x - Math.round(enemy.x / CELL) * CELL, enemy.z - Math.round(enemy.z / CELL) * CELL) < 0.08;
                if (enemy.think <= 0 && (!enemy.path.length || nearCenter)) {
                    let goal;
                    if (enemy.alert > 0 && enemy.lastSeen) goal = enemy.lastSeen;
                    else if (enemy.tier === 'guardian') {
                        if (Math.hypot(enemy.x - enemy.patrol[0] * CELL, enemy.z - enemy.patrol[1] * CELL) < 0.2) enemy.returning = true;
                        if (Math.hypot(enemy.x - this.maze.exit[0] * CELL, enemy.z - this.maze.exit[1] * CELL) < 0.2) enemy.returning = false;
                        goal = enemy.returning ? this.maze.exit : enemy.patrol;
                    } else {
                        const nearby = Maze.paths(this.maze.grid, cell(enemy)).queue.slice(1, 9);
                        goal = nearby[Math.floor(this.rng() * nearby.length)] || cell(enemy);
                    }
                    enemy.path = Maze.route(this.maze.grid, cell(enemy), goal).slice(1); enemy.think = enemy.alert > 0 ? 0.25 : 1.5;
                }
                // In an open sightline, react immediately instead of finishing a patrol route.
                if (visible && distance > enemy.radius + 0.65) {
                    const travel = Math.min(distance - enemy.radius - 0.65, enemy.speed * dt);
                    const nx = enemy.x + (player.x - enemy.x) / distance * travel;
                    const nz = enemy.z + (player.z - enemy.z) / distance * travel;
                    if (Maze.canStand(this.maze.grid, nx, nz, CELL, enemy.radius)) {
                        enemy.x = nx; enemy.z = nz; enemy.path = []; enemy.think = 0;
                        continue;
                    }
                }
                const next = enemy.path[0];
                if (next && distance > enemy.radius + 0.65) {
                    const dx = next[0] * CELL - enemy.x, dz = next[1] * CELL - enemy.z, length = Math.hypot(dx, dz);
                    if (length < 0.04) { enemy.x = next[0] * CELL; enemy.z = next[1] * CELL; enemy.path.shift(); }
                    else {
                        const travel = Math.min(length, enemy.speed * dt), nx = enemy.x + dx / length * travel, nz = enemy.z + dz / length * travel;
                        if (Maze.canStand(this.maze.grid, nx, nz, CELL, enemy.radius)) { enemy.x = nx; enemy.z = nz; }
                        else enemy.path.unshift(cell(enemy));
                        enemy.heading = Math.atan2(-dx, -dz);
                    }
                }
            }
            this.enemies = this.enemies.filter(e => e.health > 0);
            this.spawnClock -= dt;
            if (this.spawnClock <= 0) {
                this.spawnClock = this.spawnInterval;
                if (this.enemies.filter(e => e.tier !== 'guardian').length < this.enemyLimit) {
                    const options = this.cells.filter(([x, z]) => {
                        const p = { x: x * CELL, z: z * CELL }, d = Math.hypot(p.x - player.x, p.z - player.z);
                        return !this.maze.grid.blocked?.has(`${x},${z}`) && d > 10 && d < 26 && !this.clearLine(p, player) && !this.enemies.some(e => Math.hypot(e.x - p.x, e.z - p.z) < 4);
                    });
                    if (options.length) {
                        const tier = this.ambientTier();
                        this.spawn(tier, options[Math.floor(this.rng() * options.length)]);
                    }
                }
            }
        }
        drainEvents() { return this.events.splice(0); }
    }
    return { Run, TIERS, BOWS, cylinderHit, enemyHit };
});
