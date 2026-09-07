/* First-person dungeon prototype. Local assets; no minimap or automatic route hints. */
(function () {
    'use strict';
    const $ = id => document.getElementById(id);
    const CELL = 3.2, WALL_HEIGHT = 6, PLAYER_RADIUS = 0.32, CAMERA_RADIUS = 0.24, SIZE = 31, MOVE_SPEED = 4.4;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const position = { x: 0, z: 0 };
    const keys = new Set();
    let scene, renderer, camera, world, avatar, light, leftLeg, rightLeg, leftArm, rightArm, walls;
    let depth = 0, deepest = 1, shopService = 'bowyer';
    const services = [
        { id: 'bowyer', name: 'Bowyer', x: 3, z: 4, color: 0x87613a },
        { id: 'outfitter', name: 'Outfitter', x: 11, z: 4, color: 0x5c7758 },
        { id: 'inn', name: 'Inn', x: 3, z: 10, color: 0x9d804e },
        { id: 'waygate', name: 'Waygate', x: 11, z: 10, color: 0x577d8f }
    ];
    let savedSignature = "", exploredCell = "", minimapClock = 0, nextRevealAt = 0;
    const floors = new Map();
    let maze, phase = 'ready', yaw = 0, pitch = 0, walked = 0, frameId = 0, lastTime = 0, disposed = false;
    let stick = { x: 0, y: 0 }, joystickPointer = null, orbitPointer = null, orbitX = 0, orbitY = 0;
    let wasLocked = false, lockReleasedAt = -Infinity, lockLookReadyAt = 0, lockPointerAnchor = null;
    let weaponRig;
    let shotClock = -1, bowString, nockedArrow, mantleMesh;
    let strideBlend = 0, landing = 0;
    let combat, bow, shootHeld = false, hitTime = 0, hurtTime = 0;
    let doorObjects = [], chestObjects = [];
    let enemyObjects = new Map(), arrowObjects = new Map();
    const touchDevice = window.matchMedia?.('(pointer: coarse)').matches || false;
    let wallTextures, floorTexture, paintTexture, paintMaterial, paintGeometry;
    let marks = new Map(), paintFeedback = 0;
    let jumpHeight = 0, verticalSpeed = 0;
    let enemyAudio = null;
    let audio = null, wind = null, windGain = null, stepBuffer = null, lastStep = 0;

    function fail(message) {
        phase = 'error'; clearInput(); releaseMouse(); cancelAnimationFrame(frameId);
        $('errorText').textContent = message; $('error').classList.remove('hidden');
        $('menu').classList.add('hidden'); $('pause').classList.add('hidden'); $('spray').classList.add('hidden'); $('touchControls').classList.add('hidden');
    }
    function randomSeed() {
        return window.crypto?.getRandomValues ? crypto.getRandomValues(new Uint32Array(1))[0].toString(36) : Date.now().toString(36);
    }
    function mesh(geometry, material, parent, x = 0, y = 0, z = 0) {
        const object = new THREE.Mesh(geometry, material);
        object.position.set(x, y, z); object.castShadow = true; object.receiveShadow = true;
        parent.add(object); return object;
    }
    function concrete(seed, floor = false, variant = 0) {
        // Repeating, low-contrast weathered stone, generated without image downloads.
        const rng = MazeWorld.random(seed), size = 128, data = new Uint8Array(size * size * 3);
        for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
            const courses = variant === 1 ? [0, 20, 44, 64, 84, 108, 128] : variant === 2 ? [0, 38, 64, 102, 128] : [0, 32, 64, 96, 128];
            const row = courses.findIndex((edge, i) => i < courses.length - 1 && y >= edge && y < courses[i + 1]);
            const blockWidth = variant === 1 ? 48 : variant === 2 ? 85 : 64;
            const joint = (x + (row % 2) * blockWidth / 2 + (variant === 2 ? row * 9 : 0)) % blockWidth;
            const seam = floor ? (x < 1 || y < 1) : (y - courses[row] < 2 || joint < 2);
            const shade = Math.floor((floor ? 150 : 190) + (rng() - 0.5) * 24 + Math.sin(x * 0.17 + y * 0.12) * 5 - (seam ? 27 : 0));
            const offset = (y * size + x) * 3;
            const damp = !floor && variant === 2 ? Math.max(0, 22 - y * 0.32 + Math.sin(x * 0.09) * 8) : 0;
            data[offset] = shade - 3 - damp; data[offset + 1] = shade - damp * 0.6; data[offset + 2] = shade - 8 - damp;
        }
        const texture = new THREE.DataTexture(data, size, size, THREE.RGBFormat);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipMapLinearFilter;
        texture.generateMipmaps = true; texture.needsUpdate = true;
        return texture;
    }
    function init() {
        if (!window.THREE || !window.MazeWorld || !window.DungeonCombat) return fail('Game files could not load. Reload to try again.');
        try {
            renderer = new THREE.WebGLRenderer({ canvas: $('world'), antialias: true, powerPreference: 'high-performance' });
            renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
            renderer.outputEncoding = THREE.sRGBEncoding;
            renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
            scene = new THREE.Scene(); scene.background = new THREE.Color(0x687173);
            scene.fog = new THREE.Fog(0x687173, 10, 36);
            camera = new THREE.PerspectiveCamera(68, 1, 0.06, 80);
            scene.add(new THREE.HemisphereLight(0xc2c6c8, 0x50504d, 0.68));
            const overhead = new THREE.DirectionalLight(0xc6c9c8, 0.55); overhead.position.set(3, 12, 5); scene.add(overhead);
            // A small pool of neutral light preserves legibility without revealing distant corridors.
            light = new THREE.PointLight(0xd3cebc, 0.6, 10, 1.2); scene.add(light);
            wallTextures = [0, 1, 2].map(i => concrete('wall-' + i, false, i)); floorTexture = concrete('floor', true);
            createPaint();
            createPlayer(); createBow();
            weaponRig = new THREE.Group(); weaponRig.position.y = -1.6;
            scene.add(camera); camera.add(weaponRig);
            weaponRig.add(leftArm, rightArm, bow); avatar.visible = false;
            createMaze(SIZE, randomSeed()); resize(); bindControls();
            lastTime = performance.now(); frameId = requestAnimationFrame(frame);
        } catch (error) {
            console.error('Maze initialization failed:', error);
            fail('WebGL is required. Enable hardware acceleration in your browser, then reload.');
        }
    }
    function createPlayer() {
        avatar = new THREE.Group(); avatar.name = 'Weathered ranger'; scene.add(avatar);
        const cloth = new THREE.MeshStandardMaterial({ color: 0x53594c, roughness: 1 });
        const edging = new THREE.MeshStandardMaterial({ color: 0x777767, roughness: 1 });
        const dark = new THREE.MeshStandardMaterial({ color: 0x292d29, roughness: 1 });
        const leather = new THREE.MeshStandardMaterial({ color: 0x493c30, roughness: 0.94 });
        const skin = new THREE.MeshStandardMaterial({ color: 0x998577, roughness: 1 });
        const iron = new THREE.MeshStandardMaterial({ color: 0x79776b, roughness: 0.68, metalness: 0.45 });
        function ellipsoid(parent, material, x, y, z, sx, sy, sz) {
            const part = mesh(new THREE.SphereGeometry(1, 12, 10), material, parent, x, y, z);
            part.scale.set(sx, sy, sz); return part;
        }
        function segment(parent, material, from, to, top, bottom) {
            const start = new THREE.Vector3(...from), end = new THREE.Vector3(...to), delta = end.clone().sub(start);
            const part = mesh(new THREE.CylinderGeometry(top, bottom, delta.length(), 10), material, parent);
            part.position.copy(start.add(end).multiplyScalar(0.5));
            part.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
            return part;
        }
        // Tapered layers give the torso shoulders and a waist without a box silhouette.
        const tunic = mesh(new THREE.CylinderGeometry(0.255, 0.19, 0.51, 12), cloth, avatar, 0, 1.09, 0);
        tunic.scale.z = 0.64;
        ellipsoid(avatar, dark, 0, 0.76, 0, 0.19, 0.15, 0.135);
        const hem = mesh(new THREE.CylinderGeometry(0.19, 0.245, 0.23, 12, 1, true), cloth, avatar, 0, 0.76, 0);
        hem.scale.z = 0.7;
        const belt = mesh(new THREE.CylinderGeometry(0.199, 0.203, 0.065, 12), leather, avatar, 0, 0.91, 0);
        belt.scale.z = 0.7;
        mesh(new THREE.BoxGeometry(0.07, 0.055, 0.025), iron, avatar, 0, 0.91, -0.145);
        ellipsoid(avatar, leather, -0.205, 0.83, 0.025, 0.075, 0.1, 0.065);
        mesh(new THREE.BoxGeometry(0.115, 0.045, 0.11), leather, avatar, -0.205, 0.91, 0.025);

        // A close hood frames a recessed face; the back remains recognizable in third person.
        ellipsoid(avatar, skin, 0, 1.53, -0.035, 0.117, 0.155, 0.112);
        const hood = mesh(new THREE.SphereGeometry(1, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.77), cloth, avatar, 0, 1.56, 0.008);
        hood.scale.set(0.17, 0.2, 0.16); hood.rotation.x = Math.PI / 2;
        ellipsoid(avatar, dark, 0, 1.565, -0.139, 0.107, 0.1, 0.015);
        ellipsoid(avatar, skin, 0, 1.495, -0.133, 0.078, 0.066, 0.032);
        ellipsoid(avatar, skin, 0, 1.535, -0.163, 0.024, 0.034, 0.028);
        const collar = mesh(new THREE.TorusGeometry(0.105, 0.044, 6, 16), dark, avatar, 0, 1.37, 0);
        collar.rotation.x = Math.PI / 2;
        // Short, irregular shoulder mantle with an open front and a weathered hem.
        const mantleGeometry = new THREE.CylinderGeometry(0.12, 0.325, 0.32, 16, 3, true, 0.48, Math.PI * 2 - 0.96);
        const vertices = mantleGeometry.attributes.position;
        for (let i = 0; i < vertices.count; i++) {
            vertices.setZ(i, vertices.getZ(i) * 0.66);
            if (vertices.getY(i) < -0.15) vertices.setY(i, vertices.getY(i) + Math.sin(i * 2.7) * 0.018);
        }
        mantleGeometry.computeVertexNormals();
        const mantleMaterial = cloth.clone(); mantleMaterial.side = THREE.DoubleSide;
        const mantle = mesh(mantleGeometry, mantleMaterial, avatar, 0, 1.22, 0.018); mantle.rotation.y = Math.PI; mantleMesh = mantle;
        mesh(new THREE.SphereGeometry(0.024, 8, 6), iron, avatar, -0.12, 1.31, -0.13);

        function leg(x) {
            const joint = new THREE.Group(); joint.position.set(x, 0.73, 0); avatar.add(joint);
            segment(joint, dark, [0, -0.02, 0], [0, -0.32, 0.015], 0.073, 0.087);
            const knee = new THREE.Group(); knee.position.set(0, -0.32, 0.015); joint.add(knee); joint.userData.knee = knee;
            ellipsoid(knee, leather, 0, 0, -0.045, 0.074, 0.077, 0.056);
            segment(knee, leather, [0, -0.03, 0], [0, -0.3, -0.015], 0.064, 0.079);
            ellipsoid(knee, leather, 0, -0.345, -0.057, 0.079, 0.065, 0.135);
            mesh(new THREE.BoxGeometry(0.15, 0.025, 0.245), dark, knee, 0, -0.4, -0.055);
            for (const y of [-0.09, -0.23]) {
                const strap = mesh(new THREE.CylinderGeometry(0.078, 0.078, 0.026, 10), edging, knee, 0, y, 0);
                strap.scale.z = 0.92;
            }
            return joint;
        }
        leftLeg = leg(-0.105); rightLeg = leg(0.105);
        function arm(x, bowHand) {
            const joint = new THREE.Group(); joint.position.set(x, 1.3, 0); avatar.add(joint);
            const elbow = [0, -0.23, bowHand ? -0.06 : 0.015];
            const hand = [bowHand ? -Math.sign(x) * 0.095 : Math.sign(x) * 0.025, bowHand ? -0.27 : -0.46, bowHand ? -0.335 : -0.085];
            ellipsoid(joint, cloth, 0, -0.045, 0, 0.088, 0.11, 0.09);
            joint.userData.upper = segment(joint, cloth, [0, -0.06, 0], elbow, 0.064, 0.077);
            joint.userData.lower = segment(joint, leather, elbow, hand, 0.049, 0.064);
            joint.userData.hand = ellipsoid(joint, leather, ...hand, 0.051, 0.061, 0.049);
            joint.userData.restHand = new THREE.Vector3(...hand);
            joint.userData.restElbow = new THREE.Vector3(...elbow);
            return joint;
        }
        leftArm = arm(-0.28, true); rightArm = arm(0.28, false);
        // Diagonal back strap and a real bundle of arrows are visible from the chase camera.
        const backStrap = mesh(new THREE.BoxGeometry(0.055, 0.57, 0.018), leather, avatar, 0, 1.14, 0.165);
        backStrap.rotation.z = -Math.PI / 4;
        const quiver = new THREE.Group(); avatar.add(quiver); quiver.position.set(-0.09, 1.08, 0.205); quiver.rotation.z = -0.28;
        mesh(new THREE.CylinderGeometry(0.075, 0.055, 0.4, 10), leather, quiver);
        const rim = mesh(new THREE.TorusGeometry(0.074, 0.012, 5, 10), edging, quiver, 0, 0.2, 0); rim.rotation.x = Math.PI / 2;
        for (let i = 0; i < 5; i++) {
            const x = Math.cos(i * 2.4) * 0.043, z = Math.sin(i * 2.4) * 0.043, y = 0.29 + i % 3 * 0.028;
            mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.31, 5), edging, quiver, x, y, z);
            for (let j = 0; j < 2; j++) {
                const feather = mesh(new THREE.BoxGeometry(0.04, 0.068, 0.004), dark, quiver, x, y + 0.105, z);
                feather.rotation.y = j * Math.PI / 2;
            }
        }
    }
    function clearWorld() {
        if (!world) return;
        scene.remove(world);
        const geometries = new Set(), materials = new Set();
        world.traverse(object => { object.userData.disposableTexture?.dispose(); if (object.geometry) geometries.add(object.geometry); if (object.material) materials.add(object.material); });
        geometries.forEach(g => { if (g !== paintGeometry) g.dispose(); });
        materials.forEach(m => { if (m !== paintMaterial) m.dispose(); });
    }
    function createMaze(size, seed) {
        enemyAudio?.silence();
        clearWorld(); marks = new Map(); paintFeedback = 0; resetPaintButton();
        const hero = combat ? { coins: combat.coins, multishotLevel: combat.multishotLevel, vitalityLevel: combat.vitalityLevel, highestDepth: combat.highestDepth, bowStyle: combat.bowStyle, bowUnlocks: [...combat.bowUnlocks], bowLevel: combat.bowLevel, speedLevel: combat.speedLevel, health: combat.health } : null;
        const saved = floors.get(depth);
        maze = depth === 0 ? MazeWorld.town() : saved ? saved.maze : MazeWorld.dungeon(size, seed);
        size = maze.size;
        combat = depth > 0 && saved ? saved.combat : new DungeonCombat.Run(maze, depth);
        if (hero) Object.assign(combat, hero);
        else { try { Object.assign(combat, DungeonProgress.read(localStorage)); } catch (_) {} }
        exploredCell = ''; nextRevealAt = 0;
        if (!hero) combat.health = combat.maxHealth;
        combat.highestDepth = Math.max(combat.highestDepth || 1, depth);
        deepest = combat.highestDepth;
        if (depth > 0) floors.set(depth, { maze, combat });
        combat.arrows = []; combat.cooldown = 0;
        scene.background.setHex(depth === 0 ? 0x929e9d : 0x303638);
        scene.fog.color.copy(scene.background); scene.fog.near = depth === 0 ? 65 : 8; scene.fog.far = depth === 0 ? 250 : 30;
        camera.far = depth === 0 ? 400 : 80; camera.updateProjectionMatrix(); enemyObjects = new Map(); arrowObjects = new Map(); hitTime = 0; hurtTime = 0;
        strideBlend = 0; landing = 0; shotClock = -1; if (bow) poseBow(0, false);
        walked = 0; lastStep = 0; jumpHeight = 0; verticalSpeed = 0;
        world = new THREE.Group(); scene.add(world);
        position.x = maze.start[0] * CELL; position.z = maze.start[1] * CELL;
        const rng = MazeWorld.random(seed + '-surface');
        const fenceCells = new Set((maze.fences || []).map(c => c.join(',')));
        const groups = [[], [], []];
        for (let z = 0; z < size; z++) for (let x = 0; x < size; x++) if (maze.grid[z][x] && !fenceCells.has(`${x},${z}`)) {
            // Related courses in each small area, with distinct stone shapes and weathering.
            const region = MazeWorld.random(`${seed}-stone-${Math.floor(x / 4)}-${Math.floor(z / 4)}`);
            groups[Math.floor(region() * groups.length)].push([x, z]);
        }
        const geometry = new THREE.BoxGeometry(CELL, WALL_HEIGHT, CELL);
        walls = groups.map((cells, variant) => {
            const wallMaterial = new THREE.MeshStandardMaterial({ color: depth === 0 ? 0xaaa693 : 0x74766a, roughness: 1,
                map: wallTextures[variant], bumpMap: wallTextures[variant], bumpScale: variant === 2 ? 0.13 : 0.08 });
            const batch = new THREE.InstancedMesh(geometry, wallMaterial, cells.length);
            const matrix = new THREE.Matrix4(), color = new THREE.Color();
            cells.forEach(([x, z], index) => {
                const height = depth === 0 && (x === 0 || z === 0 || x === size - 1 || z === size - 1) ? 1.1 : WALL_HEIGHT;
                matrix.makeScale(1, height / WALL_HEIGHT, 1); matrix.setPosition(x * CELL, height / 2, z * CELL); batch.setMatrixAt(index, matrix);
                color.setScalar(0.87 + rng() * 0.13); batch.setColorAt(index, color);
            });
            batch.instanceMatrix.needsUpdate = true;
            if (batch.instanceColor) batch.instanceColor.needsUpdate = true;
            batch.userData.cells = cells; world.add(batch); return batch;
        });
        doorObjects = [];
        const timber = new THREE.MeshStandardMaterial({ color: 0x58412a, roughness: 0.94 });
        const metal = new THREE.MeshStandardMaterial({ color: 0x343933, roughness: 0.65, metalness: 0.5 });
        const trim = new THREE.MeshStandardMaterial({ color: 0x53584d, roughness: 1 });
        for (const door of maze.doors || []) {
            const frameGroup = new THREE.Group(); world.add(frameGroup); frameGroup.position.set(door.x * CELL, 0, door.z * CELL);
            frameGroup.rotation.y = door.axis === 'x' ? Math.PI / 2 : 0;
            for (const x of [-1.46, 1.46]) mesh(new THREE.BoxGeometry(0.28, 3.5, 0.5), trim, frameGroup, x, 1.75, 0);
            mesh(new THREE.BoxGeometry(3.2, 0.3, 0.5), trim, frameGroup, 0, 3.5, 0);
            const hinge = new THREE.Group(); frameGroup.add(hinge); hinge.position.x = -1.32;
            const leaf = mesh(new THREE.BoxGeometry(2.64, 3.25, 0.17), timber, hinge, 1.32, 1.625, 0);
            for (const y of [0.5, 2.7]) mesh(new THREE.BoxGeometry(2.62, 0.12, 0.21), metal, hinge, 1.32, y, 0);
            mesh(new THREE.SphereGeometry(0.065, 8, 6), metal, hinge, 2.38, 1.45, 0.16);
            doorObjects.push({ door, hinge, leaf });
            if (!door.open) walls.push(leaf);
            hinge.rotation.y = door.open ? -Math.PI / 2 : 0;
        }
        for (const [x, z] of maze.fences || []) {
            const fence = new THREE.Group(); world.add(fence); fence.position.set(x * CELL, 0, z * CELL);
            for (let i = 0; i < 9; i++) mesh(new THREE.CylinderGeometry(0.055, 0.055, 3.8, 6), metal, fence, -1.6 + i * 0.4, 1.9, 0);
            for (const y of [0.3, 3.4]) mesh(new THREE.BoxGeometry(CELL, 0.1, 0.12), metal, fence, 0, y, 0);
            // A collision/picking panel gives bars a consistent solid-barrier rule for arrows.
            const panel = mesh(new THREE.BoxGeometry(CELL, WALL_HEIGHT, 0.12), new THREE.MeshBasicMaterial({ visible: false }), fence, 0, WALL_HEIGHT / 2, 0);
            walls.push(panel);
        }
        for (const room of maze.rooms || []) {
            if (room.kind === 'cavern') continue;
            for (const [x, z] of [[room.x1, room.z1], [room.x2, room.z1], [room.x1, room.z2], [room.x2, room.z2]]) {
                // Shallow wall-mounted ribs keep the room floor unobstructed.
                mesh(new THREE.BoxGeometry(0.28, WALL_HEIGHT, 0.28), trim, world, (x + (x === room.x1 ? -0.44 : 0.44)) * CELL, WALL_HEIGHT / 2, (z + (z === room.z1 ? -0.44 : 0.44)) * CELL);
            }
        }
        const extent = size * CELL, center = (size - 1) * CELL / 2;
        if (depth > 0) mesh(new THREE.BoxGeometry(extent, 0.2, extent), new THREE.MeshStandardMaterial({ color: 0x464a43, roughness: 1, map: wallTextures[1] }), world, center, WALL_HEIGHT + 0.1, center);
        if (depth === 0) createTownLandscape(center);
        floorTexture.repeat.set(size, size);
        mesh(new THREE.BoxGeometry(extent, 0.2, extent), new THREE.MeshStandardMaterial({ color: 0x777668, roughness: 1, map: floorTexture, bumpMap: floorTexture, bumpScale: 0.035 }), world, center, -0.1, center);
        const exit = new THREE.Group(); exit.position.set(maze.exit[0] * CELL, 0, maze.exit[1] * CELL); world.add(exit);
        if (maze.outward[0]) exit.rotation.y = Math.PI / 2;
        const frame = new THREE.MeshStandardMaterial({ color: 0x5e6255, roughness: 1 });
        for (const x of [-1.25, 1.25]) mesh(new THREE.BoxGeometry(0.22, 3.1, 0.4), frame, exit, x, 1.55, 0);
        mesh(new THREE.BoxGeometry(2.72, 0.2, 0.4), frame, exit, 0, 3.2, 0);
        // Dark stairwell and shallow steps make the descent a physical landmark.
        mesh(new THREE.BoxGeometry(2.3, 3.0, 0.1), new THREE.MeshStandardMaterial({ color: 0x151919 }), exit, 0, 1.5, -0.2);
        for (let i = 0; i < 5; i++) mesh(new THREE.BoxGeometry(2.2, 0.1 + i * 0.1, 0.35), frame, exit, 0, 0.05 + i * 0.05, 1.4 - i * 0.35);
        if (depth > 0) {
            const entry = new THREE.Group(); world.add(entry); entry.position.set(maze.start[0] * CELL, 0, maze.start[1] * CELL);
            if (depth % 5 === 0) {
                const rune = new THREE.MeshStandardMaterial({ color: 0x6aa9ac, emissive: 0x315b65, emissiveIntensity: 0.7 });
                const ring = mesh(new THREE.TorusGeometry(1.35, 0.06, 6, 40), rune, entry, 0, 0.05, 0); ring.rotation.x = Math.PI / 2;
                for (const x of [-1.45, 1.45]) mesh(new THREE.BoxGeometry(0.15, 2.6, 0.15), rune, entry, x, 1.3, -0.8);
            }

            for (let i = 0; i < 5; i++) mesh(new THREE.BoxGeometry(1.8, 0.12 + i * 0.16, 0.3), frame, entry, 0, 0.06 + i * 0.08, -0.5 - i * 0.3);
            mesh(new THREE.BoxGeometry(1.8, 0.05, 1.8), new THREE.MeshStandardMaterial({ color: 0xb7ac88 }), entry, 0, 0.03, 0);
        } else {
            const roof = new THREE.MeshStandardMaterial({ color: 0x49433b, roughness: 1 });
            for (const service of services) {
                const { x, z } = service;
                const top = mesh(new THREE.ConeGeometry(7, 2.5, 4), roof, world, x * CELL, 7.25, z * CELL); top.rotation.y = Math.PI / 4;
                const inward = x < 7 ? 1 : -1, faceX = (x + inward * 1.5) * CELL + inward * 0.02;
                mesh(new THREE.BoxGeometry(0.12, 2.2, 1.2), new THREE.MeshStandardMaterial({ color: 0x47382c }), world, faceX, 1.1, z * CELL);
                const windowMaterial = new THREE.MeshStandardMaterial({ color: 0xc4a26a, emissive: 0x8a582a, emissiveIntensity: 0.3 });
                for (const offset of [-2.4, 2.4]) mesh(new THREE.BoxGeometry(0.14, 1.1, 0.85), windowMaterial, world, faceX, 3.3, z * CELL + offset);
                const awning = mesh(new THREE.BoxGeometry(1.5, 0.12, 2.4), new THREE.MeshStandardMaterial({ color: service.color, roughness: 1 }), world, faceX + inward * 0.65, 2.7, z * CELL); awning.rotation.z = inward * -0.15;
                const signCanvas = document.createElement('canvas'); signCanvas.width = 256; signCanvas.height = 64;
                const ctx = signCanvas.getContext('2d');
                if (ctx) {
                    ctx.fillStyle = '#292c26'; ctx.fillRect(0, 0, 256, 64); ctx.fillStyle = '#e1d9ba'; ctx.font = '32px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(service.name, 128, 32);
                    const texture = new THREE.CanvasTexture(signCanvas); texture.encoding = THREE.sRGBEncoding;
                    const sign = mesh(new THREE.PlaneGeometry(2.8, 0.7), new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }), world, faceX + inward * 0.03, 3.5, z * CELL);
                    sign.rotation.y = inward * Math.PI / 2; sign.userData.disposableTexture = texture;
                }


                mesh(new THREE.BoxGeometry(1.2, 2.2, 0.12), new THREE.MeshStandardMaterial({ color: 0x684f35 }), world, x * CELL, 1.1, (z + 1.5) * CELL + 0.02);
            }
            const stone = new THREE.MeshStandardMaterial({ color: 0x777b70 });
            mesh(new THREE.CylinderGeometry(1.1, 1.2, 0.8, 16), stone, world, 7 * CELL, -0.37, 7 * CELL);
            mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.04, 16), new THREE.MeshStandardMaterial({ color: 0x566e70, roughness: 0.25 }), world, 7 * CELL, 0.035, 7 * CELL);
        }
        chestObjects = [];
        for (const chest of combat.chests) {
            const group = new THREE.Group(); world.add(group); group.position.set(chest.x, 0, chest.z);
            const wood = new THREE.MeshStandardMaterial({ color: chest.guarded ? 0x655068 : 0x74512c, roughness: 0.9 });
            mesh(new THREE.BoxGeometry(1.15, 0.62, 0.75), wood, group, 0, 0.31, 0);
            const lid = new THREE.Group(); group.add(lid); lid.position.set(0, 0.63, -0.375);
            mesh(new THREE.BoxGeometry(1.2, 0.15, 0.8), wood, lid, 0, 0, 0.375);
            for (const x of [-0.4, 0.4]) mesh(new THREE.BoxGeometry(0.08, 0.65, 0.78), metal, group, x, 0.32, 0);
            mesh(new THREE.BoxGeometry(0.15, 0.22, 0.1), metal, group, 0, 0.54, 0.4);
            chestObjects.push({ chest, lid, wood });
        }
        const [sx, sz] = maze.start;
        const forward = [[0, -1], [1, 0], [0, 1], [-1, 0]].find(([dx, dz]) => maze.grid[sz + dz]?.[sx + dx] === 0);
        yaw = Math.atan2(-forward[0], -forward[1]); pitch = 0;
        avatar.position.set(position.x, 0, position.z); avatar.rotation.y = yaw;
        updateCamera(0); syncCombat(); updateHud();
    }
    function createTownLandscape(center) {
        const skyMaterial = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false,
            vertexShader: `varying vec3 direction; void main() { direction = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
            fragmentShader: `varying vec3 direction;
                float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
                float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
                    return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x); }
                void main() {
                    vec3 d = normalize(direction); float h = max(0., d.y);
                    vec3 color = mix(vec3(.69,.72,.69), vec3(.22,.37,.48), pow(h,.55));
                    vec2 p = d.xz / max(.16, d.y + .24) * 3.;
                    float cloud = noise(p)*.6 + noise(p*2.1)*.28 + noise(p*4.3)*.12;
                    color = mix(color, vec3(.79,.80,.75), smoothstep(.5,.72,cloud)*smoothstep(.02,.22,h)*.65);
                    float sun = pow(max(0.,dot(d,normalize(vec3(-.45,.42,-.8)))),180.);
                    color += vec3(.20,.16,.09)*sun; gl_FragColor = vec4(color,1.);
                }`
        });
        const sky = mesh(new THREE.SphereGeometry(320, 40, 24), skyMaterial, world, center, 0, center); sky.renderOrder = -10;
        const grass = new THREE.MeshStandardMaterial({ color: 0x566450, roughness: 1 });
        mesh(new THREE.CylinderGeometry(210, 210, 1, 64), grass, world, center, -0.65, center);
        const rng = MazeWorld.random('town-highlands');
        // Two irregular ridge rings establish a valley beyond the low town boundary.
        for (let layer = 0; layer < 2; layer++) {
            const positions = [], count = 72, radius = 95 + layer * 65;
            const ridge = Array.from({ length: count + 1 }, (_, i) => ({ angle: i / count * Math.PI * 2,
                radius: radius + rng() * 18, height: 12 + layer * 20 + rng() * (16 + layer * 16) }));
            ridge[count] = { ...ridge[0], angle: Math.PI * 2 };
            for (let i = 0; i < count; i++) {
                const a = ridge[i], b = ridge[i + 1];
                const ax = Math.cos(a.angle)*a.radius, az = Math.sin(a.angle)*a.radius, bx = Math.cos(b.angle)*b.radius, bz = Math.sin(b.angle)*b.radius;
                positions.push(ax,-1,az, bx,-1,bz, ax,a.height,az, ax,a.height,az, bx,-1,bz, bx,b.height,bz);
            }
            const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3)); geometry.computeVertexNormals();
            mesh(geometry, new THREE.MeshStandardMaterial({ color: layer ? 0x687b80 : 0x526553, roughness: 1, side: THREE.DoubleSide, flatShading: true }), world, center, 0, center);
        }
        const trunk = new THREE.MeshStandardMaterial({ color: 0x514938, roughness: 1 });
        const needles = new THREE.MeshStandardMaterial({ color: 0x354e41, roughness: 1 });
        for (let i = 0; i < 48; i++) {
            const angle = rng() * Math.PI * 2, radius = 40 + rng() * 40;
            const x = center + Math.cos(angle)*radius, z = center + Math.sin(angle)*radius, height = 3 + rng()*4;
            mesh(new THREE.CylinderGeometry(.15,.24,height,6),trunk,world,x,height/2,z);
            mesh(new THREE.ConeGeometry(height*.35,height*.8,7),needles,world,x,height*.85,z);
        }
    }
    function createBow() {
        bow = new THREE.Group(); avatar.add(bow); bow.position.set(-0.32, 1.03, -0.28); bow.scale.setScalar(0.85); bow.rotation.z = 0.18;
        const wood = new THREE.MeshStandardMaterial({ color: 0x735439, roughness: 0.8 });
        // The limbs and string share the vertical firing plane, with the grip ahead of the string.
        const curve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0, -0.62, 0.12), new THREE.Vector3(0, -0.5, 0.08),
            new THREE.Vector3(0, -0.3, -0.07), new THREE.Vector3(0, 0, -0.13),
            new THREE.Vector3(0, 0.3, -0.07), new THREE.Vector3(0, 0.5, 0.08),
            new THREE.Vector3(0, 0.62, 0.12)
        ]);
        const limbGeometry = new THREE.TubeGeometry(curve, 40, 0.028, 8, false);
        const points = limbGeometry.attributes.position;
        for (let ring = 0; ring <= 40; ring++) {
            const center = curve.getPointAt(ring / 40);
            const taper = 0.35 + 0.65 * Math.sin(Math.PI * ring / 40);
            for (let side = 0; side <= 8; side++) {
                const i = ring * 9 + side;
                points.setXYZ(i, center.x + (points.getX(i) - center.x) * taper,
                    center.y + (points.getY(i) - center.y) * taper,
                    center.z + (points.getZ(i) - center.z) * taper * 0.65);
            }
        }
        limbGeometry.computeVertexNormals();
        mesh(limbGeometry, wood, bow);
        const stringGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -0.62, 0.12), new THREE.Vector3(0, 0, 0.12), new THREE.Vector3(0, 0.62, 0.12)]);
        bowString = new THREE.Line(stringGeometry, new THREE.LineBasicMaterial({ color: 0xb6ae93 })); bow.add(bowString);
        nockedArrow = new THREE.Group(); bow.add(nockedArrow); nockedArrow.visible = false;
        const shaft = mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.65, 6), wood, nockedArrow, 0, 0, -0.325); shaft.rotation.x = Math.PI / 2;
        const tip = mesh(new THREE.ConeGeometry(0.025, 0.08, 4), new THREE.MeshStandardMaterial({ color: 0x99998c, metalness: 0.5, roughness: 0.6 }), nockedArrow, 0, 0, -0.68); tip.rotation.x = -Math.PI / 2;
        mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.17, 8), new THREE.MeshStandardMaterial({ color: 0x3e342b }), bow, 0, 0, -0.13);
    }
    function disposeObject(object) {
        const geometries = new Set(), materials = new Set();
        object.traverse(child => { if (child.geometry) geometries.add(child.geometry); if (child.material) materials.add(child.material); });
        geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); object.parent?.remove(object);
    }
    function enemyMesh(enemy) {
        const group = new THREE.Group(), size = enemy.height;
        const stone = new THREE.MeshStandardMaterial({ color: enemy.color, roughness: 0.95 });
        const dark = new THREE.MeshStandardMaterial({ color: 0x333632, roughness: 1 });
        const body = mesh(new THREE.IcosahedronGeometry(0.42, 0), stone, group, 0, size * 0.46, 0); body.scale.set(enemy.radius * 2.1, size * 0.85, enemy.radius * 1.4);
        const head = mesh(new THREE.DodecahedronGeometry(size * 0.14, 0), stone, group, 0, size * 0.85, 0);
        const eyes = mesh(new THREE.BoxGeometry(size * 0.16, 0.035, 0.018), new THREE.MeshBasicMaterial({ color: enemy.tier === 'guardian' ? 0xea946b : 0xb5b690 }), group, 0, size * 0.87, -size * 0.135);
        for (const x of [-1, 1]) {
            mesh(new THREE.BoxGeometry(0.13, size * 0.28, 0.17), dark, group, x * enemy.radius * 0.48, size * 0.15, 0);
            mesh(new THREE.ConeGeometry(enemy.radius * 0.32, size * 0.42, 5), stone, group, x * enemy.radius, size * 0.49, 0).rotation.z = x * 0.12;
        }
        if (enemy.tier === 'guardian') for (const x of [-1, 1]) mesh(new THREE.ConeGeometry(0.12, 0.46, 5), stone, group, x * 0.22, size * 1.03, 0).rotation.z = -x * 0.35;
        group.userData.stone = stone; world.add(group); return group;
    }
    function arrowMesh() {
        const group = new THREE.Group();
        mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.62, 5), new THREE.MeshBasicMaterial({ color: 0xa08051 }), group);
        mesh(new THREE.ConeGeometry(0.037, 0.13, 5), new THREE.MeshBasicMaterial({ color: 0xced0c1 }), group, 0, 0.36, 0);
        world.add(group); return group;
    }
    function syncCombat() {
        for (const { chest, lid, wood } of chestObjects) {
            lid.rotation.x = chest.state === 'open' ? -1.4 : 0;
            wood.emissive.setHex(chest.state === 'guarded' ? 0x441d37 : 0x000000);
        }
        for (const { door, hinge, leaf } of doorObjects) {
            hinge.rotation.y = door.open ? -Math.PI / 2 : 0;
            const index = walls.indexOf(leaf);
            if (door.open && index !== -1) walls.splice(index, 1);
            else if (!door.open && index === -1) walls.push(leaf);
        }
        const alive = new Set(combat.enemies.map(e => e.id));
        for (const [id, object] of enemyObjects) if (!alive.has(id)) { disposeObject(object); enemyObjects.delete(id); }
        for (const enemy of combat.enemies) {
            if (!enemyObjects.has(enemy.id)) enemyObjects.set(enemy.id, enemyMesh(enemy));
            const object = enemyObjects.get(enemy.id); object.position.set(enemy.x, 0, enemy.z); object.rotation.y = enemy.heading;
            const staggerPose = enemy.staggerDuration ? enemy.stagger / enemy.staggerDuration : 0;
            object.rotation.x = reducedMotion ? 0 : enemy.chargePhase === 'rush' ? 0.2 : -0.16 * staggerPose;
            object.scale.y = enemy.chargePhase === 'windup' ? 0.88 : 1;
            object.position.y = reducedMotion ? 0 : -0.06 * staggerPose;
            object.userData.stone.emissive.setHex(enemy.flash > 0 ? 0x773b22 : enemy.chargePhase === 'windup' ? 0x8a4520 : 0x000000);
        }
        const flying = new Set(combat.arrows.map(a => a.id));
        for (const [id, object] of arrowObjects) if (!flying.has(id)) { disposeObject(object); arrowObjects.delete(id); }
        for (const arrow of combat.arrows) {
            if (!arrowObjects.has(arrow.id)) arrowObjects.set(arrow.id, arrowMesh());
            const object = arrowObjects.get(arrow.id); object.position.set(arrow.x, arrow.y, arrow.z);
            object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(arrow.vx, arrow.vy, arrow.vz).normalize());
        }
        for (const event of combat.drainEvents()) {
            if (event.type === 'hit') { hitTime = event.headshot ? 0.28 : 0.15; $('crosshair').classList.toggle('headshot', !!event.headshot); }
            if (event.type === 'damage') hurtTime = 0.4;
            if (event.type === 'shot' && audio && audio.state === 'running' && $('sound').checked) bowReleaseSound();
        }
    }
    function poseBow(draw, active) {
        const smooth = value => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
        const stance = active ? (shotClock < 0.18 ? smooth(shotClock / 0.09) : 1 - smooth((shotClock - 0.28) / 0.2)) : 0;
        const pull = draw * 0.24;
        bow.position.set(-0.32 + 0.1 * stance, 1.03 + 0.25 * stance, -0.55 - 0.08 * stance);
        bow.rotation.z = 0.18 - 0.13 * stance;
        bowString.geometry.attributes.position.setXYZ(1, 0, 0, 0.12 + pull);
        bowString.geometry.attributes.position.needsUpdate = true;
        bowString.geometry.computeBoundingSphere();
        nockedArrow.visible = active && shotClock < 0.18;
        nockedArrow.position.set(0, 0, 0.12 + pull);
        bow.updateMatrix();
        // All targets are in avatar space before conversion into each shoulder's space.
        // The draw ends beside the right cheek; only the elbow travels behind the shoulder.
        const follow = active && shotClock >= 0.18 ? smooth((shotClock - 0.18) / 0.08) * 0.035 : 0;
        const handPull = active && shotClock >= 0.18 ? 0.24 : pull;
        const target = new THREE.Vector3(0, 0, 0.12 + handPull).applyMatrix4(bow.matrix);
        target.x += follow; target.z += follow;
        target.sub(rightArm.position);
        const hand = rightArm.userData.restHand.clone().lerp(target, stance);
        const elbow = rightArm.userData.restElbow.clone().lerp(new THREE.Vector3(0.42, 1.4, 0.04).sub(rightArm.position), stance);
        // Blend locomotion out before posing, rather than rotating solved hand targets afterward.
        rightArm.rotation.x *= 1 - stance; rightArm.rotation.z *= 1 - stance;
        rightArm.updateMatrix();
        const inverseRight = rightArm.matrix.clone().invert();
        poseArm(rightArm, elbow.add(rightArm.position).applyMatrix4(inverseRight), hand.add(rightArm.position).applyMatrix4(inverseRight));
        const grip = new THREE.Vector3(0, 0, -0.13).applyMatrix4(bow.matrix).sub(leftArm.position);
        const leftElbow = leftArm.userData.restElbow.clone().lerp(new THREE.Vector3(-0.1, 1.39, -0.28).sub(leftArm.position), stance);
        poseArm(leftArm, leftElbow, grip);
    }
    function poseArm(arm, elbow, hand) {
        function connect(part, from, to) {
            const delta = to.clone().sub(from);
            part.position.copy(from).add(to).multiplyScalar(0.5);
            part.scale.y = delta.length() / part.geometry.parameters.height;
            part.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
        }
        connect(arm.userData.upper, new THREE.Vector3(0, -0.06, 0), elbow);
        connect(arm.userData.lower, elbow, hand);
        arm.userData.hand.position.copy(hand);
    }
    function animateBow(dt) {
        if (phase !== 'playing') return;
        if (shotClock < 0) { poseBow(0, false); return; }
        const before = shotClock; shotClock += dt;
        if (before < 0.18 && shotClock >= 0.18) { poseBow(1, true); releaseShot(); }
        if (shotClock >= 0.48) {
            shotClock = -1; poseBow(0, false); rightArm.rotation.x = 0; return;
        }
        const draw = shotClock < 0.18 ? Math.sin(shotClock / 0.18 * Math.PI / 2) : Math.exp(-(shotClock - 0.18) * 28);
        poseBow(draw, true);
    }
    function shoot() {
        if (depth === 0 || phase !== 'playing' || shotClock >= 0 || combat.cooldown > 0 || combat.health <= 0) return false;
        shotClock = 0; poseBow(0, true); return true;
    }
    function releaseShot() {
        if (phase !== 'playing') return false;
        updateCamera(0); world.updateMatrixWorld(true);
        const direction = camera.getWorldDirection(new THREE.Vector3()), ray = new THREE.Raycaster(camera.position, direction, 0.02, 65);
        let distance = ray.intersectObjects(walls, false)[0]?.distance || 65;
        const end = camera.position.clone().addScaledVector(direction, 65);
        for (const enemy of combat.enemies) {
            const t = DungeonCombat.enemyHit(camera.position, end, enemy)?.t ?? null;
            if (t !== null) distance = Math.min(distance, t * 65);
        }
        const aim = camera.position.clone().addScaledVector(direction, distance);
        // Spawn at the visible arrow rest, not an unrelated point above the weapon.
        camera.updateMatrixWorld(true);
        const origin = bow.localToWorld(new THREE.Vector3(0, 0, -0.13));
        if (!MazeWorld.canStand(maze.grid, origin.x, origin.z, CELL, 0.06) ||
            !combat.clearLine(position, origin)) return false;
        return combat.shoot(origin, aim.sub(origin).normalize());
    }
    function setCombatHud(visible) {
        $('minimap').classList.toggle('hidden', !visible);
        $('combatHud').classList.toggle('hidden', !visible); $('crosshair').classList.toggle('hidden', !visible);
        if (!visible) { $('targetInfo').textContent = ''; $('travel').classList.add('hidden'); }
    }
    function persistProgress() {
        if (!combat) return;
        const signature = `${combat.multishotLevel},${combat.highestDepth},${combat.vitalityLevel},${combat.bowLevel},${combat.speedLevel},${combat.coins},${combat.bowStyle},${combat.bowUnlocks.join()}`;
        if (signature === savedSignature) return;
        try {
            if (DungeonProgress.write(localStorage, combat)) savedSignature = signature;
            else $('saveStatus').textContent = 'Saving is unavailable in this browser.';
        } catch (_) { $('saveStatus').textContent = 'Saving is unavailable in this browser.'; }
    }
    function updateHud() {
        if (!combat) return;
        persistProgress();
        $('location').textContent = depth === 0 ? 'Town' : `${depth % 5 === 0 ? 'Checkpoint' : 'Dungeon'} · ${depth}`;
        $('openShop').classList.toggle('hidden', !nearbyService()); $('openShop').textContent = nearbyService()?.name || 'Service';
        $('travel').textContent = travelLabel(); $('travel').classList.toggle('hidden', phase !== 'playing' || !travelLabel());
        $('health').textContent = `${combat.health}/${combat.maxHealth}`; $('coins').textContent = String(combat.coins);
        if (phase !== 'playing') return;
        const direction = camera.getWorldDirection(new THREE.Vector3()), from = camera.position, to = from.clone().addScaledVector(direction, 16);
        let aimed = null, nearest = Infinity;
        for (const enemy of combat.enemies) {
            const hit = DungeonCombat.enemyHit(from, to, enemy)?.t ?? null;
            if (hit !== null && hit < nearest && combat.clearLine(position, enemy)) { nearest = hit; aimed = enemy; }
        }
        $('targetInfo').textContent = aimed ? `${aimed.name} · ${Math.max(0, aimed.health)}/${aimed.maxHealth}` : '';
    }
    function revealMap(force = false) {
        const viewKey = `${position.x.toFixed(1)},${position.z.toFixed(1)},${yaw.toFixed(2)},${pitch.toFixed(2)},${camera.aspect.toFixed(2)},${jumpHeight.toFixed(1)}`;
        if (!force && (viewKey === exploredCell || performance.now() < nextRevealAt)) return;
        exploredCell = viewKey; nextRevealAt = performance.now() + 80;
        DungeonProgress.reveal(maze, position, (a, b) => DungeonProgress.visible(maze, a, b),
            { yaw, pitch, fov: camera.fov, aspect: camera.aspect, height: camera.position.y, range: depth === 0 ? 60 : 28 });
    }
    function openMap() {
        if (phase !== 'playing') return;
        revealMap(true); phase = 'map'; clearInput(); releaseMouse(); quietSound(); setCombatHud(false);
        $('pause').classList.add('hidden'); $('spray').classList.add('hidden'); $('touchControls').classList.add('hidden');
        $('mapPanel').classList.remove('hidden'); $('mapTitle').textContent = depth === 0 ? 'Town' : `Dungeon · ${depth}`;
        drawMap($('exploredMap'));
        $('closeMap').focus();
    }
    function drawMap(canvas, mini = false) {
        const unit = 16, size = mini ? 192 : maze.size * unit;
        if (canvas.width !== size) canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.fillStyle = '#080a0a'; ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.save();
            if (mini) ctx.translate(size / 2 - (position.x / CELL * unit + 8), size / 2 - (position.z / CELL * unit + 8));
            for (const key of maze.visited || []) {
                const [x, z] = key.split(',').map(Number);
                ctx.fillStyle = maze.grid[z][x] ? '#353d38' : '#929b8c'; ctx.fillRect(x * unit, z * unit, unit - 1, unit - 1);
            }
            for (const point of [maze.start, maze.exit]) if (maze.visited?.has(point.join(','))) {
                ctx.fillStyle = '#acd6d5'; ctx.fillRect(point[0] * unit + 4, point[1] * unit + 4, 8, 8);
            }
            const px = position.x / CELL * unit + 8, pz = position.z / CELL * unit + 8;
            const heading = -Math.PI / 2 - yaw;
            const horizontalFov = 2 * Math.atan(Math.tan(camera.fov * Math.PI / 360) * camera.aspect);
            ctx.save(); ctx.beginPath();
            for (const key of maze.visited || []) { const [x, z] = key.split(',').map(Number); ctx.rect(x * unit, z * unit, unit, unit); }
            ctx.clip();
            ctx.fillStyle = '#efd27b38'; ctx.beginPath(); ctx.moveTo(px, pz);
            ctx.arc(px, pz, unit * 3.1, heading - horizontalFov / 2, heading + horizontalFov / 2); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = '#efd27b99'; ctx.lineWidth = 1;
            for (const angle of [heading - horizontalFov / 2, heading + horizontalFov / 2]) {
                ctx.beginPath(); ctx.moveTo(px, pz); ctx.lineTo(px + Math.cos(angle) * unit * 3.1, pz + Math.sin(angle) * unit * 3.1); ctx.stroke();
            }
            ctx.restore(); ctx.save(); ctx.translate(px, pz); ctx.rotate(-yaw);
            ctx.fillStyle = '#efd27b'; ctx.strokeStyle = '#292a20'; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(5, 5); ctx.lineTo(0, 2); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); ctx.restore();
        }
    }
    function resetProgress() {
        if (!window.confirm('Reset all saved coins and upgrades, and start a new dungeon?')) return;
        combat.bowStyle = 'balanced'; combat.bowUnlocks = ['balanced']; combat.multishotLevel = 0; combat.vitalityLevel = 0; combat.highestDepth = 1;
        combat.coins = 0; combat.bowLevel = 0; combat.speedLevel = 0; combat.health = 100;
        floors.clear(); depth = 0; deepest = 1; savedSignature = ''; createMaze(SIZE, randomSeed()); persistProgress();
        $('menuTitle').textContent = 'Dungeon'; $('menuCopy').textContent = 'Progress reset. Start in town.'; $('menuCopy').classList.remove('hidden');
    }
    function openShop(service = 'bowyer') {
        if (depth !== 0 || phase !== 'playing') return;
        shopService = services.some(s => s.id === service) ? service : 'bowyer';
        phase = 'shop'; clearInput(); releaseMouse(); quietSound(); setCombatHud(false);
        $('pause').classList.add('hidden'); $('spray').classList.add('hidden'); $('touchControls').classList.add('hidden');
        $('shop').classList.remove('hidden'); renderShop(); $('closeShop').focus();
    }
    function renderShop() {
        $('shopTitle').textContent = services.find(s => s.id === shopService).name;
        for (const id of ['bow-balanced', 'bow-quick', 'bow-heavy', 'bow-piercing', 'buyBow', 'buyMultishot']) $(id).classList.toggle('hidden', shopService !== 'bowyer');
        for (const id of ['buySpeed', 'buyVitality']) $(id).classList.toggle('hidden', shopService !== 'outfitter');
        $('buyHeal').classList.toggle('hidden', shopService !== 'inn');
        $('checkpointChoices').classList.toggle('hidden', shopService !== 'waygate');
        $('serviceInfo').textContent = { bowyer: 'Improve damage without a level cap. Switch owned bows for free.', outfitter: 'Train vitality for more health, or improve movement.', inn: 'Rest here to restore your health for free.', waygate: `Deepest floor: ${deepest}. Reach every fifth floor to unlock a permanent destination.` }[shopService];
        $('checkpointChoices').replaceChildren();
        if (shopService === 'waygate') for (let level = 0; level <= Math.floor(deepest / 5); level++) {
            const destination = level === 0 ? 1 : level * 5, button = document.createElement('button');
            button.textContent = destination === 1 ? 'Enter floor 1' : `Travel to checkpoint ${destination}`;
            button.addEventListener('click', () => fastTravel(destination)); $('checkpointChoices').appendChild(button);
        }
        for (const [style, description] of Object.entries({ balanced: 'Balanced · standard damage and recovery', quick: 'Quickdraw · 20% less damage, faster recovery', heavy: 'Longbow · 60% more damage, slower recovery', piercing: 'Piercing · 10% less damage, hits up to 3 enemies' })) {
            const button = $('bow-' + style), owned = combat.bowUnlocks.includes(style), equipped = combat.bowStyle === style;
            button.textContent = `${description} — ${equipped ? 'equipped' : owned ? 'equip' : DungeonCombat.BOWS[style].price + ' coins'}`;
            button.disabled = equipped || combat.coins < combat.cost(style);
        }
        $('shopCoins').textContent = String(combat.coins);
        for (const [id, kind, label] of [['buyBow', 'bow', `Damage rank ${combat.bowLevel + 1} · ${combat.damage} → ${Math.round((25 + (combat.bowLevel + 1) * 12) * DungeonCombat.BOWS[combat.bowStyle].multiplier)}`], ['buyMultishot', 'multishot', combat.multishotLevel === 0 ? 'Multishot · 3 arrows · 65% damage each' : 'Multishot · 5 arrows · 50% damage each'], ['buySpeed', 'speed', `Movement +0.4 (${combat.speed.toFixed(1)} now)`], ['buyVitality', 'vitality', `Vitality +20 health (${combat.maxHealth} now)`], ['buyHeal', 'heal', 'Rest and restore health']]) {
            const cost = combat.cost(kind), button = $(id);
            button.textContent = `${label} — ${cost === null ? (kind === 'heal' ? 'Rested' : 'Max') : cost + ' coins'}`;
            button.disabled = cost === null || combat.coins < cost;
        }
    }
    function die() {
        phase = 'dead'; clearInput(); releaseMouse(); quietSound(); setCombatHud(false);
        $('menu').classList.remove('hidden'); $('menuTitle').textContent = 'You fell.';
        $('menuCopy').textContent = 'Return to town. Lose a quarter of your coins; keep your upgrades.'; $('menuCopy').classList.remove('hidden');
        $('play').textContent = 'Return to town'; $('newMaze').classList.add('hidden');
        $('pause').classList.add('hidden'); $('spray').classList.add('hidden'); $('touchControls').classList.add('hidden'); $('play').focus();
    }
    function createPaint() {
        const size = 128, data = new Uint8Array(size * size * 4), rng = MazeWorld.random('yellow-spray');
        for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
            const x = px / (size - 1) * 2 - 1, y = py / (size - 1) * 2 - 1;
            let distance = Math.abs(Math.hypot(x, y) - 0.74);
            distance = Math.min(distance, Math.max(0, Math.hypot((x - 0.24) * 1.15, (y - 0.23) * 0.72) - 0.057));
            distance = Math.min(distance, Math.max(0, Math.hypot((x + 0.24) * 1.15, (y - 0.23) * 0.72) - 0.057));
            if (y < -0.08) distance = Math.min(distance, Math.abs(Math.hypot(x, y + 0.01) - 0.4));
            const coverage = Math.max(0, Math.min(1, (0.045 - distance) / 0.022));
            const speckle = distance < 0.09 && rng() > 0.86 ? 0.16 : 0;
            const i = (py * size + px) * 4;
            data[i] = 255; data[i + 1] = 211; data[i + 2] = 12;
            data[i + 3] = Math.round(255 * Math.max(speckle, coverage * (0.64 + rng() * 0.36)));
        }
        paintTexture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
        paintTexture.magFilter = THREE.LinearFilter; paintTexture.minFilter = THREE.LinearFilter;
        paintTexture.needsUpdate = true; paintTexture.encoding = THREE.sRGBEncoding;
        paintGeometry = new THREE.PlaneGeometry(1.05, 1.05);
        paintMaterial = new THREE.MeshStandardMaterial({ map: paintTexture, transparent: true,
            alphaTest: 0.03, depthTest: true, depthWrite: false, roughness: 1,
            polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    }
    function resetPaintButton() {
        $('spray').textContent = 'Spray'; $('spray').classList.remove('painted');
    }
    function spray() {
        if (phase !== 'playing') return false;
        const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
        const ray = new THREE.Raycaster(new THREE.Vector3(position.x, 1.4 + jumpHeight, position.z), forward, 0.02, 2.8);
        world.updateMatrixWorld(true);
        const hit = ray.intersectObjects(walls, false)[0];
        paintFeedback = 0.85;
        if (!hit) { $('spray').textContent = 'No wall'; $('paintStatus').textContent = 'Face a nearby wall to spray.'; return false; }
        if (!hit.object.userData.cells) { $('paintStatus').textContent = 'Paint a stone wall.'; return false; }
        const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
        const [cx, cz] = hit.object.userData.cells[hit.instanceId];
        const key = `${cx},${cz},${Math.round(normal.x)},${Math.round(normal.z)}`;
        if (!marks.has(key)) {
            const decal = new THREE.Mesh(paintGeometry, paintMaterial);
            const point = hit.point.clone();
            // Keep the entire mark on this face rather than painting across an open corner.
            const margin = CELL / 2 - 0.56;
            if (Math.abs(normal.x) > 0.5) point.z = Math.max(cz * CELL - margin, Math.min(point.z, cz * CELL + margin));
            else point.x = Math.max(cx * CELL - margin, Math.min(point.x, cx * CELL + margin));
            decal.position.copy(point.addScaledVector(normal, 0.012));
            decal.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
            world.add(decal); marks.set(key, decal);
        }
        $('spray').textContent = 'Spray'; $('spray').classList.add('painted'); $('paintStatus').textContent = 'Wall marked.';
        if (audio && audio.state === 'running' && $('sound').checked) {
            try {
                const source = audio.createBufferSource(), filter = audio.createBiquadFilter(), gain = audio.createGain();
                source.buffer = stepBuffer; filter.type = 'highpass'; filter.frequency.value = 1400; gain.gain.value = 0.06;
                source.connect(filter); filter.connect(gain); gain.connect(audio.destination); source.start();
                source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
            } catch (_) {}
        }
        return true;
    }
    async function resumeSound() {
        if (!$('sound').checked) return;
        try {
            const Audio = window.AudioContext || window.webkitAudioContext;
            if (!Audio) { $('sound').checked = false; $('sound').disabled = true; return; }
            if (!audio) {
                audio = new Audio(); enemyAudio = new EnemyAudio(audio);
                stepBuffer = audio.createBuffer(1, Math.ceil(audio.sampleRate * 0.15), audio.sampleRate);
                const noise = MazeWorld.random('ambient-sound');
                const stepData = stepBuffer.getChannelData(0);
                for (let i = 0; i < stepData.length; i++) stepData[i] = (noise() * 2 - 1) * (1 - i / stepData.length);
                const buffer = audio.createBuffer(1, audio.sampleRate * 4, audio.sampleRate), data = buffer.getChannelData(0);
                for (let i = 0; i < data.length; i++) data[i] = noise() * 2 - 1;
                wind = audio.createBufferSource(); wind.buffer = buffer; wind.loop = true;
                const lowpass = audio.createBiquadFilter(); lowpass.type = 'lowpass'; lowpass.frequency.value = 430;
                const highpass = audio.createBiquadFilter(); highpass.type = 'highpass'; highpass.frequency.value = 100;
                windGain = audio.createGain(); windGain.gain.value = 0;
                wind.connect(lowpass); lowpass.connect(highpass); highpass.connect(windGain); windGain.connect(audio.destination); wind.start();
            }
            if (audio.state === 'suspended') await audio.resume();
            if (phase === 'playing' && $('sound').checked) windGain.gain.setTargetAtTime(0.055, audio.currentTime, 0.5);
        } catch (_) {
            $('sound').checked = false;
            quietSound();
        }
    }
    function quietSound() {
        enemyAudio?.silence();
        if (!audio || !windGain) return;
        try { windGain.gain.setTargetAtTime(0, audio.currentTime, 0.08); } catch (_) {}
    }
    function bowReleaseSound() {
        if (!audio || audio.state !== 'running' || !$('sound').checked) return;
        try {
            const oscillator = audio.createOscillator(), gain = audio.createGain(), now = audio.currentTime;
            oscillator.type = 'triangle'; oscillator.frequency.setValueAtTime(220, now); oscillator.frequency.exponentialRampToValueAtTime(85, now + 0.12);
            gain.gain.setValueAtTime(0.025, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
            oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(now); oscillator.stop(now + 0.15);
            oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
        } catch (_) {}
    }
    function clearInput() {
        keys.clear(); shootHeld = false; stick = { x: 0, y: 0 };
        if (joystickPointer !== null && $('joystick').hasPointerCapture?.(joystickPointer)) $('joystick').releasePointerCapture(joystickPointer);
        joystickPointer = null; orbitPointer = null; $('stick').style.transform = '';
    }
    function setPlaying() {
        phase = 'playing'; clearInput(); $('menu').classList.add('hidden'); $('shop').classList.add('hidden'); $('mapPanel').classList.add('hidden'); setCombatHud(true);
        $('pause').classList.remove('hidden'); $('spray').classList.remove('hidden'); $('touchControls').classList.remove('hidden');
        revealMap(); drawMap($('minimap'), true);
        $('world').focus({ preventScroll: true }); lastTime = performance.now(); resumeSound(); captureMouse();
    }
    function start() {
        if (phase === 'dead') { combat.coins = Math.floor(combat.coins * 0.75); combat.health = combat.maxHealth; floors.clear(); depth = 0; createMaze(SIZE, randomSeed()); }
        setPlaying();
    }
    function pause() {
        if (phase === 'paused') return setPlaying();
        if (phase !== 'playing') return;
        phase = 'paused'; clearInput(); quietSound(); releaseMouse(); setCombatHud(false);
        $('menu').classList.remove('hidden'); $('pause').classList.add('hidden'); $('spray').classList.add('hidden'); $('touchControls').classList.add('hidden');
        $('menuTitle').textContent = 'Paused'; $('menuCopy').classList.add('hidden');
        $('play').textContent = 'Resume'; $('newMaze').classList.add('hidden'); $('play').focus();
    }
    function newMaze() {
        depth = 0; createMaze(SIZE, randomSeed()); setPlaying();
    }
    function nearbyService() {
        if (depth !== 0) return null;
        return services.find(s => Math.hypot(position.x - (s.x + (s.x < 7 ? 1.5 : -1.5)) * CELL, position.z - s.z * CELL) < 3.8);
    }
    function fastTravel(destination) {
        if (phase !== 'shop' || shopService !== 'waygate' || !Number.isInteger(destination) ||
            !(destination === 1 || destination > 0 && destination % 5 === 0 && destination <= deepest)) return false;
        depth = destination; createMaze(SIZE, randomSeed()); setPlaying(); return true;
    }
    function nearbyChest() {
        return combat.chests.find(c => c.state !== 'open' && Math.hypot(position.x - c.x, position.z - c.z) < 2.4 && combat.clearLine(position, c));
    }
    function nearbyDoor() {
        return (maze.doors || []).filter(d => Math.hypot(position.x - d.x * CELL, position.z - d.z * CELL) < 3).sort((a, b) => Math.hypot(position.x - a.x * CELL, position.z - a.z * CELL) - Math.hypot(position.x - b.x * CELL, position.z - b.z * CELL))[0];
    }
    function travelLabel() {
        const service = nearbyService(); if (service) return `F · ${service.name}`;
        const chest = nearbyChest();
        if (chest) {
            if (chest.state === 'guarded' && chest.guards.some(id => combat.enemies.some(e => e.id === id && e.health > 0))) return 'Defeat the chest guards';
            return chest.state === 'closed' && chest.guarded ? 'F · Open sealed chest · ambush' : `F · Claim treasure · ${chest.reward} coins`;
        }
        const door = nearbyDoor(); if (door) return door.open ? 'F · Close door' : 'F · Open door';
        const near = point => Math.hypot(position.x - point[0] * CELL, position.z - point[1] * CELL) < 3;
        if (near(maze.exit)) return depth === 0 ? 'F · Enter dungeon 1' : `F · Descend to ${depth + 1}`;
        if (depth > 0 && near(maze.start)) return 'F · Return to town';
        return '';
    }
    function travel() {
        if (phase !== 'playing' || !travelLabel()) return;
        const service = nearbyService(); if (service) { openShop(service.id); return; }
        const chest = nearbyChest(); if (chest) { combat.openChest(chest); syncCombat(); updateHud(); return; }
        const door = nearbyDoor();
        if (door) {
            if (door.open && [position, ...combat.enemies].some(p => Math.hypot(p.x - door.x * CELL, p.z - door.z * CELL) < 2.1)) return;
            door.open = !door.open;
            if (door.open) maze.grid.blocked.delete(`${door.x},${door.z}`); else maze.grid.blocked.add(`${door.x},${door.z}`);
            exploredCell = ''; nextRevealAt = 0; syncCombat(); updateHud(); return;
        }
        if (Math.hypot(position.x - maze.exit[0] * CELL, position.z - maze.exit[1] * CELL) < 3) {
            depth = depth === 0 ? 1 : depth + 1; deepest = Math.max(deepest, depth);
        } else depth = 0;
        clearInput(); createMaze(SIZE, randomSeed());
    }
    function jump() {
        if (phase !== 'playing' || jumpHeight > 0 || verticalSpeed !== 0) return false;
        verticalSpeed = 5;
        return true;
    }
    function move(dt) {
        if (phase !== 'playing') return;
        if (jumpHeight > 0 || verticalSpeed > 0) {
            jumpHeight += verticalSpeed * dt - 8 * dt * dt;
            verticalSpeed -= 16 * dt;
            if (jumpHeight <= 0) { jumpHeight = 0; verticalSpeed = 0; landing = 1; }
        }
        // Q/E are an optional keyboard-look fallback. A/D always strafe.
        yaw -= (Number(keys.has('KeyE')) - Number(keys.has('KeyQ'))) * dt * 1.8;
        avatar.rotation.y = yaw;
        let strafe = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft')) + stick.x;
        let forward = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown')) - stick.y;
        const magnitude = Math.hypot(strafe, forward);
        if (magnitude > 1) { strafe /= magnitude; forward /= magnitude; }
        const speed = combat ? combat.speed : MOVE_SPEED;
        const dx = (Math.cos(yaw) * strafe - Math.sin(yaw) * forward) * speed * dt;
        const dz = (-Math.sin(yaw) * strafe - Math.cos(yaw) * forward) * speed * dt;
        const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.1)), beforeX = position.x, beforeZ = position.z;
        for (let i = 0; i < steps; i++) {
            if (MazeWorld.canStand(maze.grid, position.x + dx / steps, position.z, CELL, PLAYER_RADIUS)) position.x += dx / steps;
            if (MazeWorld.canStand(maze.grid, position.x, position.z + dz / steps, CELL, PLAYER_RADIUS)) position.z += dz / steps;
        }
        const distance = Math.hypot(position.x - beforeX, position.z - beforeZ); walked += distance;

        avatar.position.set(position.x, jumpHeight, position.z);
        animatePlayer(dt, distance, forward, strafe);

    }
    function animatePlayer(dt, distance, forward, strafe) {
        const blend = 1 - Math.exp(-dt * 14);
        const moving = distance > 0.001 && jumpHeight === 0 ? Math.min(1, distance / Math.max(0.001, dt * MOVE_SPEED)) : 0;
        strideBlend += (moving - strideBlend) * blend;
        landing = Math.max(0, landing - dt * 5);
        const cycle = walked * 6, stride = Math.sin(cycle) * strideBlend;
        const airborne = jumpHeight > 0;
        const tuck = airborne ? Math.min(1, jumpHeight / 0.35) : 0;
        for (const [leg, sign] of [[leftLeg, 1], [rightLeg, -1]]) {
            const swing = stride * sign;
            const hip = airborne ? -0.38 * tuck + sign * 0.12 : swing * 0.48 * forward - landing * 0.22;
            const side = airborne ? sign * 0.08 : -swing * 0.32 * strafe;
            leg.rotation.x += (hip - leg.rotation.x) * blend;
            leg.rotation.z += (side - leg.rotation.z) * blend;
            const knee = airborne ? 0.85 * tuck : Math.max(0, -Math.cos(cycle + (sign < 0 ? Math.PI : 0))) * strideBlend * 0.6 + landing * 0.45;
            leg.userData.knee.rotation.x += (knee - leg.userData.knee.rotation.x) * blend;
        }
        rightArm.rotation.x = airborne ? -0.35 : stride * 0.28 * forward;
        rightArm.rotation.z = airborne ? 0.18 : -stride * strafe * 0.12;
        leftArm.rotation.x = 0; leftArm.rotation.z = 0;
        // Secondary motion stays on the model, leaving the aiming camera stable.
        avatar.position.y = jumpHeight - (reducedMotion ? 0 : landing * 0.055);
        mantleMesh.rotation.x = reducedMotion ? 0 : strideBlend * 0.06 + Math.sin(cycle - 0.5) * strideBlend * 0.035 + tuck * 0.1;
        mantleMesh.rotation.z = reducedMotion ? 0 : -strafe * strideBlend * 0.035;
    }
    function updateCamera(dt) {
        avatar.rotation.y = yaw;
        camera.position.set(position.x, 1.6 + jumpHeight, position.z);
        camera.rotation.order = 'YXZ'; camera.rotation.set(pitch, yaw, 0);
        light.position.set(position.x, 2.7 + jumpHeight, position.z);
    }
    function look(dx, dy) {
        if (phase !== 'playing') return;
        yaw -= (Number.isFinite(dx) ? dx : 0) * 0.0024;
        pitch = Math.max(-1.35, Math.min(1.35, pitch - (Number.isFinite(dy) ? dy : 0) * 0.0024));
        updateCamera(0);
    }
    function captureMouse() {
        if (touchDevice || document.pointerLockElement === $('world')) return;
        if (!$('world').requestPointerLock) return; // Touch/unsupported browsers can drag to look.
        const denied = () => {
            if (phase !== 'playing') return;
            pause(); $('menuCopy').textContent = 'Mouse capture was blocked. Resume to try again.'; $('menuCopy').classList.remove('hidden');
        };
        try { const request = $('world').requestPointerLock(); if (request?.catch) request.catch(denied); }
        catch (_) { denied(); }
    }
    function releaseMouse() {
        if (document.pointerLockElement === $('world')) document.exitPointerLock?.();
    }

    function frame(now) {
        if (disposed || phase === 'error') return;
        const dt = Math.min(Math.max(0, (now - lastTime) / 1000), 0.05); lastTime = now;
        if (phase === 'playing') {
            move(dt); updateCamera(0);
            if (phase === 'playing') {
                if (shootHeld) shoot();
                combat.update(dt, position); animateBow(dt); syncCombat(); revealMap(); updateHud();
                minimapClock -= dt;
                if (minimapClock <= 0) { drawMap($('minimap'), true); minimapClock = 0.08; }
                if (depth > 0 && combat.health > 0 && audio?.state === 'running' && $('sound').checked) enemyAudio?.update(dt, combat, position, yaw);
                if (combat.health <= 0) die();
            }
        }
        hitTime = Math.max(0, hitTime - dt); hurtTime = Math.max(0, hurtTime - dt);
        $('crosshair').classList.toggle('hit', hitTime > 0); $('hurtFrame').style.opacity = String(hurtTime * 1.5);
        if (paintFeedback > 0) { paintFeedback -= dt; if (paintFeedback <= 0) resetPaintButton(); }
        renderer.render(scene, camera); frameId = requestAnimationFrame(frame);
    }
    function resize() {
        if (!renderer) return; renderer.setSize(window.innerWidth, window.innerHeight, false);
        camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
    }
    function bindControls() {
        $('testEnemySound').addEventListener('click', async () => {
            $('sound').checked = true; await resumeSound();
            if (!enemyAudio || audio?.state !== 'running') { $('audioStatus').textContent = 'Audio could not start.'; return; }
            enemyAudio.silence();
            enemyAudio.call({ id: -1, tier: 'wanderer', x: position.x, z: position.z - 3, health: 1 }, position, 0, { clearLine: () => true });
            $('audioStatus').textContent = 'Playing enemy footstep.';
        });
        for (const style of Object.keys(DungeonCombat.BOWS)) $('bow-' + style).addEventListener('click', () => { if (phase === 'shop' && shopService === 'bowyer') { combat.buy(style); renderShop(); updateHud(); } });
        $('openMap').addEventListener('click', openMap);
        $('closeMap').addEventListener('click', setPlaying); $('resetProgress').addEventListener('click', resetProgress);
        $('travel').addEventListener('click', travel);
        $('openShop').addEventListener('click', () => { const service = nearbyService(); if (service) openShop(service.id); }); $('closeShop').addEventListener('click', setPlaying);
        for (const [id, kind] of [['buyBow', 'bow'], ['buyMultishot', 'multishot'], ['buySpeed', 'speed'], ['buyHeal', 'heal'], ['buyVitality', 'vitality']]) $(id).addEventListener('click', () => { if (phase === 'shop' && ((shopService === 'bowyer' && ['bow', 'multishot'].includes(kind)) || (shopService === 'outfitter' && ['speed', 'vitality'].includes(kind)) || (shopService === 'inn' && kind === 'heal'))) { combat.buy(kind); renderShop(); updateHud(); } });
        $('sound').addEventListener('change', () => { if (!$('sound').checked) quietSound(); else if (phase === 'playing') resumeSound(); });
        $('spray').addEventListener('click', () => { spray(); if (phase === 'playing') $('world').focus({ preventScroll: true }); });
        $('jump').addEventListener('click', () => { jump(); if (phase === 'playing') $('world').focus({ preventScroll: true }); });
        $('play').addEventListener('click', start); $('newMaze').addEventListener('click', newMaze); $('pause').addEventListener('click', pause);
        const movementKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyQ', 'KeyE'];
        document.addEventListener('keydown', e => {
            if (phase === 'map' && ['KeyM', 'Escape'].includes(e.code) && !e.repeat) { e.preventDefault(); setPlaying(); return; }
            if (e.code === 'Escape' && !e.repeat && phase === 'shop') { e.preventDefault(); setPlaying(); return; }
            if (e.code === 'Escape' && !e.repeat && phase === 'paused') { e.preventDefault(); if (performance.now() - lockReleasedAt > 250) pause(); return; }
            if (['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'SUMMARY', 'A'].includes(e.target.tagName)) return;
            if (e.code === 'Escape' && !e.repeat) { e.preventDefault(); pause(); return; }
            if (phase === 'playing' && e.code === 'KeyM' && !e.repeat) { e.preventDefault(); openMap(); return; }
            if (phase === 'playing' && e.code === 'KeyF' && !e.repeat) { e.preventDefault(); travel(); return; }
            if (phase === 'playing' && e.code === 'KeyB' && !e.repeat) { e.preventDefault(); const service = nearbyService(); if (service) openShop(service.id); return; }
            if (phase === 'playing' && e.code === 'Space') { e.preventDefault(); if (!e.repeat) jump(); return; }
            if (phase === 'playing' && e.code === 'KeyT') { e.preventDefault(); if (!e.repeat) spray(); return; }
            if (phase === 'playing' && movementKeys.includes(e.code)) { e.preventDefault(); keys.add(e.code); }
        });
        document.addEventListener('keyup', e => keys.delete(e.code));
        window.addEventListener('blur', () => { clearInput(); if (phase === 'playing') pause(); });
        document.addEventListener('visibilitychange', () => { if (document.hidden && phase === 'playing') pause(); lastTime = performance.now(); });
        window.addEventListener('resize', resize);
        document.addEventListener('pointerlockchange', () => {
            const locked = document.pointerLockElement === $('world');
            if (wasLocked && !locked) { lockReleasedAt = performance.now(); if (phase === 'playing') pause(); }
            if (locked && !wasLocked) { lockLookReadyAt = performance.now() + 120; lockPointerAnchor = null; }
            wasLocked = locked;
        });
        document.addEventListener('pointerlockerror', () => {
            if (phase === 'playing') { pause(); $('menuCopy').textContent = 'Mouse capture was blocked. Resume to try again.'; $('menuCopy').classList.remove('hidden'); }
        });
        document.addEventListener('mousemove', e => {
            if (document.pointerLockElement !== $('world')) return;
            const anchor = { x: e.clientX ?? 0, y: e.clientY ?? 0 };
            const repositioned = !lockPointerAnchor || anchor.x !== lockPointerAnchor.x || anchor.y !== lockPointerAnchor.y;
            lockPointerAnchor = anchor;
            // Locked motion reports relative deltas at a fixed cursor position. A changed
            // absolute position is a browser cursor warp, even when delivered much later.
            if (repositioned || performance.now() < lockLookReadyAt) return;
            look(e.movementX, e.movementY);
        });
        $('world').addEventListener('pointerdown', e => {
            if (phase !== 'playing') return;
            if (document.pointerLockElement === $('world')) { if (e.button === 0) { shootHeld = true; shoot(); } return; }
            if (e.pointerType !== 'touch' && !touchDevice && $('world').requestPointerLock) { captureMouse(); return; }
            if (orbitPointer !== null) return;
            $('world').focus({ preventScroll: true }); orbitPointer = e.pointerId; orbitX = e.clientX; orbitY = e.clientY; $('world').setPointerCapture(e.pointerId);
        });
        $('world').addEventListener('pointermove', e => {
            if (document.pointerLockElement !== $('world') && orbitPointer === e.pointerId) {
                look((e.clientX - orbitX) * 2.5, (e.clientY - orbitY) * 2.5); orbitX = e.clientX; orbitY = e.clientY;
            }
        });
        const endOrbit = e => { if (orbitPointer === e.pointerId) orbitPointer = null; };
        ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(event => $('world').addEventListener(event, endOrbit));
        function stickMove(e) {
            const rect = $('joystick').getBoundingClientRect(), radius = rect.width * 0.31;
            let x = (e.clientX - rect.left - rect.width / 2) / radius, y = (e.clientY - rect.top - rect.height / 2) / radius;
            const magnitude = Math.hypot(x, y); if (magnitude > 1) { x /= magnitude; y /= magnitude; }
            stick = { x: Math.abs(x) < 0.12 ? 0 : x, y: Math.abs(y) < 0.12 ? 0 : y };
            $('stick').style.transform = `translate(${x * radius}px, ${y * radius}px)`;
        }
        $('joystick').addEventListener('pointerdown', e => { if (phase !== 'playing' || joystickPointer !== null) return; e.preventDefault(); joystickPointer = e.pointerId; $('joystick').setPointerCapture(e.pointerId); stickMove(e); });
        $('joystick').addEventListener('pointermove', e => { if (e.pointerId === joystickPointer) { e.preventDefault(); stickMove(e); } });
        const endStick = e => { if (e.pointerId === joystickPointer) { joystickPointer = null; stick = { x: 0, y: 0 }; $('stick').style.transform = ''; } };
        ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(event => $('joystick').addEventListener(event, endStick));
        $('fire').addEventListener('pointerdown', e => { if (phase !== 'playing') return; e.preventDefault(); $('fire').setPointerCapture(e.pointerId); shootHeld = true; shoot(); });
        ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => $('fire').addEventListener(type, () => { shootHeld = false; }));
        document.addEventListener('pointerup', e => { if (e.button === 0) shootHeld = false; });
        $('world').addEventListener('contextmenu', e => { if (phase === 'playing') e.preventDefault(); });
        $('world').addEventListener('webglcontextlost', e => { e.preventDefault(); fail('The 3D view was interrupted. Reload to start a new maze.'); });
        for (const menu of [$('menu'), $('shop'), $('mapPanel')]) menu.addEventListener('keydown', e => {
            if (e.key !== 'Tab') return;
            const focusable = Array.from(menu.querySelectorAll('button, summary, a')).filter(el => !el.closest('.hidden') && !el.disabled);
            const first = focusable[0], last = focusable[focusable.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        });
        window.addEventListener('pagehide', () => { disposed = true; clearInput(); quietSound(); releaseMouse(); cancelAnimationFrame(frameId); });
        window.addEventListener('pageshow', e => { if (e.persisted) { disposed = false; lastTime = performance.now(); if (phase === 'playing') pause(); frameId = requestAnimationFrame(frame); } });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
})();
