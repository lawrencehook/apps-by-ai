const assert = require('node:assert/strict');
const { test } = require('node:test');
const Maze = require('../maze.js');
const CELL = 3.2;

test('120 mazes have an interior start, loops, and exactly one reachable boundary exit', () => {
    for (const size of [25, 31, 39]) for (let seed = 0; seed < 40; seed++) {
        const maze = Maze.generate(size, `test-${seed}`), reachable = Maze.paths(maze.grid, maze.start).queue;
        const openCount = maze.grid.flat().filter(v => v === 0).length;
        assert.equal(reachable.length, openCount);
        assert.ok(maze.start.every(c => c > 1 && c < size - 2));
        const boundary = reachable.filter(([x, z]) => x === 0 || z === 0 || x === size - 1 || z === size - 1);
        assert.deepEqual(boundary, [maze.exit]);
        const route = Maze.route(maze.grid, maze.start, maze.exit);
        assert.deepEqual(route[0], maze.start); assert.deepEqual(route.at(-1), maze.exit);
        assert.ok(route.length > size, 'exit should require substantial exploration');
        for (let i = 1; i < route.length; i++) assert.equal(Math.abs(route[i][0] - route[i - 1][0]) + Math.abs(route[i][1] - route[i - 1][1]), 1);
        let edges = 0;
        for (const [x, z] of reachable) edges += Number(maze.grid[z]?.[x + 1] === 0) + Number(maze.grid[z + 1]?.[x] === 0);
        assert.ok(edges > openCount - 1, 'cycles should prevent a simple tree-shaped layout');
        assert.equal('crystals' in maze, false);
    }
});

test('same seed replays the maze and invalid sizes are rejected', () => {
    assert.deepEqual(Maze.generate(31, 'moon'), Maze.generate(31, 'moon'));
    assert.notDeepEqual(Maze.generate(31, 'moon').grid, Maze.generate(31, 'sun').grid);
    for (const size of [4, 8, 52, NaN, 15.5]) assert.throws(() => Maze.generate(size, 'x'));
});

test('all corridors are walkable while solid walls and the outside remain blocked', () => {
    for (const size of [25, 31, 39]) {
        const maze = Maze.generate(size, 'walkability');
        for (let z = 0; z < size; z++) for (let x = 0; x < size; x++) {
            assert.equal(Maze.canStand(maze.grid, x * CELL, z * CELL, CELL, 0.32), maze.grid[z][x] === 0);
            if (maze.grid[z][x]) continue;
            for (const [dx, dz] of [[1, 0], [0, 1]]) if (maze.grid[z + dz]?.[x + dx] === 0) {
                for (let i = 0; i <= 10; i++) assert.ok(Maze.canStand(maze.grid, (x + dx * i / 10) * CELL, (z + dz * i / 10) * CELL, CELL, 0.32));
            }
        }
        assert.equal(Maze.canStand(maze.grid, -10, -10, CELL), false);
    }
});

test('camera sweep stays in the same corridor and cannot cross walls or diagonal corners', () => {
    const maze = Maze.generate(31, 'camera-sweep');
    for (const [x, z] of Maze.paths(maze.grid, maze.start).queue) {
        const start = { x: x * CELL, z: z * CELL };
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
            const desired = { x: start.x + Math.sin(angle) * 2.7, z: start.z + Math.cos(angle) * 2.7 };
            const end = Maze.cameraPosition(maze.grid, start, desired, CELL, 0.24);
            assert.ok(Maze.canStand(maze.grid, end.x, end.z, CELL, 0.24));
            for (let t = 0; t <= 1; t += 0.1) assert.ok(Maze.canStand(maze.grid, start.x + (end.x - start.x) * t, start.z + (end.z - start.z) * t, CELL, 0.24));
        }
    }
});


test('dungeon chambers and stairs are connected and enclosed', () => {
    for (let seed = 0; seed < 60; seed++) {
        const map = Maze.dungeon(31, 'rooms-' + seed);
        const reachable = Maze.paths(map.grid, map.start);
        assert.ok(reachable.distance.has(map.exit.join(',')));
        assert.equal(reachable.queue.length, map.grid.flat().filter(c => c === 0).length);
        assert.ok(map.grid[0].every(c => c === 1) && map.grid[30].every(c => c === 1));
        assert.ok(map.grid.every(row => row[0] === 1 && row[30] === 1));
    }
});

test('irregular chambers stay connected at every supported size and doors fit passage necks', () => {
    for (let size = 19; size <= 51; size += 2) for (let seed = 0; seed < 12; seed++) {
        const map = Maze.dungeon(size, 'organic-' + seed);
        assert.equal(Maze.paths(map.grid, map.start).queue.length, map.grid.flat().filter(c => c === 0).length);
        for (const room of map.rooms) for (const [x, z] of room.cells) assert.equal(map.grid[z][x], 0);
        for (const d of map.doors) {
            assert.equal(map.grid[d.z][d.x], 0);
            const sides = d.axis === 'x' ? [[0, -1], [0, 1]] : [[-1, 0], [1, 0]];
            for (const [dx, dz] of sides) assert.equal(map.grid[d.z + dz][d.x + dx], 1);
        }
        assert.ok(map.grid.every(row => row[0] === 1 && row[size - 1] === 1));
        assert.ok(map.grid[0].every(Boolean) && map.grid[size - 1].every(Boolean));
    }
});
