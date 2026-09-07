const { test } = require('node:test');
const assert = require('node:assert/strict');
const Progress = require('../progress.js');
const Maze = require('../maze.js');
const { Run } = require('../combat.js');
test('saved upgrades round-trip, reset, and reject corrupt or out-of-range data', () => {
    let value = null;
    const storage = { getItem: () => value, setItem: (_, next) => { value = next; } };
    assert.deepEqual(Progress.read(storage), { bowLevel: 0, speedLevel: 0, coins: 0 });
    Progress.write(storage, { bowLevel: 2, speedLevel: 1, coins: 37 });
    assert.deepEqual(Progress.read(storage), { bowLevel: 2, speedLevel: 1, coins: 37 });
    value = '{bad'; assert.equal(Progress.read(storage).bowLevel, 0);
    value = JSON.stringify({ version: 1, bowLevel: -999, speedLevel: -1, coins: '37' });
    assert.deepEqual(Progress.read(storage), { bowLevel: 0, speedLevel: 0, coins: 0 });
    Progress.write(storage, { bowLevel: 0, speedLevel: 0, coins: 0 }); assert.equal(Progress.read(storage).coins, 0);
    assert.equal(Progress.write({ setItem() { throw Error('blocked'); } }, {}), false);
});
test('fog remembers visited cells without revealing through closed doors', () => {
    const map = Maze.dungeon(31, 'fog'), run = new Run(map), door = map.doors[0];
    const dx = door.axis === 'x' ? 1 : 0, dz = door.axis === 'z' ? 1 : 0;
    const before = { x: (door.x - dx) * 3.2, z: (door.z - dz) * 3.2 };
    const beyond = `${door.x + dx},${door.z + dz}`;
    Progress.reveal(map, before, (a, b) => run.clearLine(a, b), { yaw: Math.atan2(-dx, -dz) });
    assert.equal(map.visited.has(beyond), false);
    const seen = map.visited.size; map.grid.blocked.delete(`${door.x},${door.z}`);
    Progress.reveal(map, before, (a, b) => run.clearLine(a, b), { yaw: Math.atan2(-dx, -dz) });
    assert.ok(map.visited.has(beyond)); assert.ok(map.visited.size >= seen);
});

test('bow unlocks and equipped style survive saving; unowned styles cannot be restored', () => {
    let value;
    const storage = { getItem: () => value, setItem: (_, v) => { value = v; } };
    Progress.write(storage, { bowLevel: 1, speedLevel: 0, coins: 42, bowStyle: 'quick', bowUnlocks: ['balanced', 'quick'] });
    const saved = Progress.read(storage); assert.equal(saved.bowStyle, 'quick'); assert.ok(saved.bowUnlocks.includes('quick'));
    value = JSON.stringify({ version: 1, bowStyle: 'heavy', bowUnlocks: ['quick', 'bogus'] });
    assert.equal(Progress.read(storage).bowStyle, 'balanced'); assert.equal(Progress.read(storage).bowUnlocks.includes('bogus'), false);
});

test('exploration follows camera direction, pitch and occlusion, and remembers previous views', () => {
    const size = 15, map = { size, grid: Array.from({ length: size }, () => Array(size).fill(0)) };
    const player = { x: 7 * 3.2, z: 7 * 3.2 }, line = (a, b) => Progress.visible(map, a, b);
    Progress.reveal(map, player, line, { yaw: 0 });
    assert.ok(map.visited.has('7,4')); assert.equal(map.visited.has('7,10'), false); assert.equal(map.visited.has('10,7'), false);
    Progress.reveal(map, player, line, { yaw: Math.PI }); assert.ok(map.visited.has('7,10')); assert.ok(map.visited.has('7,4'));
    map.visited.clear(); map.grid[5][7] = 1;
    Progress.reveal(map, player, line, { yaw: 0 }); assert.ok(map.visited.has('7,5')); assert.equal(map.visited.has('7,4'), false);
    map.visited.clear(); Progress.reveal(map, player, line, { pitch: 1.3 });
    assert.equal(map.visited.has('7,10'), false); assert.equal(map.visited.has('7,4'), false);
});
