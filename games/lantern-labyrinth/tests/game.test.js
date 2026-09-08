// Real Three.js scene geometry and raycasting; only GPU and browser audio are stubbed.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');
const THREE = require('../../../libs/three-0.128.0/three.min.js');
const root = path.resolve(__dirname, '..');

function openGame({ webgl = true, town = false, saved = null } = {}) {
    const errors = [], vc = new VirtualConsole();
    vc.on('jsdomError', e => errors.push(e));
    if (webgl) vc.on('error', (...args) => errors.push(args));
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
    const dom = new JSDOM(html, { url: 'http://localhost/games/lantern-labyrinth/', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc });
    const window = dom.window;
    window.HTMLCanvasElement.prototype.getContext = () => ({ fillRect() {}, beginPath() {}, arc() {}, fill() {}, save() {}, restore() {}, rect() {}, clip() {}, moveTo() {}, lineTo() {}, closePath() {}, stroke() {}, translate() {}, rotate() {}, fillText() {} });
    if (saved) window.localStorage.setItem('dungeon-progress-v1', JSON.stringify(saved));
    let frame = null;
    window.requestAnimationFrame = cb => { frame = cb; return 1; };
    window.cancelAnimationFrame = () => { frame = null; };
    window.HTMLElement.prototype.setPointerCapture = () => {};
    window.matchMedia = query => ({ matches: query.includes('prefers-reduced-motion') });
    let locked = null;
    Object.defineProperty(window.document, 'pointerLockElement', { get: () => locked });
    window.document.getElementById('world').requestPointerLock = () => { locked = window.document.getElementById('world'); window.document.dispatchEvent(new window.Event('pointerlockchange')); return Promise.resolve(); };
    window.document.exitPointerLock = () => { locked = null; window.document.dispatchEvent(new window.Event('pointerlockchange')); };
    window.THREE = { ...THREE, WebGLRenderer: class {
        constructor() { if (!webgl) throw new Error('WebGL disabled'); }
        setPixelRatio() {} setSize() {} render(scene, camera) { scene.updateMatrixWorld(); camera.updateMatrixWorld(); }
    } };
    window.eval(fs.readFileSync(path.join(root, 'maze.js'), 'utf8'));
    window.eval(fs.readFileSync(path.join(root, 'town.js'), 'utf8'));
    window.eval(fs.readFileSync(path.join(root, 'combat.js'), 'utf8'));
    window.eval(fs.readFileSync(path.join(root, 'progress.js'), 'utf8'));
    const source = fs.readFileSync(path.join(root, 'game.js'), 'utf8').replace('let depth = 0,', `let depth = ${town ? 0 : 1},`);
    // Test-only access; production exposes no debug, route, or teleport controls.
    window.eval(source.replace('\n})();', `
    window.gameTest = { start, move, pause, newMaze, travel, fastTravel, spray, jump, shoot, animateBow, openShop, die, syncCombat, clearInput, createMaze, updateCamera, position,
        setHeading(angle) { yaw = angle; avatar.rotation.y = angle; updateCamera(0); },
        get state() { return { groundHeight, townWorld, depth, phase, maze, keys, camera, walls, marks, avatar, world, wallTextures, jumpHeight, verticalSpeed, combat, bow, weaponRig, leftArm, rightArm, bowString }; } };
})();`));
    window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
    return { dom, window, api: window.gameTest, errors, tick: now => frame?.(now) };
}
function press(game, code, type = 'keydown') {
    game.window.document.getElementById('world').dispatchEvent(new game.window.KeyboardEvent(type, { code, key: code, bubbles: true, cancelable: true }));
}
function walkRoute(game, route) {
    for (const target of route.slice(1)) {
        const dx = target[0] * 3.2 - game.api.position.x, dz = target[1] * 3.2 - game.api.position.z;
        game.api.setHeading(Math.atan2(-dx, -dz)); press(game, 'KeyW');
        let distance = Math.hypot(dx, dz), iterations = 0;
        while (distance > 0.001 && game.api.state.phase === 'playing') {
            const door = game.api.state.maze.doors?.find(d => !d.open && Math.hypot(d.x * 3.2 - game.api.position.x, d.z * 3.2 - game.api.position.z) < 3);
            if (door) game.api.travel();
            game.api.move(Math.min(0.04, distance / game.api.state.combat.speed)); game.api.updateCamera(0);
            distance = Math.hypot(target[0] * 3.2 - game.api.position.x, target[1] * 3.2 - game.api.position.z);
            assert.ok(++iterations < 90, 'movement must not get stuck inside a corridor');
        }
        press(game, 'KeyW', 'keyup');
    }
}
function faceWall(game, reach = true) {
    const { api, window } = game;
    // Find an open cell with a wall on one side and a long clear corridor on another.
    for (const [x, z] of window.MazeWorld.paths(api.state.maze.grid, api.state.maze.start).queue) {
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const grid = api.state.maze.grid;
            if (grid.blocked?.has(`${x},${z}`) || api.state.maze.fences?.some(c => c[0] === x + dx && c[1] === z + dz)) continue;
            if (reach ? grid[z + dz]?.[x + dx] === 1 : grid[z + dz]?.[x + dx] === 0 && grid[z + dz * 2]?.[x + dx * 2] === 0) {
                api.position.x = x * 3.2; api.position.z = z * 3.2; api.setHeading(Math.atan2(-dx, -dz));
                return [x, z, dx, dz];
            }
        }
    }
    throw new Error('Test maze lacks suitable corridor');
}

test('play, pause, resume, complete the maze by walking, and generate a fresh maze', () => {
    const game = openGame(), { api, window } = game;
    try {
        assert.equal(api.state.phase, 'ready');
        api.createMaze(31, 'integration-walk'); window.document.getElementById('play').click();
        assert.equal(api.state.phase, 'playing');
        assert.equal(window.document.querySelector('#map, #hint, #stars, #timer'), null);
        press(game, 'Escape'); assert.equal(api.state.phase, 'paused');
        const pausedPosition = { ...api.position }; press(game, 'KeyW'); api.move(0.05);
        assert.deepEqual({ ...api.position }, pausedPosition);
        window.document.getElementById('play').click(); assert.equal(api.state.phase, 'playing');
        const maze = api.state.maze;
        walkRoute(game, window.MazeWorld.route(maze.grid, maze.start, maze.exit));
        press(game, 'KeyF'); assert.equal(api.state.depth, 2);
         assert.equal(api.state.phase, 'playing');
        assert.equal(api.state.maze.size, 31); assert.equal(api.state.marks.size, 0);
        assert.deepEqual(game.errors, []);
    } finally { game.dom.window.close(); }
});

test('captured mouse aims in first person; A/D strafe and Shift does not alter speed', () => {
    const game = openGame(), { api, window } = game;
    try {
        api.start(); api.setHeading(0);
        assert.equal(window.document.pointerLockElement.id, 'world');
        assert.equal(api.state.avatar.visible, false);
        assert.equal(api.state.camera.position.x, api.position.x);
        assert.equal(api.state.camera.position.z, api.position.z);
        assert.equal(api.state.camera.position.y, 1.6);
        // Choose a cell with an open eastward corridor.
        const grid = api.state.maze.grid;
        const cell = window.MazeWorld.paths(grid, api.state.maze.start).queue.find(([x, z]) => grid[z]?.[x + 1] === 0);
        api.position.x = cell[0] * 3.2; api.position.z = cell[1] * 3.2;
        const x = api.position.x, z = api.position.z;
        press(game, 'KeyD'); api.move(0.1); api.updateCamera(0); press(game, 'KeyD', 'keyup');
        assert.ok(Math.abs(api.position.x - x - 0.44) < 1e-8);
        assert.equal(api.position.z, z); assert.equal(api.state.avatar.rotation.y, 0);
        press(game, 'KeyA'); press(game, 'ShiftLeft'); api.move(0.1); api.clearInput();
        assert.ok(Math.abs(api.position.x - x) < 1e-8, 'Shift must not enable sprint');
        const oldNow = window.performance.now.bind(window.performance); window.performance.now = () => oldNow() + 200;
        window.document.dispatchEvent(new window.Event('mousemove'));
        const event = new window.Event('mousemove'); Object.assign(event, { movementX: 100, movementY: -50 }); window.document.dispatchEvent(event);
        assert.ok(Math.abs(api.state.avatar.rotation.y + 0.24) < 1e-8);
        assert.ok(api.state.camera.getWorldDirection(new THREE.Vector3()).y > 0, 'mouse aims upward');
        window.document.exitPointerLock(); assert.equal(api.state.phase, 'paused');
        assert.equal(api.state.keys.size, 0);
    } finally { game.dom.window.close(); }
});

test('camera stays clear of opaque walls at tight corners, across all headings', () => {
    const game = openGame(), { api, window } = game;
    try {
        api.start();
        const maze = api.state.maze, cells = window.MazeWorld.paths(maze.grid, maze.start).queue.filter(c => !maze.grid.blocked?.has(c.join(',')));
        for (let i = 0; i < cells.length; i += 7) for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
            api.position.x = cells[i][0] * 3.2; api.position.z = cells[i][1] * 3.2;
            api.setHeading(angle);
            const cam = api.state.camera.position;
            assert.ok(window.MazeWorld.canStand(maze.grid, cam.x, cam.z, 3.2, 0.24));
        }
        for (const wall of api.state.walls) { assert.equal(wall.material.transparent, false); assert.equal(wall.material.opacity, 1); }
        assert.equal(new Set(api.state.walls.filter(w => w.material.map).map(w => w.material.map)).size, 3);
    } finally { game.dom.window.close(); }
});

test('spray paints the facing wall, stays on that face, and cannot paint through another wall', () => {
    const game = openGame(), { api, window } = game;
    try {
        api.start(); const [x, z, dx, dz] = faceWall(game);
        window.document.getElementById('spray').click();
        assert.equal(api.state.marks.size, 1); assert.equal(window.document.activeElement.id, 'world');
        const decal = [...api.state.marks.values()][0], n = new THREE.Vector3(0, 0, 1).applyQuaternion(decal.quaternion);
        assert.ok(n.dot(new THREE.Vector3(-dx, 0, -dz)) > 0.99);
        assert.ok(Math.abs(decal.position.x - (x * 3.2 + dx * (1.6 - 0.012))) < 0.001);
        assert.ok(Math.abs(decal.position.z - (z * 3.2 + dz * (1.6 - 0.012))) < 0.001);
        assert.equal(decal.material.depthTest, true);
        assert.ok(decal.material.map.image.data.some((v, i) => i % 4 === 3 && v > 100));
        assert.ok(decal.material.map.image.data.some((v, i) => i % 4 === 3 && v === 0));
        press(game, 'KeyT'); assert.equal(api.state.marks.size, 1, 'repeated spray does not stack decals');
        api.pause(); assert.equal(api.spray(), false); assert.equal(api.state.marks.size, 1);
        api.start(); faceWall(game, false); assert.equal(api.spray(), false, 'out-of-reach surfaces are not marked');
        assert.equal(api.state.marks.size, 1);
        api.newMaze(); assert.equal(api.state.marks.size, 0, 'marks reset with a new maze');
        assert.deepEqual(game.errors, []);
    } finally { game.dom.window.close(); }
});

test('faster baseline movement cannot cross a solid wall', () => {
    const game = openGame(), { api, window } = game;
    try {
        api.start(); const [x, z] = faceWall(game); press(game, 'KeyW'); press(game, 'ShiftLeft');
        for (let i = 0; i < 100; i++) api.move(0.05);
        assert.ok(Math.hypot(api.position.x - x * 3.2, api.position.z - z * 3.2) <= 1.6 - 0.32 + 1e-6);
        assert.ok(window.MazeWorld.canStand(api.state.maze.grid, api.position.x, api.position.z, 3.2, 0.32));
    } finally { game.dom.window.close(); }
});

test('touch cancellation and blur clear movement; WebGL failure is visible', () => {
    const game = openGame();
    try {
        game.api.start(); const doc = game.window.document, joystick = doc.getElementById('joystick');
        joystick.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 });
        for (const type of ['pointerdown', 'pointercancel']) {
            const event = new game.window.Event(type, { bubbles: true, cancelable: true }); Object.assign(event, { pointerId: 7, clientX: 80, clientY: 50 }); joystick.dispatchEvent(event);
        }
        assert.equal(doc.getElementById('stick').style.transform, '');
        game.window.dispatchEvent(new game.window.Event('blur')); assert.equal(game.api.state.phase, 'paused');
    } finally { game.dom.window.close(); }
    const failed = openGame({ webgl: false });
    try { assert.equal(failed.api.state.phase, 'error'); assert.equal(failed.window.document.getElementById('error').classList.contains('hidden'), false); }
    finally { failed.dom.window.close(); }
});


test('Space jumps, T sprays, landing is stable, and jumping cannot cross walls', () => {
    const game = openGame(), { api, window } = game;
    try {
        api.start(); const [x, z] = faceWall(game);
        press(game, 'Space');
        assert.ok(api.state.verticalSpeed > 0);
        assert.equal(api.state.marks.size, 0, 'Space must not spray');
        api.move(0.05); assert.ok(api.state.avatar.position.y > 0);
        assert.equal(api.jump(), false, 'cannot double jump');
        press(game, 'KeyT'); assert.equal(api.state.marks.size, 1, 'T sprays while airborne');
        const height = api.state.jumpHeight;
        api.pause(); api.move(0.1); assert.equal(api.state.jumpHeight, height);
        assert.equal(api.jump(), false, 'cannot jump while paused');
        api.start(); press(game, 'KeyW'); press(game, 'ShiftLeft');
        for (let i = 0; i < 30; i++) { api.move(0.05); api.updateCamera(0); }
        assert.equal(api.state.jumpHeight, 0); assert.equal(api.state.verticalSpeed, 0);
        assert.equal(api.state.avatar.position.y, 0);
        assert.ok(Math.hypot(api.position.x - x * 3.2, api.position.z - z * 3.2) <= 1.6 - 0.32 + 1e-6);
        api.clearInput(); window.document.getElementById('jump').click();
        assert.ok(api.state.verticalSpeed > 0, 'touch jump button works');
        api.move(0.1); api.newMaze(); assert.equal(api.state.jumpHeight, 0); assert.equal(api.state.verticalSpeed, 0);
        assert.deepEqual(game.errors, []);
    } finally { game.dom.window.close(); }
});


test('shop pauses combat, spends earned coins, and releases and recaptures the mouse', () => {
    const game = openGame({ town: true }), { api, window } = game;
    try {
        api.start(); api.state.combat.coins = 40;
        api.position.x = 4.5 * 3.2 + 2; api.position.z = 4 * 3.2;
        press(game, 'KeyB'); assert.equal(api.state.phase, 'shop'); assert.equal(window.document.pointerLockElement, null);
        const health = api.state.combat.health; game.tick(window.performance.now() + 1000);
        assert.equal(api.state.combat.health, health);
        window.document.getElementById('buyBow').click(); assert.equal(api.state.combat.bowLevel, 1); assert.equal(api.state.combat.coins, 24);
        window.document.getElementById('closeShop').click(); api.openShop('outfitter');
        window.document.getElementById('buySpeed').click(); assert.equal(api.state.combat.speedLevel, 1); assert.equal(api.state.combat.coins, 12);
        window.document.getElementById('closeShop').click(); assert.equal(api.state.phase, 'playing'); assert.equal(window.document.pointerLockElement.id, 'world');
        api.newMaze(); assert.equal(api.state.combat.coins, 12); assert.equal(api.state.combat.bowLevel, 1); assert.equal(api.state.combat.speedLevel, 1);
        assert.equal(api.state.combat.health, 100);
    } finally { game.dom.window.close(); }
});

test('arrows originate at the character bow, and the death screen starts a clean run', () => {
    const game = openGame(), { api, window } = game;
    try {
        api.start(); faceWall(game, false); api.state.combat.enemies = []; api.syncCombat();
        assert.ok(api.shoot());
        assert.equal(api.state.combat.arrows.length, 0, 'arrow waits for the draw');
        assert.equal(api.shoot(), false, 'cannot overlap draws');
        api.animateBow(0.1);
        assert.equal(api.state.combat.arrows.length, 0);
        api.pause(); api.animateBow(1);
        assert.equal(api.state.combat.arrows.length, 0, 'pause freezes the draw');
        api.start(); api.animateBow(0.09);
        assert.equal(api.state.combat.arrows.length, 1, 'release fires exactly once');
        api.animateBow(0.1);
        assert.equal(api.state.combat.arrows.length, 1);
        const arrow = api.state.combat.arrows[0];
        assert.ok(Math.hypot(arrow.x - api.position.x, arrow.z - api.position.z) < 0.85);
        assert.equal(api.state.bow.parent, api.state.weaponRig);
        const rest = api.state.bow.localToWorld(new THREE.Vector3(0, 0, -0.13));
        assert.ok(arrow.y > 1.25 && arrow.y < 1.3, 'projectile starts at raised bow height');
        api.state.combat.health = 0; game.tick(window.performance.now() + 100);
        assert.equal(api.state.phase, 'dead'); assert.equal(window.document.pointerLockElement, null);
        window.document.getElementById('play').click(); assert.equal(api.state.phase, 'playing'); assert.equal(api.state.combat.health, 100);
        assert.deepEqual(game.errors, []);
    } finally { game.dom.window.close(); }
});


test('release hand holds back while the string snaps forward', () => {
    const game = openGame(), { api } = game;
    try {
        api.start(); api.shoot(); api.animateBow(0.17);
        const drawnZ = api.state.rightArm.userData.hand.position.z;
        const anchor = api.state.rightArm.userData.hand.position.clone().add(api.state.rightArm.position);
        assert.ok(anchor.x > -0.3 && anchor.x < -0.15);
        assert.ok(anchor.y > 1.2 && anchor.y < 1.35, 'drawing hand stays below the view center');
        assert.ok(anchor.z < -0.2 && anchor.z > -0.5, 'hand stays in front of the camera');
        const grip = api.state.leftArm.userData.hand.position.clone().add(api.state.leftArm.position);
        assert.ok(grip.z < -0.5 && grip.y > 1.2, 'bow arm extends forward at shoulder height');
        api.animateBow(0.05);
        const releasedZ = api.state.rightArm.userData.hand.position.z;
        assert.ok(releasedZ >= drawnZ - 0.01, 'hand does not follow the string forward');
        assert.ok(api.state.bowString.geometry.attributes.position.getZ(1) < 0.3);
        api.animateBow(0.3);
        assert.ok(api.state.rightArm.userData.hand.position.distanceTo(api.state.rightArm.userData.restHand) < 1e-6);
    } finally { game.dom.window.close(); }
});


test('town is safe; stairs preserve progression and cleared floors; defeat recovers in town', () => {
    const game = openGame({ town: true }), { api, window } = game;
    try {
        api.start(); assert.equal(api.state.depth, 0);
        const townRun = api.state.combat;
        for (let i = 0; i < 100; i++) townRun.update(1, api.position);
        assert.equal(townRun.enemies.length, 0); assert.equal(townRun.health, 100);
        assert.equal(api.shoot(), false);
        townRun.coins = 80; townRun.bowLevel = 1;
        const exit = api.state.maze.exit; api.position.x = exit[0] * 3.2; api.position.z = exit[1] * 3.2;
        api.travel(); assert.equal(api.state.phase, 'shop'); assert.equal(window.document.getElementById('shopTitle').textContent, 'Waygate');
        api.fastTravel(1); assert.equal(api.state.depth, 1); assert.equal(api.state.combat.coins, 80);
        api.openShop(); assert.equal(api.state.phase, 'playing', 'no shop underground');
        const floor = api.state.combat; floor.enemies = []; floor.health = 40;
        api.travel(); assert.equal(api.state.depth, 0); assert.equal(api.state.combat.health, 40);
        api.openShop('inn'); window.document.getElementById('buyHeal').click(); window.document.getElementById('closeShop').click(); assert.equal(api.state.combat.health, 100);
        api.position.x = api.state.maze.exit[0] * 3.2; api.position.z = api.state.maze.exit[1] * 3.2;
        api.travel(); api.fastTravel(1); assert.equal(api.state.combat, floor); assert.equal(floor.enemies.length, 0);
        api.position.x = api.state.maze.exit[0] * 3.2; api.position.z = api.state.maze.exit[1] * 3.2;
        api.travel(); assert.equal(api.state.depth, 2); assert.equal(api.state.combat.bowLevel, 1);
        api.state.combat.health = 0; api.die(); api.start();
        assert.equal(api.state.depth, 0); assert.equal(api.state.combat.coins, 60); assert.equal(api.state.combat.bowLevel, 1);
    } finally { game.dom.window.close(); }
});

test('M pauses for the explored map; reset requires confirmation and updates saved upgrades', () => {
    const game = openGame({ town: true }), { api, window } = game;
    window.HTMLCanvasElement.prototype.getContext = () => ({ fillRect() {}, beginPath() {}, arc() {}, fill() {}, save() {}, restore() {}, rect() {}, clip() {}, moveTo() {}, lineTo() {}, closePath() {}, stroke() {}, translate() {}, rotate() {}, fillText() {} });
    try {
        api.start(); press(game, 'KeyM'); assert.equal(api.state.phase, 'map');
        assert.equal(window.document.pointerLockElement, null);
        assert.equal(api.state.maze.visited.size, api.state.maze.size ** 2);
        press(game, 'KeyM'); assert.equal(api.state.phase, 'playing');
        api.state.combat.coins = 40; api.openShop(); window.document.getElementById('buyBow').click();
        assert.equal(JSON.parse(window.localStorage.getItem('dungeon-progress-v1')).bowLevel, 1);
        window.document.getElementById('closeShop').click(); api.pause();
        window.confirm = () => false; window.document.getElementById('resetProgress').click();
        assert.equal(api.state.combat.bowLevel, 1);
        window.confirm = () => true; window.document.getElementById('resetProgress').click();
        assert.equal(api.state.combat.bowLevel, 0); assert.equal(api.state.combat.coins, 0);
        assert.equal(JSON.parse(window.localStorage.getItem('dungeon-progress-v1')).bowLevel, 0);
    } finally { game.dom.window.close(); }
});


test('saved upgrades and coins load into a fresh town session', () => {
    const game = openGame({ town: true, saved: { version: 1, bowLevel: 2, speedLevel: 1, coins: 91 } });
    try {
        assert.equal(game.api.state.combat.bowLevel, 2); assert.equal(game.api.state.combat.speedLevel, 1);
        assert.equal(game.api.state.combat.coins, 91); assert.equal(game.api.state.depth, 0);
    } finally { game.dom.window.close(); }
});

test('door interaction opens collision and cannot close on the player', () => {
    const game = openGame(), { api, window } = game;
    try {
        api.start(); const door = api.state.maze.doors[0];
        api.position.x = door.x * 3.2 - (door.axis === 'x' ? 2.5 : 0);
        api.position.z = door.z * 3.2 - (door.axis === 'z' ? 2.5 : 0);
        assert.equal(window.MazeWorld.canStand(api.state.maze.grid, door.x * 3.2, door.z * 3.2, 3.2), false);
        api.travel(); assert.equal(door.open, true);
        assert.equal(window.MazeWorld.canStand(api.state.maze.grid, door.x * 3.2, door.z * 3.2, 3.2), true);
        api.position.x = door.x * 3.2; api.position.z = door.z * 3.2; api.travel(); assert.equal(door.open, true);
    } finally { game.dom.window.close(); }
});


test('closing the map ignores mouse recapture displacement but resumes normal aiming', () => {
    const game = openGame({ town: true }), { api, window } = game;
    try {
        let now = 1000; window.performance.now = () => now;
        api.start(); api.setHeading(0.8); press(game, 'KeyM');
        window.document.getElementById('closeMap').click();
        const heading = api.state.camera.rotation.y, pitch = api.state.camera.rotation.x;
        const mouse = (x, y) => { const event = new window.Event('mousemove'); Object.assign(event, { movementX: x, movementY: y }); window.document.dispatchEvent(event); };
        mouse(600, -400); assert.equal(api.state.camera.rotation.y, heading); assert.equal(api.state.camera.rotation.x, pitch);
        now += 130; mouse(10, 0); assert.ok(Math.abs(api.state.camera.rotation.y - (heading - 0.024)) < 1e-8);
    } finally { game.dom.window.close(); }
});

test('checkpoints unlock every five floors and survive defeat and fresh sessions', () => {
    const game = openGame({ town: true, saved: { version: 1, bowLevel: 12, vitalityLevel: 4, highestDepth: 11, coins: 200 } }), { api } = game;
    try {
        api.start(); assert.equal(api.state.combat.damage, 169); assert.equal(api.state.combat.maxHealth, 180);
        api.openShop('waygate'); assert.equal(api.fastTravel(15), false); assert.equal(api.fastTravel(7), false);
        assert.equal(api.fastTravel(10), true); assert.equal(api.state.depth, 10);
        api.state.combat.health = 0; api.die(); api.start(); assert.equal(api.state.depth, 0);
        api.openShop('waygate'); assert.equal(api.fastTravel(10), true);
        assert.equal(api.state.combat.highestDepth, 11);
    } finally { game.dom.window.close(); }
});

test('a delayed cursor warp after map closure never changes heading', () => {
    const game = openGame({ town: true }), { api, window } = game;
    try {
        let now = 1000; window.performance.now = () => now;
        api.start(); api.setHeading(1.2); press(game, 'KeyM'); press(game, 'KeyM');
        const heading = api.state.camera.rotation.y;
        const move = (x, y, dx) => { const event = new window.MouseEvent('mousemove', { clientX: x, clientY: y }); Object.defineProperty(event, 'movementX', { value: dx }); Object.defineProperty(event, 'movementY', { value: 0 }); window.document.dispatchEvent(event); };
        now += 500; move(200, 500, 800); assert.equal(api.state.camera.rotation.y, heading);
        now += 500; move(500, 300, 300); assert.equal(api.state.camera.rotation.y, heading);
        move(500, 300, 10); assert.ok(Math.abs(api.state.camera.rotation.y - (heading - 0.024)) < 1e-8);
    } finally { game.dom.window.close(); }
});

test('town movement climbs stairs, supports the upper floor, and returns downstairs', () => {
    const game = openGame({ town: true });
    try {
        const { api } = game; api.start();
        const r = api.state.townWorld.ramps.find(r => r.building === 'inn');
        api.position.x = (r.x1 + r.x2) / 2; api.position.z = r.z1 - 0.15;
        api.setHeading(Math.PI); press(game, 'KeyW');
        for (let i = 0; i < Math.ceil((r.z2 - r.z1 + 0.45) / (4.4 * 0.02)); i++) api.move(0.02);
        press(game, 'KeyW', 'keyup'); api.updateCamera(0);
        assert.ok(Math.abs(api.state.groundHeight - 2.8) < 0.05);
        assert.ok(Math.abs(api.state.camera.position.y - 4.4) < 0.05);
        api.setHeading(0); press(game, 'KeyW');
        for (let i = 0; i < Math.ceil((r.z2 - r.z1 + 0.65) / (4.4 * 0.02)); i++) api.move(0.02);
        press(game, 'KeyW', 'keyup');
        assert.ok(api.state.groundHeight < 0.05);
        assert.deepEqual(game.errors, []);
    } finally { game.dom.window.close(); }
});
