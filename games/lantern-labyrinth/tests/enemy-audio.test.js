const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EnemyAudio, VOICES } = require('../enemy-audio.js');
function context() {
    const nodes = [];
    const param = () => ({ value: 0, setTargetAtTime(v) { this.value = v; }, setValueAtTime(v) { this.value = v; }, linearRampToValueAtTime(v) { this.value = v; }, exponentialRampToValueAtTime(v) { this.value = v; } });
    const node = kind => { const n = { kind, gain: param(), frequency: param(), Q: param(), pan: param(), playbackRate: param(), connect() {}, disconnect() { this.disconnected = true; }, start() {}, stop() { this.stopped = true; } }; nodes.push(n); return n; };
    return { sampleRate: 8000, createBuffer: (channels, length) => ({ getChannelData: () => new Float32Array(length) }), createBufferSource: () => node('source'), currentTime: 0, destination: {}, nodes, createGain: () => node('gain'), createBiquadFilter: () => node('filter'), createStereoPanner: () => node('pan'), createOscillator: () => node('oscillator') };
}
test('footsteps remain audible but muffled behind walls and pan with listener heading', () => {
    const ctx = context(), audio = new EnemyAudio(ctx), enemy = { id: 1, tier: 'hunter', x: 5, z: 0, health: 50 };
    let visible = true;
    const run = { enemies: [enemy], clearLine: () => visible }, listener = { x: 0, z: 0 };
    audio.call(enemy, listener, 0, run);
    assert.equal(ctx.nodes.filter(n => n.kind === 'source').length, 1);
    const filter = ctx.nodes.find(n => n.kind === 'filter'), gain = ctx.nodes.find(n => n.kind === 'gain'), pan = ctx.nodes.find(n => n.kind === 'pan');
    assert.equal(pan.pan.value, 1); const clearVolume = gain.gain.value;
    visible = false; audio.update(0, run, listener, Math.PI);
    assert.ok(gain.gain.value > 0 && gain.gain.value < clearVolume); assert.equal(filter.frequency.value, 450);
    assert.equal(pan.pan.value, -1);
    enemy.health = 0; audio.update(0, run, listener, 0); assert.equal(audio.voices.size, 0);
    assert.ok(ctx.nodes.filter(n => n.kind === 'source').every(n => n.stopped));
});
test('steps require movement, respect range and stagger, and stop on silence', () => {
    const ctx = context(), audio = new EnemyAudio(ctx), listener = { x: 0, z: 0 };
    const enemy = { id: 1, tier: 'guardian', x: 8, z: 0, health: 100, alert: 8 };
    const run = { enemies: [enemy], clearLine: () => true };
    for (let i = 0; i < 20; i++) audio.update(0.2, run, listener, 0);
    assert.equal(audio.voices.size, 0, 'awareness alone must not make sounds');
    for (let i = 0; i < 4; i++) { enemy.x += 0.4; audio.update(0.2, run, listener, 0); }
    assert.equal(audio.voices.size, 1);
    audio.silence(); assert.equal(audio.voices.size, 0); assert.equal(audio.steps.size, 0);
    enemy.stagger = 1;
    for (let i = 0; i < 8; i++) { enemy.x += 0.3; audio.update(0.2, run, listener, 0); }
    assert.equal(audio.voices.size, 0);
    enemy.stagger = 0; enemy.x = 100;
    for (let i = 0; i < 8; i++) { enemy.x += 0.3; audio.update(0.2, run, listener, 0); }
    assert.equal(audio.voices.size, 0);
    assert.ok(VOICES.guardian.pitch < VOICES.wanderer.pitch);
});

test('crowds have bounded sound overlap and completed samples disconnect', () => {
    const ctx = context(), audio = new EnemyAudio(ctx), listener = { x: 0, z: 0 };
    const run = { enemies: Array.from({ length: 20 }, (_, id) => ({ id, tier: 'wanderer', x: 4, z: 0, health: 25 })), clearLine: () => true };
    audio.update(0, run, listener, 0);
    for (let i = 0; i < 20; i++) {
        for (const enemy of run.enemies) enemy.z += 0.2;
        audio.update(0.2, run, listener, 0);
    }
    assert.equal(audio.voices.size, 3);
    const sources = ctx.nodes.filter(n => n.kind === 'source');
    sources[0].onended(); assert.equal(audio.voices.size, 2);
    assert.ok(sources[0].disconnected);
    audio.silence(); assert.equal(audio.voices.size, 0);
});
