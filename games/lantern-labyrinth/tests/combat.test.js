const test = require('node:test');
const assert = require('node:assert/strict');
const Maze = require('../maze.js');
const { Run } = require('../combat.js');

function arena() {
    const run = new Run(Maze.generate(31, 'combat-tests'));
    run.maze.grid = Array.from({ length: 9 }, (_, z) => Array.from({ length: 9 }, (_, x) => x === 0 || z === 0 || x === 8 || z === 8 ? 1 : 0));
    run.enemies = [];
    return run;
}

test('each run includes three ambient tiers and a guardian at the exit', () => {
    for (let seed = 0; seed < 20; seed++) {
        const maze = Maze.generate(31, String(seed)), run = new Run(maze);
        for (const tier of ['wanderer', 'hunter', 'sentinel', 'guardian']) assert.ok(run.enemies.some(e => e.tier === tier));
        const guardian = run.enemies.find(e => e.tier === 'guardian');
        assert.equal(guardian.x, maze.exit[0] * 3.2);
        assert.equal(guardian.z, maze.exit[1] * 3.2);
    }
});

test('arrows hit the nearest enemy, award coins once, and respect walls', () => {
    const run = arena(), first = run.spawn('wanderer', [3, 2]), second = run.spawn('hunter', [4, 2]);
    const origin = { x: 3.2, y: 1, z: 6.4 }, direction = { x: 1, y: 0, z: 0 };
    assert.equal(run.shoot(origin, direction), true);
    assert.equal(run.shoot(origin, direction), false);
    run.updateArrows(0.5);
    assert.ok(first.health <= 0);
    assert.equal(second.health, second.maxHealth);
    assert.equal(run.coins, 4);
    run.hurtEnemy(first, 25);
    assert.equal(run.coins, 4);
    run.cooldown = 0;
    run.maze.grid[2][3] = 1;
    run.shoot(origin, direction);
    run.updateArrows(0.5);
    assert.equal(second.health, second.maxHealth);
    assert.equal(run.arrows.length, 0);
});

test('shop enforces prices, upgrade limits and fresh-run progression', () => {
    const run = arena();
    assert.equal(run.buy('bow'), false);
    run.coins = 500;
    for (let i = 0; i < 3; i++) assert.equal(run.buy('bow'), true);
    assert.equal(run.damage, 61);
    assert.equal(run.buy('bow'), true);
    assert.equal(run.damage, 73);
    assert.equal(run.buy('speed'), true);
    assert.ok(Math.abs(run.speed - 4.8) < 1e-9);
    assert.equal(run.buy('heal'), false);
    run.health = 20;
    assert.equal(run.buy('heal'), true);
    assert.equal(run.health, 100);
    run.health = 0;
    assert.equal(run.buy('heal'), false);
    const fresh = arena();
    assert.equal(fresh.coins, 0);
    assert.equal(fresh.damage, 25);
    assert.equal(fresh.speed, 4.4);
});

test('enemies pursue and attack with a cooldown while staying in corridors', () => {
    const run = arena(), enemy = run.spawn('hunter', [2, 2]);
    const player = { x: 12.8, z: 6.4 };
    for (let i = 0; i < 180; i++) {
        run.update(1 / 60, player);
        assert.ok(Maze.canStand(run.maze.grid, enemy.x, enemy.z, 3.2, enemy.radius));
    }
    assert.ok(enemy.x > 10);
    assert.equal(run.health, 89);
    run.update(1 / 60, player);
    assert.equal(run.health, 89);
});


test('sight interrupts patrol immediately and remembers only the last visible position', () => {
    const run = arena(), enemy = run.spawn('hunter', [2, 2]);
    enemy.path = [[1, 2]]; enemy.think = 1.5;
    run.update(0.05, { x: 19.2, z: 6.4 });
    assert.ok(enemy.x > 6.4, 'turns toward the player immediately');
    assert.equal(enemy.alert, 8);
    assert.deepEqual(enemy.lastSeen, [6, 2]);
    run.maze.grid[2][4] = 1;
    run.update(0.05, { x: 19.2, z: 9.6 });
    assert.ok(enemy.alert < 8 && enemy.alert > 0);
    assert.deepEqual(enemy.lastSeen, [6, 2], 'cannot track movement through stone');
    enemy.speed = 0;
    for (let i = 0; i < 170; i++) run.update(0.05, { x: 19.2, z: 6.4 });
    assert.equal(enemy.alert, 0, 'eventually returns to patrol');
});

test('stone blocks initial detection even at close range', () => {
    const run = arena(), enemy = run.spawn('wanderer', [2, 2]);
    run.maze.grid[2][3] = 1;
    run.update(0.05, { x: 12.8, z: 6.4 });
    assert.equal(enemy.alert, 0);
    assert.equal(enemy.lastSeen, null);
});


test('deeper dungeon floors increase enemy danger and rewards', () => {
    const maze = Maze.dungeon(31, 'depth');
    const shallow = new Run(maze, 1), deep = new Run(maze, 4);
    for (const tier of ['wanderer', 'hunter', 'sentinel', 'guardian']) {
        const a = shallow.spawn(tier, maze.start), b = deep.spawn(tier, maze.start);
        assert.ok(b.health > a.health); assert.ok(b.damage > a.damage); assert.ok(b.coins > a.coins);
    }
});


test('a surviving enemy staggers on hit, cannot move or attack, then recovers', () => {
    const run = arena(), enemy = run.spawn('hunter', [2, 2]);
    enemy.attack = 0;
    run.hurtEnemy(enemy, 10);
    const player = { x: enemy.x + 0.8, z: enemy.z }, x = enemy.x;
    for (let i = 0; i < 6; i++) run.update(0.05, player);
    assert.equal(enemy.x, x); assert.equal(run.health, 100); assert.ok(enemy.stagger > 0);
    for (let i = 0; i < 7; i++) run.update(0.05, player);
    assert.equal(enemy.stagger, 0); assert.ok(run.health < 100);
    const guardian = run.spawn('guardian', [5, 5]); run.hurtEnemy(guardian, 10);
    assert.ok(guardian.stagger > 0 && guardian.stagger < enemy.staggerDuration);
});

test('headshots deal twice body damage and cannot bypass a closed door', () => {
    function fire(height, blocked = false) {
        const run = arena(), enemy = run.spawn('sentinel', [3, 2]);
        if (blocked) run.maze.grid.blocked = new Set(['2,2']);
        run.shoot({ x: 3.2, y: height * enemy.height, z: 6.4 }, { x: 1, y: 0, z: 0 });
        run.updateArrows(0.3);
        return { damage: enemy.maxHealth - enemy.health, events: run.drainEvents() };
    }
    const body = fire(0.45), head = fire(0.85);
    assert.equal(body.damage, 25); assert.equal(head.damage, 50);
    assert.ok(head.events.some(e => e.type === 'hit' && e.headshot));
    assert.equal(fire(0.85, true).damage, 0);
});

test('sentinel telegraphs a fixed-direction charge, can be dodged, and stops at walls', () => {
    const run = arena(), enemy = run.spawn('sentinel', [2, 2]); enemy.chargeCooldown = 0;
    const player = { x: 12.8, z: 6.4 };
    run.update(0.05, player); assert.equal(enemy.chargePhase, 'windup'); assert.equal(enemy.x, 6.4);
    player.z = 12.8;
    for (let i = 0; i < 17; i++) run.update(0.05, player);
    assert.equal(enemy.chargePhase, 'rush'); assert.equal(enemy.z, 6.4, 'charge does not track a dodge');
    run.maze.grid[2][4] = 1;
    for (let i = 0; i < 10; i++) run.update(0.05, player);
    assert.equal(enemy.chargePhase, 'recover'); assert.equal(run.health, 100);
    assert.ok(Maze.canStand(run.maze.grid, enemy.x, enemy.z, 3.2, enemy.radius));
    enemy.chargePhase = 'windup'; run.hurtEnemy(enemy, 10); assert.equal(enemy.chargePhase, 'idle');
});

test('treasure pays once and sealed chests require defeating their guards', () => {
    const run = new Run(Maze.dungeon(31, 'chests'));
    const plain = run.chests.find(c => !c.guarded), sealed = run.chests.find(c => c.guarded);
    assert.ok(plain && sealed);
    assert.equal(run.openChest(plain), true); const coins = run.coins;
    assert.equal(run.openChest(plain), false); assert.equal(run.coins, coins);
    assert.equal(run.openChest(sealed), true); assert.equal(run.coins, coins);
    assert.equal(run.openChest(sealed), false);
    for (const id of sealed.guards) run.hurtEnemy(run.enemies.find(e => e.id === id), 10000);
    const before = run.coins; assert.equal(run.openChest(sealed), true); assert.equal(run.coins, before + sealed.reward);
});

test('bow choices trade damage and recovery; piercing cannot pass walls or hit an enemy twice', () => {
    const run = arena(); run.coins = 200;
    assert.ok(run.buy('quick')); assert.equal(run.damage, 20);
    assert.ok(run.buy('heavy')); assert.equal(run.damage, 40);
    const paid = run.coins; assert.ok(run.buy('quick')); assert.equal(run.coins, paid, 'switching owned bows is free');
    assert.ok(run.buy('piercing'));
    const first = run.spawn('sentinel', [3, 2]), second = run.spawn('sentinel', [4, 2]), third = run.spawn('sentinel', [6, 2]);
    run.maze.grid[2][5] = 1;
    run.shoot({ x: 3.2, y: 0.6, z: 6.4 }, { x: 1, y: 0, z: 0 }); run.updateArrows(0.65);
    assert.equal(first.health, first.maxHealth - run.damage); assert.equal(second.health, second.maxHealth - run.damage);
    assert.equal(third.health, third.maxHealth); assert.equal(run.arrows.length, 0);
});

test('damage and vitality upgrades continue far beyond the old cap', () => {
    const run = arena(); run.coins = 1000000;
    for (let i = 0; i < 100; i++) { assert.ok(run.buy('bow')); assert.ok(run.buy('vitality')); }
    assert.equal(run.bowLevel, 100); assert.equal(run.damage, 1225); assert.equal(run.maxHealth, 2100);
    const next = run.cost('bow'); assert.ok(Number.isFinite(next)); assert.ok(run.buy('bow'));
});

test('multishot fires a symmetric horizontal fan on one cooldown, with reduced per-arrow damage', () => {
    const run = arena(); run.coins = 500;
    assert.ok(run.buy('multishot'));
    const origin = { x: 10, y: 1.5, z: 10 }, direction = { x: 0, y: 0.6, z: -0.8 };
    run.shoot(origin, direction); assert.equal(run.arrows.length, 3);
    assert.ok(run.arrows.every(a => a.vy === 19.2 && a.damage === 16));
    assert.ok(Math.abs(run.arrows[0].vx + run.arrows[2].vx) < 1e-10);
    assert.equal(run.arrows[1].vx, 0); assert.equal(run.shoot(origin, direction), false);
    run.arrows = []; run.cooldown = 0; assert.ok(run.buy('multishot')); run.shoot(origin, direction);
    assert.equal(run.arrows.length, 5); assert.equal(run.buy('multishot'), false);
    assert.equal(run.drainEvents().filter(e => e.type === 'shot').length, 2);
});

 test('depth scaling stays substantial beyond early floors and shifts the ambient mix', () => {
    const maze = Maze.dungeon(31, 'long-progression');
    let previous = null;
    for (const depth of [1, 5, 10, 25, 50, 100]) {
        const run = new Run(maze, depth), enemy = run.spawn('wanderer', maze.start);
        if (previous) {
            assert.ok(enemy.health > previous.health * 1.5);
            assert.ok(enemy.damage > previous.damage);
            assert.ok(enemy.coins > previous.coins);
            assert.ok(enemy.speed > previous.speed);
        }
        assert.ok(enemy.speed < 1.25 * 1.35, 'speed growth remains bounded');
        previous = enemy;
    }
    const shallow = new Run(maze, 1), deep = new Run(maze, 20);
    const count = run => Array.from({ length: 2000 }, () => run.ambientTier()).filter(t => t === 'sentinel').length;
    assert.ok(count(deep) > count(shallow) * 2);
    const floor5 = new Run(maze, 5).spawn('wanderer', maze.start);
    assert.equal(floor5.health, 109);
    assert.equal(floor5.damage, 16);
 });
