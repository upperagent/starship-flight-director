const assert = require('node:assert/strict');
const Sim = require('../dist/simulation.js');
let passed = 0;
function ready(s = new Sim()) {
  for (const k of Object.keys(s.state.systems)) s.setSystem(k, true);
  for (const k of Sim.STATIONS) s.vote(k, 'GO');
  assert.equal(s.state.readiness.ready, true); return s;
}
function test(name, fn) { fn(); passed++; console.log('PASS', name); }
function flyTo(s, t) { s.tick(t - s.state.time + 0.1); }
test('Incomplete checklist cannot launch; GO requires every station', () => {
  const s = new Sim(); assert.equal(s.startCountdown().ok, false); assert.equal(s.state.phase, 'PREFLIGHT');
  ready(s); s.vote('RANGE', 'NO GO'); assert.equal(s.startCountdown().ok, false);
  s.vote('RANGE', 'GO'); assert.equal(s.startCountdown().ok, true);
});
test('Environmental, propellant, throttle, pitch and fault interlocks reject launch', () => {
  for (const [k, v] of [['wind', 20], ['weather', 'storm'], ['propellant', 90], ['throttle', 0.4]]) {
    const s = ready(); s.configure(k, v); assert.equal(s.startCountdown().ok, false);
  }
  const s = ready(); s.configure('autopilot', false); s.configure('manualPitch', 20); assert.equal(s.startCountdown().ok, false);
  const f = ready(); f.setFault('engineOut'); assert.equal(f.startCountdown().ok, false);
});
test('Hold stops mission clock and resume requires restored gates', () => {
  const s = ready(); s.startCountdown(); s.tick(20); const t = s.state.time;
  s.hold(); s.tick(20); assert.equal(s.state.time, t); s.setSystem('range', false); assert.equal(s.resume().ok, false);
  s.setSystem('range', true); assert.equal(s.resume().ok, true); s.tick(1); assert(s.state.time > t);
});
test('Late NO GO produces automatic T-10 hold; ignition veto safes pad', () => {
  const s = ready(); s.startCountdown(); s.tick(100); s.vote('WEATHER', 'NO GO'); s.tick(20);
  assert.equal(s.state.phase, 'HOLD'); assert.equal(s.state.time, -10);
  s.vote('WEATHER', 'GO'); s.resume(); s.tick(8); assert.equal(s.state.phase, 'IGNITION');
  s.setSystem('pressurization', false); assert.equal(s.state.phase, 'ABORTED'); assert.equal(s.state.thrust, 0); assert.equal(s.state.altitude, 0);
});
test('Nominal physics reaches suborbital coast with staging and mass decrease', () => {
  const s = ready(); s.configure('recoveryMode', false); const initialMass = s.state.mass; s.startCountdown();
  let lowestFuel = Infinity;
  for (let i = 0; i < 900 && s.state.phase !== 'COMPLETE'; i++) {
    s.tick(1); const z = s.state;
    for (const k of ['altitude', 'velocity', 'mass', 'thrust', 'gForce', 'dynamicPressure']) assert(Number.isFinite(z[k]), k);
    assert(z.boosterFuel >= 0); assert(z.shipFuel >= 0); assert(z.activeEngines <= 39);
    assert(z.boosterFuel + z.shipFuel <= lowestFuel + 1e-6); lowestFuel = z.boosterFuel + z.shipFuel;
    if (z.phase === 'SHIP_ASCENT') { assert(z.mass < initialMass); assert.equal(z.booster.separated, true); assert.equal(z.boosterEngines, 0); }
  }
  assert.equal(s.state.phase, 'COMPLETE'); assert.equal(s.state.outcome, 'SUBORBITAL ASCENT COMPLETE');
  assert(s.state.maxAltitude > 100000 && s.state.maxAltitude < 250000); assert(s.state.velocity > 6000 && s.state.velocity < 7000);
  assert(s.state.maxQ > 20000 && s.state.maxQ < 60000); assert.equal(s.state.activeEngines, 0);
  for (const k of ['ignition', 'liftoff', 'towerclear', 'supersonic', 'maxq', 'meco', 'hotstage', 'separation', 'space', 'seco', 'complete']) assert(k in s.state.milestones, k);
  console.log('  Nominal:', JSON.stringify({ time: s.state.time, apogeeSoFarM: s.state.maxAltitude, altitudeM: s.state.altitude, velocityMps: s.state.velocity, maxQPa: s.state.maxQ }));
});
test('Time-step stability at 0.02, 1 and 10 second playback deltas', () => {
  const run = dt => { const s = ready(); s.configure('recoveryMode', false); s.startCountdown(); let elapsed = 0; while (elapsed < 320 - 1e-9) { const h = Math.min(dt, 320 - elapsed); s.tick(h); elapsed += h; } return s.state; };
  const a = run(0.02), b = run(1), c = run(10);
  for (const z of [b, c]) { assert(Math.abs(a.altitude - z.altitude) / a.altitude < 0.002); assert(Math.abs(a.velocity - z.velocity) / a.velocity < 0.002); assert(Math.abs(a.shipFuel - z.shipFuel) / a.shipFuel < 0.003); }
});
test('Pad abort is inert; flight abort cuts thrust and remains ballistic', () => {
  const a = ready(); a.startCountdown(); a.tick(100); a.abort(); a.tick(100); assert.equal(a.state.altitude, 0); assert.equal(a.state.phase, 'ABORTED');
  const b = ready(); b.startCountdown(); b.tick(150); const h = b.state.altitude; b.abort(); b.tick(1);
  assert.equal(b.state.phase, 'FLIGHT_ABORT'); assert.equal(b.state.thrust, 0); assert.equal(b.state.activeEngines, 0); assert(b.state.altitude > h);
  b.tick(600); assert.equal(b.state.phase, 'ABORTED'); assert.equal(b.state.altitude, 0);
});
test('Engine-out fault changes thrust and active count; critical fault aborts', () => {
  const a = ready(); a.startCountdown(); a.tick(150); a.setFault('engineOut'); a.tick(0.05); assert.equal(a.state.boosterEngines, 32); assert.equal(a.state.engineStatus.booster.filter(v => v === 'OFFLINE').length, 1);
  a.clearFault(); a.tick(0.05); assert.equal(a.state.boosterEngines, 33);
  a.setFault('pressureDrop'); assert.equal(a.state.phase, 'FLIGHT_ABORT'); assert.equal(a.state.thrust, 0);
});
test('Capsule is enabled by default; finite motor burns then ballistic descent impacts without a chute', () => {
  const a = new Sim(); assert.equal(a.state.config.trainingCapsule, true); assert.equal(a.eject().ok, true); assert.equal(a.eject().ok, false);
  a.tick(1); assert(a.state.capsule.thrust > 0); assert(a.state.capsule.gForce > 4 && a.state.capsule.gForce < 6); assert(a.state.capsule.verticalVelocity > 0); const fuel = a.state.capsule.fuel;
  a.tick(3); assert.equal(a.state.capsule.thrust, 0); assert(Number.isFinite(a.state.capsule.gForce) && a.state.capsule.gForce >= 0); assert(a.state.capsule.fuel < fuel); assert(a.state.capsule.fuel >= 0);
  const v = a.state.capsule.verticalVelocity; a.tick(1); assert(a.state.capsule.verticalVelocity < v, 'Gravity reduces vertical speed after burnout');
  a.tick(300); assert.equal(a.state.capsule.phase, 'IMPACT'); assert.equal(a.state.capsule.parachute, false); assert(a.state.capsule.touchdownSpeed > 12);
});
test('Manual parachute command arms during boost, inflates on descent and recovers after parent pad abort', () => {
  const a = new Sim(); assert.equal(a.deployParachute().ok, false); a.eject(); assert.equal(a.state.phase, 'ABORTED');
  assert.equal(a.deployParachute().ok, true); a.tick(1); assert.equal(a.state.capsule.parachute, false);
  let partialInflation = false;
  for (let i = 0; i < 3000 && a.state.capsule.phase !== 'LANDED'; i++) { a.tick(0.1); const c = a.state.capsule; assert(Number.isFinite(c.gForce) && c.gForce >= 0); if (c.parachuteInflation > 0 && c.parachuteInflation < 1) partialInflation = true; }
  assert(partialInflation); assert.equal(a.state.capsule.phase, 'LANDED'); assert.equal(a.state.capsule.parachuteInflation, 1); assert.equal(a.state.capsule.gForce, 1);
  assert(a.state.capsule.touchdownSpeed < 12); assert.equal(a.state.outcome, 'TRAINING CAPSULE RECOVERED'); assert(a.state.capsule.elapsed > 20);
});
test('Escape works in launch, space coast, return and after tower catch; hardware can be enabled in flight', () => {
  for (const t of [0, 40, 150, 225, 400, 580]) {
    const s = ready(); s.configure('trainingCapsule', false); s.startCountdown(); s.tick(t + 120);
    assert.equal(s.configure('trainingCapsule', true).ok, true); assert.equal(s.eject().ok, true, 'Escape at T+' + t);
    assert.equal(s.deployParachute().ok, true); s.tick(1800);
    assert.equal(s.state.capsule.phase, 'LANDED', 'Recovery from T+' + t); assert(s.state.capsule.touchdownSpeed < 12);
  }
  const s = ready(); s.startCountdown(); s.tick(220); assert.equal(s.configure('propellant', 100).ok, false); assert.equal(s.configure('payload', 100).ok, false); assert.equal(s.configure('recoveryMode', false).ok, false);
});
test('Default space-height recovery integrates booster landing and launch tower capture with finite fuel', () => {
  const s = ready(); s.startCountdown(); let fuel = Infinity, previous = null, sawBoosterThrust = false, sawShipReturnThrust = false;
  for (let i = 0; i < 12000 && s.state.phase !== 'COMPLETE'; i++) {
    s.tick(0.1); const z = s.state, b = z.booster;
    for (const k of ['altitude', 'velocity', 'mass', 'thrust', 'gForce', 'dynamicPressure', 'downrange']) assert(Number.isFinite(z[k]), k);
    assert(z.boosterFuel >= 0 && z.shipFuel >= 0); assert(z.boosterFuel + z.shipFuel <= fuel + 1e-5); fuel = z.boosterFuel + z.shipFuel;
    if (b.separated) { assert(b.thrust <= 31.5e6 + 1); assert(b.activeEngines <= 13); if (b.thrust > 0) sawBoosterThrust = true; assert.equal(z.engineStatus.booster.filter(x => x === 'RUNNING').length, b.activeEngines); }
    if (['SHIP_RETURN', 'TOWER_APPROACH'].includes(z.phase)) { assert(z.thrust <= 14.7e6 + 1); if (z.thrust > 0) sawShipReturnThrust = true; }
    // Integrated positions must remain continuous across staging, coast and capture.
    if (previous) assert(Math.abs(z.altitude - previous.altitude) < Math.max(10, previous.velocity * 0.15));
    previous = { altitude: z.altitude, velocity: z.velocity };
  }
  const z = s.state;
  assert.equal(z.phase, 'COMPLETE'); assert.equal(z.recovery.caught, true); assert.equal(z.recovery.catchProgress, 1);
  assert.equal(z.altitude, 75); assert(Math.abs(z.downrange) < 12); assert(z.recovery.touchdownSpeed < 3);
  assert.equal(z.booster.phase, 'LANDED'); assert(Math.abs(z.booster.downrange + 360) < 16); assert(z.booster.touchdownSpeed < 4);
  assert(z.maxAltitude > 100000 && z.maxAltitude < 130000); assert(z.shipFuel > 0); assert(z.boosterFuel > 0);
  assert(sawBoosterThrust && sawShipReturnThrust); assert('space' in z.milestones); assert('shipCaught' in z.milestones); assert('boosterdown' in z.milestones);
  console.log('  Recovery:', JSON.stringify({ time: z.time, apogeeM: z.maxAltitude, shipTouchdownMps: z.recovery.touchdownSpeed, boosterTouchdownMps: z.booster.touchdownSpeed, shipReserveKg: z.shipFuel, boosterReserveKg: z.boosterFuel }));
});
test('Early return and supported payload/throttle limits retain integrated recoveries', () => {
  for (const config of [{ early: 20 }, { payload: 0 }, { payload: 150000 }, { throttle: 0.85 }, { propellant: 95 }]) {
    const s = ready(); for (const [k, v] of Object.entries(config)) if (k !== 'early') s.configure(k, v);
    s.startCountdown(); if (config.early) { s.tick(config.early + 120); assert.equal(s.requestReturn().ok, true); }
    s.tick(1000); assert.equal(s.state.recovery.caught, true, JSON.stringify(config)); assert.equal(s.state.booster.phase, 'LANDED', JSON.stringify(config));
  }
});
test('Return gravity persists after propellant exhaustion; guidance cannot create fuel or thrust', () => {
  const s = ready(); s.startCountdown(); s.tick(400); assert(s.state.separated);
  s.state.shipFuel = 0; s.state.booster.fuel = 0; const vy = s.state.verticalVelocity;
  s.tick(0.1); assert.equal(s.state.thrust, 0); assert.equal(s.state.booster.thrust, 0); assert.equal(s.state.shipFuel, 0); assert.equal(s.state.booster.fuel, 0); assert(s.state.verticalVelocity < vy);
  s.tick(1000); assert.equal(s.state.recovery.caught, false); assert.equal(s.state.recovery.phase, 'IMPACT');
});
test('Recovery time-step stability at 0.02, 1 and 25 second playback deltas', () => {
  const run = dt => { const s = ready(); s.startCountdown(); let elapsed = 0; while (elapsed < 820 - 1e-9) { const h = Math.min(dt, 820 - elapsed); s.tick(h); elapsed += h; } return s.state; };
  const a = run(0.02), b = run(1), c = run(25);
  for (const z of [a, b, c]) { assert.equal(z.recovery.caught, true); assert.equal(z.booster.phase, 'LANDED'); assert(z.recovery.touchdownSpeed < 3); assert(z.booster.touchdownSpeed < 4); }
  for (const z of [b, c]) { assert(Math.abs(a.maxAltitude - z.maxAltitude) / a.maxAltitude < 0.003); assert(Math.abs(a.shipFuel - z.shipFuel) / a.shipFuel < 0.01); }
});
test('Reset retains public state reference and restores every mission system', () => {
  const s = ready(), state = s.state; s.startCountdown(); s.tick(150); s.setFault('engineOut'); s.abort(); s.reset();
  assert.equal(s.state, state); assert.equal(state.phase, 'PREFLIGHT'); assert.equal(state.fault, null); assert.equal(state.time, -120); assert.equal(state.boosterFuel, 3400000); assert.equal(state.events.length, 1);
});
test('Invalid numeric input leaves physics finite', () => {
  const s = new Sim(); s.tick(NaN); s.tick(-1); s.tick(Infinity); assert.equal(s.state.elapsed, 0); assert.equal(s.configure('payload', NaN).ok, false); assert.equal(s.configure('unknown', 1).ok, false);
});
test('Impact records preserve pre-contact speed, fuel and kinematics without mutating physics', () => {
  const s = ready(); s.startCountdown(); s.tick(150); s.abort(); s.tick(600);
  assert.equal(s.state.phase, 'ABORTED'); assert.equal(s.state.velocity, 0);
  const hits = s.state.incidents.filter(i => i.kind === 'impact'); assert.equal(hits.length, 1);
  const hit = hits[0]; assert.equal(hit.body, 'ship'); assert.equal(hit.attached, true); assert.equal(hit.y, 0);
  assert(hit.speed > 20); assert(hit.vy < 0); assert(hit.fuel > 0); assert.equal(hit.mass, hit.fuel + 320000 + s.state.config.payload);
  assert(Object.isFrozen(hit)); const record = JSON.stringify(hit);
  for (const key of ['id', 'time', 'elapsed', 'x', 'y', 'speed', 'fuel', 'mass', 'vx', 'vy', 'pitch', 'stage']) assert(Number.isFinite(hit[key]), key);
  s.state.downrange += 100; s.state.shipFuel = 0; s.tick(200); assert.equal(JSON.stringify(hit), record); assert.equal(s.state.incidents.length, 1);
});
test('Three independent impacts in one integration step produce three immutable incidents exactly once', () => {
  const s = new Sim(), z = s.state;
  Object.assign(z, { phase: 'FLIGHT_ABORT', time: 30, stage: 2, separated: true, altitude: 0.1, maxAltitude: 10000,
    downrange: 120, verticalVelocity: -120, horizontalVelocity: 15, velocity: 121, shipFuel: 0 });
  Object.assign(z.booster, { separated: true, phase: 'ENTRY', altitude: 0.1, downrange: -360,
    verticalVelocity: -90, horizontalVelocity: -8, velocity: 91, pitch: 90, fuel: 0 });
  Object.assign(z.capsule, { active: true, phase: 'DESCENT', altitude: 0.1, downrange: 800,
    verticalVelocity: -60, horizontalVelocity: 3, velocity: 61, fuel: 0, parachute: false });
  s.tick(0.05);
  assert.deepEqual(z.incidents.map(i => i.body), ['ship', 'booster', 'capsule']);
  assert.deepEqual(z.incidents.map(i => i.id), [1, 2, 3]); assert(z.incidents.every(i => i.kind === 'impact' && i.y === 0 && i.speed > 50));
  assert(z.incidents.every(i => i.elapsed === z.incidents[0].elapsed)); assert(z.incidents.every(Object.isFrozen));
  const records = JSON.stringify(z.incidents); s.tick(100); assert.equal(JSON.stringify(z.incidents), records);
  assert.equal(z.recovery.caught, false); assert.equal(z.booster.phase, 'IMPACT'); assert.equal(z.capsule.phase, 'IMPACT');
});
test('Safe pad safing, tower capture, booster landing and parachute recovery do not explode', () => {
  for (const fault of ['engineOut', 'pressureDrop', 'structuralBreakup', 'guidanceFailure']) {
    const s = ready(); s.startCountdown(); s.tick(118); assert.equal(s.state.phase, 'IGNITION');
    s.setFault(fault); s.tick(10); assert.equal(s.state.phase, 'ABORTED'); assert.equal(s.state.incidents.length, 0, fault);
  }
  const recovered = ready(); recovered.startCountdown(); recovered.tick(1000);
  assert.equal(recovered.state.recovery.caught, true); assert.equal(recovered.state.booster.phase, 'LANDED'); assert.equal(recovered.state.incidents.length, 0);
  const capsule = new Sim(); capsule.eject(); capsule.deployParachute(); capsule.tick(300);
  assert.equal(capsule.state.capsule.phase, 'LANDED'); assert.equal(capsule.state.incidents.length, 0);
});
test('Airborne faults emit once per injection, use the affected stage, and retain existing abort behavior', () => {
  const s = ready(); s.startCountdown(); s.tick(150); s.setFault('engineOut');
  assert.equal(s.state.phase, 'ASCENT'); assert.equal(s.state.incidents.length, 1);
  assert.equal(s.state.incidents[0].body, 'booster'); assert.equal(s.state.incidents[0].kind, 'engine-failure'); assert.equal(s.state.incidents[0].attached, true);
  s.setFault('engineOut'); s.tick(0.1); assert.equal(s.state.incidents.length, 1); assert.equal(s.state.boosterEngines, 32);
  s.clearFault(); s.tick(75); assert.equal(s.state.stage, 2); s.setFault('engineOut');
  assert.equal(s.state.incidents.length, 2); assert.equal(s.state.incidents[1].body, 'ship'); assert.equal(s.state.incidents[1].attached, false);
  s.clearFault(); const before = { x: s.state.downrange, y: s.state.altitude, speed: s.state.velocity }; s.setFault('pressureDrop');
  assert.equal(s.state.phase, 'FLIGHT_ABORT'); assert.equal(s.state.thrust, 0);
  const rupture = s.state.incidents.at(-1); assert.equal(rupture.kind, 'rupture'); assert.equal(rupture.x, before.x); assert.equal(rupture.y, before.y); assert.equal(rupture.speed, before.speed);
  s.setFault('pressureDrop'); assert.equal(s.state.incidents.length, 3);
  const breakup = ready(); breakup.startCountdown(); breakup.tick(145); breakup.setFault('structuralBreakup');
  assert.equal(breakup.state.phase, 'FLIGHT_ABORT'); assert.equal(breakup.state.incidents.length, 1); assert.equal(breakup.state.incidents[0].kind, 'rupture');
  const guidance = ready(); guidance.startCountdown(); guidance.tick(145); guidance.setFault('guidanceFailure');
  assert.equal(guidance.state.phase, 'FLIGHT_ABORT'); assert.equal(guidance.state.incidents.length, 0); guidance.tick(600);
  assert.equal(guidance.state.incidents.length, 1); assert.equal(guidance.state.incidents[0].kind, 'impact');
});
test('Excess structural load emits one rupture at the current stack or ship position before ballistic impact', () => {
  // A sustained horizontal pitch command can exceed the existing load envelope
  // both before and after staging; exercise the real guidance/physics path.
  for (const turnAt of [5, 25]) {
    const s = ready(); s.startCountdown(); s.tick(120 + turnAt);
    s.configure('autopilot', false); s.configure('manualPitch', 0);
    for (let i = 0; i < 150 && s.state.phase !== 'FLIGHT_ABORT'; i++) s.tick(1);
    const z = s.state, rupture = z.incidents[0];
    assert.equal(z.phase, 'FLIGHT_ABORT'); assert.equal(z.abortReason, 'Structural load envelope exceeded');
    assert.equal(z.thrust, 0); assert.equal(z.activeEngines, 0); assert.equal(z.incidents.length, 1);
    assert.equal(rupture.body, 'ship'); assert.equal(rupture.kind, 'rupture'); assert(rupture.y > 1000);
    assert(rupture.speed > 500); assert.equal(rupture.attached, turnAt === 5); assert.equal(rupture.stage, turnAt === 5 ? 1 : 2);
    assert.equal(rupture.fuel, z.shipFuel + (rupture.attached ? z.boosterFuel : 0));
    assert.equal(rupture.mass, rupture.fuel + 120000 + z.config.payload + (rupture.attached ? 200000 : 0));
    const record = JSON.stringify(rupture); s.tick(600);
    assert.equal(z.incidents.filter(i => i.kind === 'rupture').length, 1);
    assert.equal(z.incidents.filter(i => i.kind === 'impact' && i.body === 'ship').length, 1);
    assert.equal(JSON.stringify(rupture), record);
  }
});
test('Completed and safed vehicle scenarios reject new faults without altering incidents or terminal telemetry', () => {
  const safed = ready(); safed.startCountdown(); safed.tick(100); safed.abort();
  const captured = ready(); captured.startCountdown(); captured.tick(1000);
  const lost = ready(); lost.startCountdown(); lost.tick(150); lost.abort(); lost.tick(600);
  assert.equal(captured.state.recovery.caught, true); assert(lost.state.outcome.includes('VEHICLE LOST'));
  for (const s of [safed, captured, lost]) {
    const record = JSON.stringify(s.state);
    for (const fault of Object.keys(Sim.FAULTS)) assert.equal(s.setFault(fault).ok, false, s.state.phase + ': ' + fault);
    assert.equal(JSON.stringify(s.state), record);
  }
});
test('Incident history is bounded, IDs stay monotonic, and reset starts a fresh mission', () => {
  const s = ready(), state = s.state; s.startCountdown(); s.tick(150);
  for (let i = 0; i < 30; i++) { s.clearFault(); s.setFault('engineOut'); }
  assert.equal(state.incidents.length, 24); assert.deepEqual(state.incidents.map(i => i.id), Array.from({ length: 24 }, (_, i) => i + 7));
  const prior = state.incidents.at(-1); const record = JSON.stringify(prior); s.reset();
  assert.equal(s.state, state); assert.equal(state.incidents.length, 0); assert.equal(JSON.stringify(prior), record);
  s.eject(); s.tick(300); assert.equal(state.incidents.length, 1); assert.equal(state.incidents[0].id, 1); assert.equal(state.incidents[0].body, 'capsule');
});
test('Destructive ballistic splashdown emits an impact, while a soft water contact remains inert', () => {
  for (const [speed, expected] of [[80, 1], [0.5, 0]]) {
    const s = new Sim(); s.configure('recoveryMode', false);
    Object.assign(s.state.booster, { separated: true, phase: 'DESCENT', altitude: 0.001, downrange: 900,
      verticalVelocity: -speed, horizontalVelocity: 0, velocity: speed, pitch: 90, fuel: 5000 });
    s.tick(0.05); assert.equal(s.state.booster.phase, 'SPLASHDOWN'); assert.equal(s.state.incidents.length, expected);
    if (expected) { const hit = s.state.incidents[0]; assert.equal(hit.body, 'booster'); assert.equal(hit.kind, 'impact'); assert.equal(hit.speed, s.state.booster.touchdownSpeed); assert.equal(hit.fuel, 5000); assert.equal(hit.mass, 205000); }
  }
});
console.log(`\n${passed} physics and mission-control tests passed.`);
