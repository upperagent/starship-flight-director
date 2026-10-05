'use strict';
// Exercise the real Three.js geometry and instance buffers without a WebGL renderer.
// Shader compilation and appearance still require the separate browser checks.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const THREE = require('../dist/assets/three.min.js');
const window = { THREE };
vm.runInNewContext(fs.readFileSync(require.resolve('../dist/failure-fx.js'), 'utf8'), { window }, { filename: 'failure-fx.js' });
const FailureFX = window.CinematicFailures;
const poolNames = ['fireballs', 'fire', 'smoke', 'embers', 'panels', 'struts', 'flashes', 'shocks', 'scorches'];
const flight = {
  phase: 'FLIGHT_ABORT', altitude: 900, downrange: 50, separated: true,
  booster: { phase: 'DESCENT', altitude: 450, downrange: -300 },
  capsule: { active: true, phase: 'DESCENT', altitude: 600, downrange: 200 }
};
let passed = 0;
function test(name, run) { run(); passed++; console.log('PASS ' + name); }
function create(quality = 'medium') {
  const host = { scene: new THREE.Scene(), quality, low: quality === 'low', destroyedBodies: new Set() };
  return new FailureFX(host);
}
function incident(id, body = 'ship', kind = 'impact', extra = {}) {
  return { id, body, kind, x: 20, y: kind === 'impact' ? 0 : 900, z: -15,
    speed: 250, fuel: body === 'capsule' ? 250 : 450000, vx: 25, vy: -120, attached: false, ...extra };
}
function assertPools(fx) {
  assert(fx.bursts.length <= fx.maxBursts, 'total burst limit');
  assert(fx.bursts.filter(b => !b.small).length <= fx.maxLarge, 'large burst limit');
  assert(fx.craters.length <= 6, 'persistent scar limit');
  for (const name of poolNames) {
    const mesh = fx[name], matrix = mesh.instanceMatrix;
    assert(Number.isInteger(mesh.count) && mesh.count >= 0, name + ' nonnegative integer count');
    assert(mesh.count <= matrix.count, name + ' cannot exceed allocated matrix capacity');
    for (let i = 0; i < mesh.count * 16; i++) assert(Number.isFinite(matrix.array[i]), name + ' finite matrix at ' + i);
    const attributes = mesh.geometry.attributes.aFx;
    if (attributes) {
      assert(mesh.count <= attributes.count, name + ' cannot exceed allocated effect attributes');
      for (let i = 0; i < mesh.count * 4; i++) assert(Number.isFinite(attributes.array[i]), name + ' finite effect attribute at ' + i);
    }
  }
  for (const light of fx.lights) {
    assert(Number.isFinite(light.intensity) && light.intensity >= 0, 'finite nonnegative lighting');
    assert(light.position.toArray().every(Number.isFinite), 'finite light position');
  }
}
function snapshot(fx) {
  // Exclude upload version counters: updating the same buffers while paused is allowed.
  return JSON.stringify({ clock: fx.clock, stats: fx.getStats(),
    bursts: fx.bursts.map(b => ({ id: b.id, age: b.age, origin: b.origin.toArray(),
      debris: b.debris.map(p => ({ position: p.position.toArray(), velocity: p.velocity.toArray(),
        rotation: p.rotation.toArray(), settled: p.settled, bounces: p.bounces })) })),
    pools: poolNames.map(name => { const m = fx[name]; return { count: m.count,
      matrices: Array.from(m.instanceMatrix.array.slice(0, m.count * 16)),
      attributes: Array.from(m.geometry.attributes.aFx?.array.slice(0, m.count * 4) || []) }; }),
    lights: fx.lights.map(l => [l.intensity, ...l.position.toArray()]) });
}
function advance(fx, seconds, state = flight) {
  const steps = Math.ceil(seconds / .05);
  for (let i = 0; i < steps; i++) fx.update(seconds / steps, state);
}

test('Every quality tier bounds five mixed bursts and reuses finite instance buffers', () => {
  for (const quality of ['low', 'medium', 'high']) {
    const fx = create(quality);
    const allocations = poolNames.map(name => [fx[name].instanceMatrix.array, fx[name].geometry, fx[name].material]);
    const resources = fx.resources.size;
    const cases = [incident(1), incident(2, 'booster', 'rupture', { y: 450 }),
      incident(3, 'capsule'), incident(4, 'ship', 'engine-failure'), incident(5, 'booster', 'engine-failure', { y: 450 })];
    cases.forEach(i => fx.trigger(i));
    assert.equal(fx.bursts.length, 5, quality + ' exercises all five simultaneous bursts');
    assert.equal(fx.bursts.filter(b => !b.small).length, 3);
    for (let i = 0; i < 250; i++) { fx.update(.05, flight); assertPools(fx); }
    for (let i = 0; i < poolNames.length; i++) {
      const mesh = fx[poolNames[i]];
      assert.equal(mesh.instanceMatrix.array, allocations[i][0], 'matrix storage must be reused');
      assert.equal(mesh.geometry, allocations[i][1], 'geometry must be reused');
      assert.equal(mesh.material, allocations[i][2], 'material must be reused');
    }
    assert.equal(fx.resources.size, resources, 'updates cannot accumulate GPU resources');
    // New impacts and small faults must safely evict old effects instead of overflowing.
    for (let id = 6; id <= 35; id++) {
      fx.trigger(incident(id, ['ship', 'booster', 'capsule'][id % 3], id % 4 ? 'impact' : 'engine-failure'));
      fx.update(.1, flight); assertPools(fx);
    }
    assert.equal(fx.craters.length, 6);
    fx.dispose();
  }
});

test('Duplicate or missing incident IDs cannot spawn a second blast', () => {
  const fx = create(), input = incident('dedupe');
  const first = fx.trigger(input), before = snapshot(fx);
  assert(first); assert.equal(fx.trigger({ ...input, x: 9000, fuel: 0 }), null);
  assert.equal(fx.trigger(null), null); assert.equal(fx.trigger({ body: 'ship' }), null);
  assert.equal(snapshot(fx), before, 'duplicates preserve all active render data');
  input.x = 12345; input.y = 34567;
  assert.equal(first.origin.x, 20, 'incident location must be copied');
  assert.equal(first.origin.y, 0);
  fx.dispose();
});

test('Changing quality during five live bursts preserves state and buffer capacities', () => {
  const fx = create('high');
  const arrays = poolNames.map(name => fx[name].instanceMatrix.array), resources = fx.resources.size;
  [incident(1), incident(2, 'booster', 'rupture', { y: 450 }), incident(3, 'capsule'),
    incident(4, 'ship', 'engine-failure'), incident(5, 'booster', 'engine-failure', { y: 450 })].forEach(i => fx.trigger(i));
  advance(fx, 1);
  const time = fx.clock, highParticles = fx.getStats().particles;
  const debrisBefore = JSON.stringify(fx.bursts.map(b => b.debris.map(p => p.position.toArray())));
  fx.setQuality('low'); fx.update(0, flight);
  assert.equal(fx.clock, time, 'changing quality cannot advance the effect');
  assert.equal(fx.bursts.length, 5, 'quality changes cannot reset active bursts');
  assert(fx.getStats().particles < highParticles, 'performance quality reduces emitted particles');
  assert.equal(JSON.stringify(fx.bursts.map(b => b.debris.map(p => p.position.toArray()))), debrisBefore,
    'quality changes cannot reposition flying debris');
  assertPools(fx);
  fx.setQuality('high'); fx.update(0, flight);
  assert.equal(fx.getStats().particles, highParticles, 'high quality restores detail');
  for (let i = 0; i < 60; i++) {
    fx.setQuality(['low', 'high', 'medium'][i % 3]);
    fx.update(.05, flight); assertPools(fx);
  }
  for (let i = 0; i < poolNames.length; i++) assert.equal(fx[poolNames[i]].instanceMatrix.array, arrays[i],
    'quality changes cannot churn instance allocations');
  assert.equal(fx.resources.size, resources);
  fx.dispose();
});

test('Equal incidents and timesteps produce identical effects, and pause freezes them', () => {
  const a = create(), b = create();
  for (const fx of [a, b]) {
    fx.trigger(incident(17)); fx.trigger(incident(18, 'booster', 'engine-failure', { y: 450 }));
    advance(fx, 1.25);
  }
  assert.equal(snapshot(a), snapshot(b), 'effects use deterministic incident seeds');
  const before = snapshot(a), camera = new THREE.PerspectiveCamera(); camera.position.set(150, 80, 200);
  const impulse = a.getCameraImpulse(camera, 'ship').toArray(), flash = a.getFlash(camera);
  for (let i = 0; i < 100; i++) a.update(0, flight);
  assert.equal(snapshot(a), before, 'paused updates cannot age particles, debris or lighting');
  assert.deepEqual(a.getCameraImpulse(camera, 'ship').toArray(), impulse);
  assert.equal(a.getFlash(camera), flash);
  a.update(-1, flight); a.update(NaN, flight);
  assert.equal(snapshot(a), before, 'invalid or negative deltas must not advance effects');
  a.update(.05, flight); assert.notEqual(snapshot(a), before, 'resume advances effects again');
  a.dispose(); b.dispose();
});

test('Debris loses upward velocity, falls, bounces and settles on the ground', () => {
  const fx = create(), blast = fx.trigger(incident(51, 'capsule', 'impact', { fuel: 0, speed: 80 }));
  const initialVertical = blast.debris.map(p => p.velocity.y);
  assert(initialVertical.every(v => v > 0), 'blast launches debris upward');
  fx.update(.05, flight);
  blast.debris.forEach((p, i) => assert(p.velocity.y < initialVertical[i], 'gravity reduces upward motion'));
  advance(fx, 24);
  assert.equal(fx.bursts.length, 1, 'check settled debris before burst expiration');
  for (const piece of blast.debris) {
    assert(piece.settled, 'debris settles after its ballistic flight');
    assert(piece.bounces > 0, 'ground contact precedes settling');
    assert.equal(piece.position.y, piece.size * .2, 'debris remains above the ground');
    assert.equal(piece.velocity.length(), 0, 'settled debris has no residual velocity');
  }
  assertPools(fx);
  advance(fx, 12);
  assert.equal(fx.bursts.length, 0, 'expired bursts release their slots');
  for (const name of poolNames.filter(n => n !== 'scorches')) assert.equal(fx[name].count, 0, name + ' expires');
  assert.equal(fx.scorches.count, 1, 'ground scar persists until mission reset');
  assert(fx.lights.every(l => l.intensity === 0));
  fx.dispose();
});

test('Each camera frames its own incident and detached capsule avoids stack framing', () => {
  const fx = create();
  fx.trigger(incident(71, 'ship', 'rupture', { x: 100, y: 900, attached: true }));
  fx.update(.5, { ...flight, separated: false, capsule: { active: false } });
  assert.equal(fx.getFraming('ship').body, 'ship');
  assert.equal(fx.getFraming('booster').body, 'ship', 'attached booster shares the stack blast');
  assert.equal(fx.getFraming('capsule').body, 'ship', 'stowed capsule shares the stack blast');
  fx.update(0, flight);
  assert.equal(fx.getFraming('capsule'), null, 'escaped capsule must not follow its parent explosion');
  fx.trigger(incident(72, 'capsule', 'impact', { x: 2000 }));
  assert.equal(fx.getFraming('capsule').body, 'capsule');
  assert.equal(fx.getFraming('capsule').center.x, 2000);
  assert.equal(fx.getFraming('ship').center.x, 100, 'independent cameras retain independent incidents');
  advance(fx, 11);
  assert.equal(fx.getFraming('ship'), null, 'cinematic framing returns control after its duration');
  fx.dispose();
});

test('Reset clears mission effects and permits reuse of the same incident IDs', () => {
  const fx = create(), input = incident(1);
  fx.trigger(input); advance(fx, 2); fx.reset();
  assert.equal(fx.clock, 0); assert.equal(fx.flash, 0); assert.equal(fx.seen.size, 0);
  assert.equal(fx.bursts.length, 0); assert.equal(fx.craters.length, 0);
  for (const name of poolNames) assert.equal(fx[name].count, 0, name + ' reset');
  assert(fx.lights.every(l => l.intensity === 0));
  assert.equal(fx.getFraming('ship'), null);
  assert(fx.trigger(input), 'new mission may reuse incident IDs');
  assertPools(fx); fx.dispose();
});

test('Disposal detaches the scene root and releases every geometry/material exactly once', () => {
  const fx = create(), root = fx.root, resources = Array.from(fx.resources), disposed = new Map();
  for (const resource of resources) resource.addEventListener('dispose', () => disposed.set(resource, (disposed.get(resource) || 0) + 1));
  fx.trigger(incident(91)); fx.update(.1, flight);
  assert.equal(root.parent, fx.host.scene);
  fx.dispose();
  assert.equal(root.parent, null); assert.equal(fx.resources.size, 0);
  assert.equal(disposed.size, resources.length);
  for (const resource of resources) assert.equal(disposed.get(resource), 1);
  fx.dispose();
  for (const resource of resources) assert.equal(disposed.get(resource), 1, 'repeat disposal is harmless');
});

console.log('\n' + passed + ' cinematic-failure effect groups passed.');
