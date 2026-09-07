/* Quiet, spatial movement sounds made from varied filtered noise. */
(function (root) {
    'use strict';
    const VOICES = {
        wanderer: { pitch: 1, range: 18, stride: 0.85, volume: 0.15 },
        hunter: { pitch: 1.2, range: 18, stride: 1, volume: 0.13 },
        sentinel: { pitch: 0.75, range: 22, stride: 1.15, volume: 0.2 },
        guardian: { pitch: 0.6, range: 26, stride: 1.4, volume: 0.24 }
    };
    class EnemyAudio {
        constructor(context) {
            this.context = context; this.voices = new Set(); this.steps = new Map(); this.gap = 0;
            // Different heel impacts and trailing scrapes avoid an obvious repeating sample.
            this.samples = Array.from({ length: 6 }, () => {
                const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * 0.3), context.sampleRate);
                const data = buffer.getChannelData(0); let low = 0;
                const scrape = 0.05 + Math.random() * 0.05;
                for (let i = 0; i < data.length; i++) {
                    const t = i / context.sampleRate, noise = Math.random() * 2 - 1;
                    low = low * 0.94 + noise * 0.06;
                    const heel = Math.min(1, t / 0.006) * Math.exp(-t * 48);
                    const drag = t > scrape ? Math.sin(Math.min(1, (t - scrape) / 0.2) * Math.PI) * Math.exp(-(t - scrape) * 12) : 0;
                    data[i] = low * 3 * heel + noise * 0.22 * drag;
                }
                return buffer;
            });
        }
        silence() {
            for (const voice of [...this.voices]) voice.stop();
            this.steps.clear(); this.gap = 0;
        }
        update(dt, run, player, yaw) {
            this.gap = Math.max(0, this.gap - dt);
            const living = new Map(run.enemies.filter(e => e.health > 0).map(e => [e.id, e]));
            for (const voice of [...this.voices]) {
                if (!living.has(voice.enemy.id)) voice.stop();
                else voice.position(player, yaw, run);
            }
            for (const id of this.steps.keys()) if (!living.has(id)) this.steps.delete(id);
            const nearby = [];
            for (const enemy of living.values()) {
                const spec = VOICES[enemy.tier], distance = Math.hypot(enemy.x - player.x, enemy.z - player.z);
                let step = this.steps.get(enemy.id);
                if (!step) { step = { x: enemy.x, z: enemy.z, walked: Math.random() * spec.stride * 0.5 }; this.steps.set(enemy.id, step); }
                const moved = Math.hypot(enemy.x - step.x, enemy.z - step.z);
                step.x = enemy.x; step.z = enemy.z;
                if (distance >= spec.range || moved > 2) { step.walked = 0; continue; }
                if (enemy.stagger > 0 || moved < 0.001) continue;
                step.walked += moved;
                if (step.walked >= spec.stride) nearby.push({ enemy, distance, step });
            }
            nearby.sort((a, b) => a.distance - b.distance);
            if (this.gap > 0 || this.voices.size >= 3 || !nearby.length) return;
            const { enemy, step } = nearby[0];
            this.call(enemy, player, yaw, run);
            step.walked = Math.random() * VOICES[enemy.tier].stride * 0.2;
            this.gap = 0.18;
        }
        call(enemy, player, yaw, run) {
            const context = this.context, spec = VOICES[enemy.tier], filter = context.createBiquadFilter(), gain = context.createGain();
            const panner = context.createStereoPanner ? context.createStereoPanner() : context.createGain();
            const source = context.createBufferSource();
            source.buffer = this.samples[Math.floor(Math.random() * this.samples.length)];
            source.playbackRate.value = spec.pitch * (0.88 + Math.random() * 0.24);
            const variation = 0.8 + Math.random() * 0.2;
            filter.type = 'lowpass'; filter.Q.value = 0.5;
            source.connect(filter); filter.connect(gain); gain.connect(panner); panner.connect(context.destination);
            let stopped = false;
            const voice = {
                enemy,
                position: (listener, heading, dungeon) => {
                    const dx = enemy.x - listener.x, dz = enemy.z - listener.z, distance = Math.hypot(dx, dz);
                    const clear = dungeon.clearLine(listener, enemy), attenuation = Math.max(0, 1 - distance / spec.range);
                    gain.gain.setTargetAtTime(spec.volume * variation * attenuation * (clear ? 1 : 0.5), context.currentTime, 0.025);
                    filter.frequency.setTargetAtTime(clear ? 1600 : 450, context.currentTime, 0.025);
                    if (panner.pan) panner.pan.setTargetAtTime(Math.max(-1, Math.min(1, (dx * Math.cos(heading) - dz * Math.sin(heading)) / Math.max(1, distance))), context.currentTime, 0.025);
                },
                stop: () => {
                    if (stopped) return; stopped = true;
                    try { source.stop(); } catch (_) {}
                    source.disconnect(); filter.disconnect(); gain.disconnect(); panner.disconnect(); this.voices.delete(voice);
                }
            };
            gain.gain.value = 0; voice.position(player, yaw, run); this.voices.add(voice);
            source.onended = voice.stop; source.start();
        }
    }
    if (typeof module !== 'undefined' && module.exports) module.exports = { EnemyAudio, VOICES };
    else root.EnemyAudio = EnemyAudio;
})(typeof globalThis !== 'undefined' ? globalThis : this);
