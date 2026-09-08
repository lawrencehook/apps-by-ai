const { test } = require('node:test');
const assert = require('node:assert/strict');
const Maze = require('../maze.js');
const Town = require('../town.js');
const Progress = require('../progress.js');
test('town is completely revealed even with no sightline', () => {
    const map = Maze.town(); Progress.reveal(map, { x: 0, z: 0 }, () => false);
    assert.equal(map.visited.size, map.size ** 2);
});
test('every building has a walkable doorway, solid walls and real window openings', () => {
    const map = Maze.town(), town = Town.build(map);
    for (const b of map.buildings) {
        const x = (b.x + (b.x < 7 ? 1 : -1) * b.width / 2) * 3.2, z = b.z * 3.2;
        assert.ok(Town.canStand(map, town, x, z, 0), b.id + ' entrance');
        assert.equal(Town.canStand(map, town, x, z + 1.1, 0), false, b.id + ' wall');
        assert.ok(Town.canStand(map, town, x, z + 1.9, 1.2, 0.05, 0.4), b.id + ' window');
        assert.equal(Town.canStand(map, town, x, z + 1.9, 0), false, 'sill blocks walking through');
    }
});
test('stair flights support continuous ascent and descent with standing headroom', () => {
    const map = Maze.town(), town = Town.build(map);
    assert.ok(town.ramps.length >= 4);
    for (const r of town.ramps) {
        const x = (r.x1 + r.x2) / 2;
        for (const backwards of [false, true]) {
            let feet = backwards ? r.top : r.base;
            for (let i = 0; i <= 100; i++) {
                const t = backwards ? 1 - i / 100 : i / 100;
                const z = r.reverse ? r.z2 - t * (r.z2 - r.z1) : r.z1 + t * (r.z2 - r.z1);
                const y = Town.support(town, x, z, feet);
                assert.ok(Math.abs(y - (r.base + t * 2.8)) < 0.001, r.building + ' support');
                assert.ok(Town.canStand(map, town, x, z, y), r.building + ' stair headroom');
                feet = y;
            }
        }
    }
});
