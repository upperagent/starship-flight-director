/* Starship Launch Control — educational, deterministic two-dimensional flight model.
 * Browser: window.MissionSim. Node: require('./simulation.js').
 * All kinematics use SI units. Pitch is degrees above local horizon.
 * Configuration, thresholds and crew escape are training assumptions, not SpaceX procedures.
 */
(function (root) {
  'use strict';
  const G0 = 9.80665, R = 6371000, DEG = Math.PI / 180;
  const BP = 3400000, SP = 1200000, BD = 200000, SD = 120000;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const result = (ok, message) => ({ ok, message });
  const SYSTEMS = {
    avionics: 'Avionics on internal power', telemetry: 'Telemetry link verified',
    guidance: 'Guidance solution aligned', range: 'Launch corridor clear',
    deluge: 'Water deluge armed', engineChill: 'Raptor chilldown complete',
    pressurization: 'Tank pressurization ready', fts: 'Flight safety armed'
  };
  const STATIONS = ['FLIGHT', 'PROP', 'GNC', 'RANGE', 'WEATHER', 'CREW'];
  const FAULTS = {
    engineOut: 'Raptor engine out', telemetryLoss: 'Telemetry dropout',
    pressureDrop: 'Tank pressure loss', structuralBreakup: 'Structural breakup', guidanceFailure: 'Guidance fault', windShear: 'Wind shear'
  };
  const FAULT_ALIASES = { 'engine-out': 'engineOut', engine: 'engineOut', telemetry: 'telemetryLoss', pressure: 'pressureDrop', breakup: 'structuralBreakup', 'structural-breakup': 'structuralBreakup', guidance: 'guidanceFailure', wind: 'windShear' };
  const PAD = ['PREFLIGHT', 'COUNTDOWN', 'HOLD', 'IGNITION'];
  const FLYING = ['ASCENT', 'HOT_STAGING', 'SHIP_ASCENT', 'COAST', 'FLIGHT_ABORT', 'RETURN_COAST', 'SHIP_RETURN', 'TOWER_APPROACH'];

  class MissionSim {
    constructor(options) { this.onEvent = options && options.onEvent || null; this.reset(); }
    reset() {
      this._eventId = 0; this._incidentId = 0; this._faultIncidentId = 0; this._lastFaultIncidentKey = null; this._incidentKeys = new Set(); this._flags = {}; this._faultStage = 1; this._stageTime = 0;
      this._returnTime = 0; this._coastTime = 0; this._abortTime = 0; this._chillTime = 0; this._capsuleTime = 0;
      const fresh = {
        time: -120, elapsed: 0, phase: 'PREFLIGHT', stage: 1, separated: false,
        altitude: 0, velocity: 0, verticalVelocity: 0, horizontalVelocity: 0, downrange: 0,
        pitch: 90, targetPitch: 90, roll: 0, heading: 90,
        boosterFuel: BP, shipFuel: SP, boosterFuelPct: 100, shipFuelPct: 100, fuelPct: 100,
        mass: BP + SP + BD + SD + 100000, thrust: 0, acceleration: 0, verticalAcceleration: 0,
        gForce: 1, mach: 0, dynamicPressure: 0, maxQ: 0, maxAltitude: 0, maxVelocity: 0,
        activeEngines: 0, boosterEngines: 0, shipEngines: 0, engineLit: false, effectiveThrottle: 0,
        engineStatus: { booster: Array(33).fill('STANDBY'), ship: Array(6).fill('STANDBY') },
        config: { throttle: 1, manualPitch: 90, autopilot: true, wind: 6, payload: 100000,
          propellant: 100, trainingCapsule: true, recoveryMode: true, autoParachute: false, weather: 'clear', timeOfDay: 'dusk' },
        systems: { avionics: true, telemetry: true, guidance: true, range: true,
          deluge: false, engineChill: false, pressurization: false, fts: false },
        votes: Object.fromEntries(STATIONS.map(s => [s, 'PENDING'])),
        readiness: { ready: false, score: 0, blockers: [] },
        events: [], incidents: [], fault: null, abortReason: '', holdReason: '', outcome: '',
        atmosphere: { density: 1.225, pressure: 101325, temperature: 288.15 },
        capsule: { elapsed: 0, separatedAt: 0, touchdownAt: null, maxAltitude: 0, maxVelocity: 0, touchdownSpeed: 0, active: false, altitude: 136, downrange: 0, verticalVelocity: 0,
          horizontalVelocity: 0, velocity: 0, gForce: 1, phase: 'ATTACHED', parachute: false, parachuteRequested: false, parachuteInflation: 0, thrust: 0, fuel: 650, mass: 12000, pitch: 77.3 },
        booster: { separated: false, altitude: 0, downrange: 0, verticalVelocity: 0,
          horizontalVelocity: 0, velocity: 0, pitch: 90, thrust: 0, fuel: BP, phase: 'ATTACHED', activeEngines: 0, throttle: 0, touchdownSpeed: 0, targetDownrange: -360 },
        recovery: { enabled: true, phase: 'ASCENT', targetDownrange: 0, catchAltitude: 75, returnRequested: false, catchProgress: 0, caught: false, touchdownSpeed: 0 },
        milestones: {}, trajectory: [], missionDuration: 0
      };
      // Keep the public object identity stable so renderers can retain their reference.
      if (this.state) Object.assign(this.state, fresh); else this.state = fresh;
      this._updateReadiness();
      this._event('Simulation initialized. Flight director has the console.', 'info');
      return result(true, 'Mission reset to T−02:00.');
    }
    _event(message, level = 'info') {
      const event = { id: ++this._eventId, time: this.state.time, elapsed: this.state.elapsed, message, level };
      this.state.events.unshift(event); if (this.state.events.length > 120) this.state.events.pop();
      if (typeof this.onEvent === 'function') { try { this.onEvent(event, this.state); } catch (_) { /* UI callbacks must not stop physics. */ } }
      return event;
    }
    _incident(body, kind, key, ground = false) {
      const faultIncident = key.startsWith('fault:');
      if (faultIncident ? this._lastFaultIncidentKey === key : this._incidentKeys.has(key)) return null;
      if (faultIncident) this._lastFaultIncidentKey = key; else this._incidentKeys.add(key);
      const s = this.state, capsule = body === 'capsule', booster = body === 'booster';
      const source = capsule ? s.capsule : booster && s.booster.separated ? s.booster : s;
      const attached = capsule ? !s.capsule.active : booster ? !s.booster.separated : !s.separated;
      const fuel = capsule ? s.capsule.fuel : booster ? (attached ? s.boosterFuel : s.booster.fuel) : s.shipFuel + (attached ? s.boosterFuel : 0);
      const mass = capsule ? s.capsule.mass : booster ? BD + fuel : SD + s.config.payload + fuel + (attached ? BD : 0);
      // Capture contact/failure kinematics before safing code zeroes the live state.
      // Scalars and a frozen record keep later descent, recovery and reset from
      // moving an already-emitted fireball or changing its available energy.
      const incident = Object.freeze({ id: ++this._incidentId, body, kind, time: s.time, elapsed: s.elapsed,
        x: source.downrange, y: ground ? 0 : Math.max(0, source.altitude), speed: source.velocity,
        fuel, mass, vx: source.horizontalVelocity, vy: source.verticalVelocity, pitch: source.pitch,
        stage: capsule ? 0 : booster ? 1 : s.stage, attached });
      s.incidents.push(incident); if (s.incidents.length > 24) s.incidents.shift();
      return incident;
    }
    _once(key, message, level = 'info') {
      if (!this._flags[key]) { this._flags[key] = true; this.state.milestones[key] = this.state.time; this._event(message, level); }
    }
    configure(key, value) {
      const s = this.state;
      if (!(key in s.config)) return result(false, 'Unknown configuration: ' + key);
      const launchLocked = !['PREFLIGHT', 'COUNTDOWN', 'HOLD'].includes(s.phase) || s.time >= -8;
      if (launchLocked && ['payload', 'propellant', 'recoveryMode'].includes(key)) return result(false, 'Vehicle configuration is locked after terminal count. Reset to modify.');
      if (['autopilot', 'trainingCapsule', 'recoveryMode', 'autoParachute'].includes(key)) value = !!value;
      else if (key === 'weather') {
        if (!['clear', 'cloudy', 'storm'].includes(value)) return result(false, 'Choose clear, cloudy or storm weather.');
      } else if (key === 'timeOfDay') {
        if (!['dawn', 'day', 'dusk', 'night'].includes(value)) return result(false, 'Unknown lighting preset.');
      } else {
        value = Number(value); if (!Number.isFinite(value)) return result(false, 'Configuration must be a finite number.');
        const ranges = { throttle: [0.4, 1], manualPitch: [0, 90], wind: [0, 40], payload: [0, 150000], propellant: [50, 100] };
        value = clamp(value, ...ranges[key]);
      }
      s.config[key] = value;
      if (key === 'recoveryMode') s.recovery.enabled = value;
      if (key === 'propellant') { s.boosterFuel = BP * value / 100; s.shipFuel = SP * value / 100; }
      if (['payload', 'propellant'].includes(key)) this._massAndFuel();
      if (key === 'trainingCapsule') this._event(value ? 'Fictional crew escape module installed for training.' : 'Baseline Starship selected; fictional escape module removed.', 'info');
      if (key === 'autopilot') this._event(value ? 'Guidance autopilot engaged.' : 'Manual pitch authority transferred to commander.', 'info');
      this._updateReadiness(); this._guardChanges();
      return result(true, 'Configuration updated.');
    }
    setSystem(key, enabled) {
      const s = this.state;
      if (!(key in SYSTEMS)) return result(false, 'Unknown system: ' + key);
      s.systems[key] = !!enabled;
      this._event(SYSTEMS[key] + ': ' + (enabled ? 'READY' : 'NOT READY'), enabled ? 'success' : 'warning');
      this._updateReadiness(); this._guardChanges();
      return result(true, 'System updated.');
    }
    vote(station, value) {
      station = String(station).toUpperCase(); value = String(value).toUpperCase();
      if (!STATIONS.includes(station) || !['GO', 'NO GO', 'PENDING'].includes(value)) return result(false, 'Invalid station or vote.');
      this.state.votes[station] = value;
      this._event(station + ': ' + value, value === 'GO' ? 'success' : 'warning');
      this._updateReadiness(); this._guardChanges();
      return result(true, station + ' is ' + value + '.');
    }
    _updateReadiness() {
      const s = this.state, checks = [];
      for (const [key, label] of Object.entries(SYSTEMS)) checks.push([s.systems[key], label]);
      for (const station of STATIONS) checks.push([s.votes[station] === 'GO', station + ' vote is ' + s.votes[station]]);
      checks.push([s.config.propellant >= 95, 'Propellant load below 95% training minimum']);
      checks.push([s.config.throttle >= 0.85, 'Liftoff throttle must be at least 85%']);
      checks.push([s.config.wind <= 15 && s.config.weather !== 'storm' && s.fault !== 'windShear', 'Weather exceeds training launch limits']);
      checks.push([!s.fault, s.fault ? FAULTS[s.fault] + ' unresolved' : 'All systems nominal']);
      checks.push([s.config.autopilot || s.config.manualPitch >= 85, 'Manual liftoff pitch must be at least 85°']);
      const blockers = checks.filter(c => !c[0]).map(c => c[1]);
      Object.assign(s.readiness, { ready: blockers.length === 0, score: Math.round((checks.length - blockers.length) / checks.length * 100), blockers });
    }
    _guardChanges() {
      const s = this.state;
      if (s.readiness.ready) return;
      if (s.phase === 'IGNITION') this.abort('Terminal interlock: ' + s.readiness.blockers[0]);
      else if (s.phase === 'COUNTDOWN' && s.time >= -10) this._hold('Automatic hold: ' + s.readiness.blockers[0]);
      if (FLYING.includes(s.phase) && !['COAST', 'FLIGHT_ABORT'].includes(s.phase) &&
          (!s.systems.avionics || !s.systems.guidance || !s.systems.pressurization)) {
        this.abort('Critical flight system unavailable');
      }
    }
    startCountdown() {
      const s = this.state; this._updateReadiness();
      if (s.phase === 'HOLD') return this.resume();
      if (s.phase !== 'PREFLIGHT') return result(false, 'Countdown is unavailable in this mission phase.');
      if (!s.readiness.ready) return result(false, 'Launch inhibited: ' + s.readiness.blockers.join('; ') + '.');
      s.phase = 'COUNTDOWN'; s.holdReason = '';
      this._event('All stations GO. Countdown sequence started at T−02:00.', 'success');
      return result(true, 'Countdown running.');
    }
    _hold(reason) { this.state.phase = 'HOLD'; this.state.holdReason = reason; this._event(reason, 'warning'); return result(true, 'Countdown held.'); }
    hold() {
      if (this.state.phase === 'IGNITION') return this.abort('Flight director hold after ignition; pad safing initiated');
      if (this.state.phase !== 'COUNTDOWN') return result(false, 'Hold is available during countdown.');
      return this._hold('Flight director commanded HOLD.');
    }
    resume() {
      const s = this.state; this._updateReadiness();
      if (s.phase !== 'HOLD') return result(false, 'Countdown is not held.');
      if (!s.readiness.ready) return result(false, 'Resume inhibited: ' + s.readiness.blockers.join('; ') + '.');
      s.phase = 'COUNTDOWN'; s.holdReason = '';
      this._event('Hold released. Resuming terminal count.', 'success');
      return result(true, 'Countdown resumed.');
    }
    abort(reason) {
      const s = this.state;
      if (['ABORTED', 'FLIGHT_ABORT', 'COMPLETE'].includes(s.phase)) return result(false, 'Mission is already ended or in abort.');
      s.abortReason = reason || 'Flight director commanded abort';
      s.phase = s.altitude > 0 ? 'FLIGHT_ABORT' : 'ABORTED';
      s.thrust = 0; s.activeEngines = 0; s.boosterEngines = 0; s.shipEngines = 0; s.engineLit = false; s.effectiveThrottle = 0;
      this._abortTime = s.elapsed;
      if (s.phase === 'ABORTED') { s.outcome = 'PAD SAFED'; s.gForce = 1; }
      else { s.outcome = 'THRUST TERMINATED • BALLISTIC FLIGHT'; }
      this._event('ABORT — ' + s.abortReason + '. ' + (s.phase === 'ABORTED' ? 'Engine valves closed; vehicle remains on pad.' : 'Thrust terminated; ballistic trajectory continues.'), 'danger');
      this._updateEngineStatus();
      return result(true, s.phase === 'ABORTED' ? 'Pad abort complete.' : 'Flight abort commanded.');
    }
    eject() {
      const s = this.state;
      if (!s.config.trainingCapsule) return result(false, 'Baseline Starship has no capsule in this simulation. Enable the fictional training capsule in configuration.');
      if (s.capsule.active) return result(false, 'Training capsule has already separated.');
      if (s.outcome.startsWith('VEHICLE LOST')) return result(false, 'Vehicle lost. Reset to run another escape exercise.');
      const noseLength = s.separated ? 51 : 121, mountHeight = s.separated ? 0.65 : 15;
      const altitude = s.altitude + mountHeight + noseLength * Math.sin(s.pitch * DEG);
      const downrange = s.downrange + noseLength * Math.cos(s.pitch * DEG) + 6;
      Object.assign(s.capsule, { elapsed: 0, separatedAt: s.elapsed, active: true, altitude, downrange,
        verticalVelocity: s.verticalVelocity, horizontalVelocity: s.horizontalVelocity,
        velocity: s.velocity, gForce: 600000 / 12000 / G0, phase: 'ESCAPE', parachute: false, parachuteRequested: false, parachuteInflation: 0, thrust: 600000, fuel: 650, mass: 12000, pitch: 77.3, maxAltitude: altitude, maxVelocity: s.velocity });
      this._capsuleTime = s.elapsed;
      if (!['ABORTED', 'FLIGHT_ABORT', 'COMPLETE'].includes(s.phase)) this.abort('Commander initiated fictional capsule escape');
      this._event('TRAINING ONLY — fictional escape motor fired; capsule separation confirmed.', 'warning');
      return result(true, 'Fictional escape sequence active.');
    }
    deployParachute() {
      const c = this.state.capsule;
      if (!c.active) return result(false, 'Separate the training capsule before commanding parachutes.');
      if (['LANDED', 'IMPACT'].includes(c.phase)) return result(false, 'Capsule has already reached the surface.');
      if (c.parachuteRequested) return result(false, c.parachute ? 'Parachutes already deploying.' : 'Parachutes are armed; awaiting safe airspeed and descent.');
      c.parachuteRequested = true;
      this._event('Commander armed the main parachutes. Deployment awaits motor burnout, descent and safe airspeed.', 'warning');
      return result(true, 'Parachutes armed. They deploy on descent below 220 m/s in the atmosphere.');
    }
    requestReturn() {
      const s = this.state;
      if (!s.config.recoveryMode) return result(false, 'Select the recovery training profile before launch.');
      if (!FLYING.includes(s.phase) || s.phase === 'FLIGHT_ABORT') return result(false, 'Return command is available during powered flight and coast.');
      if (s.recovery.returnRequested) return result(false, 'Return to launch tower already commanded.');
      s.recovery.returnRequested = true;
      this._event('Flight director commanded early return to launch tower.', 'warning');
      return result(true, 'Return commanded. Guidance will separate safely and reserve landing propellant.');
    }
    setFault(type) {
      if (!type || type === 'none') return this.clearFault();
      type = FAULT_ALIASES[type] || type;
      if (!(type in FAULTS)) return result(false, 'Unknown fault type.');
      if (['ABORTED', 'COMPLETE'].includes(this.state.phase)) return result(false, 'Vehicle scenario has ended. Reset before injecting another fault.');
      const s = this.state, newFault = s.fault !== type || this._faultStage !== s.stage;
      const airborne = FLYING.includes(s.phase) && s.altitude > 0;
      s.fault = type; this._faultStage = s.stage;
      if (newFault) {
        const faultId = ++this._faultIncidentId;
        if (airborne && type === 'engineOut') this._incident(s.stage === 1 ? 'booster' : 'ship', 'engine-failure', 'fault:' + faultId);
        if (airborne && ['pressureDrop', 'structuralBreakup'].includes(type)) this._incident('ship', 'rupture', 'fault:' + faultId);
      }
      this._event('Fault injected: ' + FAULTS[type] + '.', 'danger');
      this._updateReadiness(); this._guardChanges();
      if (['pressureDrop', 'structuralBreakup', 'guidanceFailure'].includes(type) && FLYING.includes(s.phase)) this.abort(FAULTS[type]);
      return result(true, FAULTS[type] + ' injected.');
    }
    clearFault() {
      if (this.state.fault) this._event('Training fault cleared; subsystem restored.', 'success');
      this.state.fault = null; this._updateReadiness();
      return result(true, 'Fault cleared. An aborted mission requires reset.');
    }
    tick(dt) {
      dt = Number(dt); if (!Number.isFinite(dt) || dt <= 0) return this.state;
      // Fixed maximum integration interval makes 1x and accelerated time behave consistently.
      // No elapsed time is dropped. Callers should pass their chosen playback delta.
      let remaining = dt;
      while (remaining > 1e-9) { const h = Math.min(0.05, remaining); this._step(h); remaining -= h; }
      this._massAndFuel(); this._updateEngineStatus();
      return this.state;
    }
    _step(dt) {
      const s = this.state; s.elapsed += dt;
      if (s.phase === 'COUNTDOWN' || s.phase === 'IGNITION') {
        const prev = s.time; s.time += dt;
        if (prev < -60 && s.time >= -60) this._once('terminal', 'Terminal count. Flight computers own the sequence.');
        if (prev < -30 && s.time >= -30) this._once('deluge', 'Launch mount water deluge flowing.');
        if (s.time >= -10 && !s.readiness.ready) { s.time = -10; this._hold('Automatic T−10 hold: ' + s.readiness.blockers[0]); }
        if (s.phase === 'COUNTDOWN' && s.time >= -3) {
          s.phase = 'IGNITION'; this._once('ignition', 'Raptor ignition sequence. Verifying 33 engines.', 'success');
        }
        if (s.phase === 'IGNITION') {
          const ramp = clamp((s.time + 3) / 2.7, 0, 1);
          s.boosterEngines = Math.ceil(ramp * 33); s.activeEngines = s.boosterEngines;
          s.thrust = 74.5e6 * ramp * s.config.throttle; s.effectiveThrottle = ramp * s.config.throttle;
          s.boosterFuel = Math.max(0, s.boosterFuel - s.thrust / (330 * G0) * dt);
          if (s.time >= 0) {
            this._massAndFuel();
            if (s.thrust / (s.mass * G0) < 1.05 || !s.readiness.ready) this.abort('Ignition thrust verification failed');
            else { s.phase = 'ASCENT'; s.time = 0; this._once('liftoff', 'LIFTOFF. Tower clearance sequence active.', 'success'); }
          }
        }
      } else if (FLYING.includes(s.phase)) {
        s.time += dt; s.missionDuration = s.time; this._flight(dt);
      }
      if (s.booster.separated) this._boosterFlight(dt);
      else { Object.assign(s.booster, { altitude: s.altitude, downrange: s.downrange, verticalVelocity: s.verticalVelocity,
        horizontalVelocity: s.horizontalVelocity, velocity: s.velocity, pitch: s.pitch, thrust: s.stage === 1 ? s.thrust : 0, fuel: s.boosterFuel }); }
      if (s.capsule.active) this._capsuleFlight(dt);
      else { const nose = s.separated ? 51 : 121; s.capsule.gForce = s.gForce; s.capsule.altitude = s.altitude + (s.separated ? 0.65 : 15) + nose * Math.sin(s.pitch * DEG); s.capsule.downrange = s.downrange + nose * Math.cos(s.pitch * DEG) + 6; }
      s.engineLit = s.activeEngines > 0;
      if (FLYING.includes(s.phase) && (!s.trajectory.length || s.time - s.trajectory[s.trajectory.length - 1].time >= 1)) {
        s.trajectory.push({ time: s.time, altitude: s.altitude, velocity: s.velocity, downrange: s.downrange, q: s.dynamicPressure });
        if (s.trajectory.length > 1800) s.trajectory.shift();
      }
    }
    _massAndFuel() {
      const s = this.state;
      s.mass = SD + s.config.payload + s.shipFuel + (s.separated ? 0 : BD + s.boosterFuel);
      s.boosterFuelPct = clamp(s.boosterFuel / BP * 100, 0, 100);
      s.shipFuelPct = clamp(s.shipFuel / SP * 100, 0, 100);
      s.fuelPct = s.separated ? s.shipFuelPct : clamp((s.boosterFuel + s.shipFuel) / (BP + SP) * 100, 0, 100);
    }
    _air(altitude) {
      const h = Math.max(0, altitude), temp = Math.max(216.65, 288.15 - 0.0065 * h);
      return { density: h > 180000 ? 0 : 1.225 * Math.exp(-h / 8500), pressure: 101325 * Math.exp(-h / 8400), temperature: temp, sound: Math.sqrt(1.4 * 287.05 * temp) };
    }
    _targetPitch() {
      const s = this.state;
      if (!s.config.autopilot) return s.config.manualPitch;
      if (s.config.recoveryMode) return s.separated ? 90 : s.time < 12 ? 90 : 87;
      const profile = s.separated ? [[0, 28], [80, 9], [180, 0], [350, 0]] : [[0, 90], [10, 90], [35, 72], [80, 48], [130, 30], [180, 25]];
      const t = s.separated ? s.time - this._stageTime : s.time;
      for (let i = 1; i < profile.length; i++) if (t < profile[i][0]) {
        const a = profile[i - 1], b = profile[i]; return a[1] + (b[1] - a[1]) * clamp((t - a[0]) / (b[0] - a[0]), 0, 1);
      }
      return profile[profile.length - 1][1];
    }
    _flight(dt) {
      const s = this.state;
      if (s.config.recoveryMode && ['RETURN_COAST', 'SHIP_RETURN', 'TOWER_APPROACH'].includes(s.phase)) return this._shipReturn(dt);
      const air = this._air(s.altitude), radius = R + s.altitude;
      const grav = G0 * (R / radius) ** 2;
      s.targetPitch = this._targetPitch();
      s.pitch += clamp(s.targetPitch - s.pitch, -2 * dt, 2 * dt);
      const pitch = s.pitch * DEG;
      let throttle = s.config.throttle, engines = 0, shipEngines = 0, thrust = 0;
      const wind = (s.config.wind + (s.fault === 'windShear' ? 35 * Math.sin(s.time * 1.5) : 0)) * Math.exp(-s.altitude / 12000);
      const relX = s.horizontalVelocity - wind, relY = s.verticalVelocity, airspeed = Math.hypot(relX, relY);
      const q = 0.5 * air.density * airspeed ** 2;
      s.dynamicPressure = q; s.maxQ = Math.max(s.maxQ, q); s.mach = airspeed / air.sound; s.atmosphere = air;
      if (s.phase === 'ASCENT') {
        // Closed-loop load relief reduces thrust through the high dynamic pressure region.
        if (s.config.autopilot && q > 30000) throttle *= clamp(30000 / q, 0.65, 1);
        engines = 33 - (s.fault === 'engineOut' && this._faultStage === 1 ? 1 : 0);
        thrust = (74.5e6 + 5.5e6 * (1 - air.density / 1.225)) * engines / 33 * throttle;
        s.boosterFuel = Math.max(0, s.boosterFuel - thrust / ((330 + 20 * (1 - air.density / 1.225)) * G0) * dt);
        if (s.boosterFuel <= 260000 || (s.config.recoveryMode && (s.time >= 75 || (s.recovery.returnRequested && s.altitude > 1200)))) {
          s.phase = 'HOT_STAGING'; this._stageTime = s.time;
          this._once('meco', 'Main engine cutoff. Three center Raptors remain lit.');
          this._once('hotstage', 'Hot staging: six ship Raptors ignite before separation.', 'success');
        }
      } else if (s.phase === 'HOT_STAGING') {
        engines = 3; shipEngines = 6;
        const shipThrust = 14.7e6 * throttle, boostThrust = 80e6 * 3 / 33 * throttle;
        thrust = shipThrust + boostThrust;
        s.boosterFuel = Math.max(0, s.boosterFuel - boostThrust / (350 * G0) * dt);
        s.shipFuel = Math.max(0, s.shipFuel - shipThrust / (365 * G0) * dt);
        if (s.time - this._stageTime >= 3) {
          s.phase = 'SHIP_ASCENT'; s.stage = 2; s.separated = true; this._stageTime = s.time;
          Object.assign(s.booster, { separated: true, altitude: s.altitude - 72, downrange: s.downrange,
            verticalVelocity: s.verticalVelocity - 8, horizontalVelocity: s.horizontalVelocity - 3,
            velocity: s.velocity, pitch: s.pitch, thrust: 0, fuel: s.boosterFuel, phase: s.config.recoveryMode ? 'BOOSTBACK' : 'COAST', activeEngines: 0, throttle: 0 });
          engines = 0; thrust = shipThrust;
          this._once('separation', 'Stage separation confirmed. Ship continues ascent; booster begins return.', 'success');
        }
      } else if (s.phase === 'SHIP_ASCENT') {
        shipEngines = 6 - (s.fault === 'engineOut' && this._faultStage === 2 ? 1 : 0);
        thrust = 14.7e6 * shipEngines / 6 * throttle;
        // A simplified 3-g acceleration limit prevents unrealistic late-burn crew loads.
        thrust = Math.min(thrust, s.mass * G0 * 3.2);
        s.shipFuel = Math.max(0, s.shipFuel - thrust / (365 * G0) * dt);
        if ((s.config.recoveryMode && (s.time - this._stageTime >= 70 || s.recovery.returnRequested)) || s.velocity >= 6500 || s.shipFuel <= 45000 || s.time >= 600) {
          s.phase = s.config.recoveryMode ? 'RETURN_COAST' : 'COAST'; this._coastTime = s.time; thrust = 0; shipEngines = 0; s.recovery.phase = s.config.recoveryMode ? 'COAST' : 'DISABLED';
          this._once('seco', s.config.recoveryMode ? 'Ship engine cutoff. Short training arc complete; propellant reserved for return to tower.' : 'Ship engine cutoff. Suborbital coast; orbital insertion is not targeted.', 'success');
        }
      }
      this._massAndFuel();
      s.thrust = thrust; s.boosterEngines = engines; s.shipEngines = shipEngines;
      s.activeEngines = engines + shipEngines; s.effectiveThrottle = thrust > 0 ? throttle : 0;
      const flightPath = Math.atan2(relY, relX), aoa = Math.abs(Math.sin(pitch - flightPath));
      const cd = 0.28 + 0.15 * Math.exp(-(((s.mach - 1.05) / 0.4) ** 2)) + (s.phase === 'FLIGHT_ABORT' ? 0.12 : 0.25 * aoa);
      const area = Math.PI * 4.5 ** 2;
      const drag = q * cd * area, dx = airspeed > 0 ? drag * relX / airspeed : 0, dy = airspeed > 0 ? drag * relY / airspeed : 0;
      const ax = (thrust * Math.cos(pitch) - dx) / s.mass - s.horizontalVelocity * s.verticalVelocity / radius;
      const ay = (thrust * Math.sin(pitch) - dy) / s.mass - grav + s.horizontalVelocity ** 2 / radius;
      s.horizontalVelocity += ax * dt; s.verticalVelocity += ay * dt;
      s.downrange += s.horizontalVelocity * R / radius * dt; s.altitude += s.verticalVelocity * dt;
      s.velocity = Math.hypot(s.horizontalVelocity, s.verticalVelocity);
      s.acceleration = s.velocity > 0 ? (ax * s.horizontalVelocity + ay * s.verticalVelocity) / s.velocity : ay;
      s.verticalAcceleration = ay; s.gForce = Math.hypot(thrust * Math.cos(pitch) - dx, thrust * Math.sin(pitch) - dy) / s.mass / G0;
      s.maxAltitude = Math.max(s.maxAltitude, s.altitude); s.maxVelocity = Math.max(s.maxVelocity, s.velocity);
      if (s.altitude > 150 && s.phase !== 'FLIGHT_ABORT') this._once('towerclear', 'Tower cleared. Vehicle pitching downrange.');
      if (s.mach >= 1 && s.phase !== 'FLIGHT_ABORT') this._once('supersonic', 'Vehicle is supersonic.');
      if (s.maxQ > 10000 && q < s.maxQ * 0.94 && s.time > 30 && s.phase !== 'FLIGHT_ABORT') this._once('maxq', 'Maximum dynamic pressure passed.');
      if (s.altitude >= 100000 && s.phase !== 'FLIGHT_ABORT') this._once('space', 'Kármán line crossed: altitude 100 kilometers.', 'success');
      if (q > 90000 && !['FLIGHT_ABORT', 'COAST'].includes(s.phase)) {
        this._incident('ship', 'rupture', 'ship:structural-load');
        this.abort('Structural load envelope exceeded');
      }
      if (s.altitude <= 0) {
        this._incident('ship', 'impact', 'ship:impact', true);
        s.altitude = 0; s.velocity = 0; s.verticalVelocity = 0; s.horizontalVelocity = 0; s.thrust = 0;
        s.activeEngines = 0; s.boosterEngines = 0; s.shipEngines = 0; s.gForce = 1;
        s.phase = 'ABORTED'; s.outcome = 'VEHICLE LOST • SCENARIO ENDED';
        this._once('impact', 'Vehicle reached the surface. Simulation ended; review the mission event log.', 'danger');
      } else if (s.phase === 'COAST' && s.time - this._coastTime >= 60) {
        s.phase = 'COMPLETE'; s.outcome = s.altitude >= 100000 ? 'SUBORBITAL ASCENT COMPLETE' : 'ASCENT OBJECTIVE NOT REACHED';
        this._once('complete', 'Ascent scenario complete. Coast telemetry frozen for debrief; no orbital insertion or landing is simulated.', 'success');
      }
    }
    // Integrated return guidance: bounded engine thrust follows a velocity target.
    // Fuel expenditure changes achievable deceleration at every integration step.
    _guidedDescent(body, dt, options) {
      const air = this._air(body.altitude), radius = R + Math.max(0, body.altitude), grav = G0 * (R / radius) ** 2;
      const mass = options.dryMass + body.fuel;
      const targetAltitude = options.targetAltitude, height = Math.max(0, body.altitude - targetAltitude);
      const maxNet = Math.max(0.7, options.maxThrust / mass - grav);
      const desiredY = -Math.min(700, Math.sqrt(2 * maxNet * height) * 0.48, Math.max(0.65, height * 0.12));
      const desiredX = clamp((options.targetX - body.downrange) / Math.max(4, Math.min(16, height / 150)), -45, 45);
      const wind = this.state.config.wind * Math.exp(-body.altitude / 12000);
      const relX = body.horizontalVelocity - wind, relY = body.verticalVelocity, speed = Math.hypot(relX, relY);
      const drag = 0.5 * air.density * speed * speed * options.area * options.cd;
      const dragX = speed ? drag * relX / speed : 0, dragY = speed ? drag * relY / speed : 0;
      let axCmd = clamp((desiredX - body.horizontalVelocity) / 3, -4, 4);
      let ayCmd = grav + clamp((desiredY - body.verticalVelocity) / (height < 250 ? 0.7 : 3), -grav, 20);
      if (options.coast && body.verticalVelocity > 0) { axCmd = 0; ayCmd = 0; }
      let thrustX = mass * axCmd + (ayCmd > 0 ? dragX : 0), thrustY = Math.max(0, mass * ayCmd + (ayCmd > 0 ? dragY : 0));
      let thrust = Math.min(options.maxThrust, Math.hypot(thrustX, thrustY));
      if (body.fuel <= 0) thrust = 0;
      const demanded = Math.hypot(thrustX, thrustY);
      if (demanded > 0) { thrustX *= thrust / demanded; thrustY *= thrust / demanded; }
      const consumed = Math.min(body.fuel, thrust / (options.isp * G0) * dt);
      if (thrust > 0 && consumed < thrust / (options.isp * G0) * dt) { const ratio = consumed / (thrust / (options.isp * G0) * dt); thrust *= ratio; thrustX *= ratio; thrustY *= ratio; }
      body.fuel -= consumed; body.thrust = thrust;
      body.pitch = thrust > 1000 ? Math.atan2(thrustY, thrustX) / DEG : 90;
      body.throttle = thrust / options.maxThrust;
      body.activeEngines = thrust > 1000 ? Math.min(options.maxEngines, Math.max(1, Math.ceil(thrust / options.engineThrust))) : 0;
      const ax = (thrustX - dragX) / mass, ay = (thrustY - dragY) / mass - grav;
      body.horizontalVelocity += ax * dt; body.verticalVelocity += ay * dt;
      body.downrange += body.horizontalVelocity * dt; body.altitude += body.verticalVelocity * dt;
      body.velocity = Math.hypot(body.horizontalVelocity, body.verticalVelocity);
      body.gForce = Math.hypot(thrustX - dragX, thrustY - dragY) / mass / G0;
      body.verticalAcceleration = ay; body.dynamicPressure = 0.5 * air.density * speed * speed;
      body.atmosphere = air; body.mach = speed / air.sound;
      return { height, mass, thrust, ax, ay };
    }
    _shipReturn(dt) {
      const s = this.state, r = s.recovery;
      if (s.phase === 'RETURN_COAST' && s.verticalVelocity <= 0) {
        s.phase = 'SHIP_RETURN'; r.phase = 'DESCENT';
        this._once('shipReturn', 'Ship descending. Closed-loop landing guidance targets the launch tower.', 'success');
      }
      const body = { altitude: s.altitude, downrange: s.downrange, verticalVelocity: s.verticalVelocity,
        horizontalVelocity: s.horizontalVelocity, fuel: s.shipFuel };
      const motion = this._guidedDescent(body, dt, { dryMass: SD + s.config.payload, maxThrust: 14.7e6,
        maxEngines: 6, engineThrust: 2.45e6, isp: 355, area: 63.6, cd: 0.65,
        targetX: 0, targetAltitude: r.catchAltitude, coast: s.phase === 'RETURN_COAST' });
      for (const k of ['altitude', 'downrange', 'verticalVelocity', 'horizontalVelocity', 'velocity', 'pitch', 'thrust', 'gForce', 'verticalAcceleration', 'dynamicPressure', 'atmosphere', 'mach']) s[k] = body[k];
      s.shipFuel = body.fuel; s.shipEngines = body.activeEngines; s.boosterEngines = 0; s.activeEngines = body.activeEngines;
      s.effectiveThrottle = body.throttle; s.targetPitch = body.pitch;
      s.acceleration = s.velocity > 0 ? (motion.ax * s.horizontalVelocity + motion.ay * s.verticalVelocity) / s.velocity : motion.ay;
      s.maxAltitude = Math.max(s.maxAltitude, s.altitude); s.maxVelocity = Math.max(s.maxVelocity, s.velocity); s.maxQ = Math.max(s.maxQ, s.dynamicPressure);
      this._massAndFuel();
      if (s.altitude >= 100000) this._once('space', 'Kármán line crossed: altitude 100 kilometers.', 'success');
      if (s.altitude < r.catchAltitude + 180 && s.verticalVelocity < 0) {
        s.phase = 'TOWER_APPROACH'; r.phase = 'CATCH'; r.catchProgress = clamp(1 - (s.altitude - r.catchAltitude) / 180, 0, 1);
        this._once('towerApproach', 'Ship on final approach. Tower arms armed for capture.', 'warning');
      }
      if (s.altitude <= r.catchAltitude && Math.abs(s.downrange) < 12 && Math.abs(s.verticalVelocity) < 3 && Math.abs(s.horizontalVelocity) < 2) {
        r.touchdownSpeed = s.velocity; r.caught = true; r.catchProgress = 1; r.phase = 'CAUGHT';
        // Contact constraint begins only after integrated guidance reaches the catch box.
        s.altitude = r.catchAltitude; s.downrange = 0; s.velocity = s.horizontalVelocity = s.verticalVelocity = s.thrust = 0;
        s.activeEngines = s.shipEngines = 0; s.phase = 'COMPLETE'; s.outcome = 'STARSHIP CAPTURED AT LAUNCH TOWER';
        s.effectiveThrottle = 0; s.gForce = 1;
        this._once('shipCaught', 'STARSHIP CAPTURED. Tower arms support the ship; engines shut down.', 'success');
        this._once('complete', 'Recovery training complete. Review independent booster and capsule status.', 'success');
      } else if (s.altitude <= 0) {
        this._incident('ship', 'impact', 'ship:impact', true);
        r.touchdownSpeed = s.velocity; r.phase = 'IMPACT'; s.phase = 'ABORTED'; s.outcome = 'VEHICLE LOST • RETURN IMPACT';
        s.altitude = 0; s.velocity = s.horizontalVelocity = s.verticalVelocity = s.thrust = 0; s.activeEngines = s.shipEngines = 0;
        this._once('impact', 'Ship missed the catch envelope and reached the ground.', 'danger');
      }
    }
    _boosterFlight(dt) {
      const s = this.state, b = s.booster;
      if (['SPLASHDOWN', 'LANDED', 'IMPACT'].includes(b.phase)) return;
      if (s.config.recoveryMode) {
        if (b.verticalVelocity < 0 && b.phase === 'BOOSTBACK') { b.phase = 'ENTRY'; this._once('boosterEntry', 'Booster return descent. Landing engines regulate velocity toward the landing zone.'); }
        if (b.altitude < 700 && b.verticalVelocity < 0) { b.phase = 'LANDING'; this._once('boosterLanding', 'Booster landing burn. Guidance targets the dedicated landing site.', 'warning'); }
        this._guidedDescent(b, dt, { dryMass: BD, maxThrust: 31.5e6, maxEngines: 13, engineThrust: 31.5e6 / 13,
          isp: 340, area: 63.6, cd: 0.9, targetX: b.targetDownrange, targetAltitude: 0, coast: b.verticalVelocity > 40 });
        s.boosterFuel = b.fuel;
        if (b.altitude <= 0) {
          b.touchdownSpeed = b.velocity; const safe = b.velocity < 4 && Math.abs(b.downrange - b.targetDownrange) < 16;
          if (!safe) this._incident('booster', 'impact', 'booster:impact', true);
          b.altitude = 0; b.verticalVelocity = b.horizontalVelocity = b.velocity = b.thrust = 0; b.activeEngines = 0; b.throttle = 0;
          b.phase = safe ? 'LANDED' : 'IMPACT';
          this._once('boosterdown', safe ? 'BOOSTER LANDED. Landing engines shut down on the dedicated landing site.' : 'Booster reached the ground outside landing limits.', safe ? 'success' : 'danger');
        }
      } else {
        const air = this._air(b.altitude), radius = R + Math.max(0, b.altitude), speed = Math.hypot(b.horizontalVelocity, b.verticalVelocity);
        const drag = 0.5 * air.density * speed ** 2 * 63.6 * 0.9, mass = BD + b.fuel;
        b.horizontalVelocity -= (speed > 0 ? drag * b.horizontalVelocity / speed / mass : 0) * dt;
        b.verticalVelocity += (-G0 * (R / radius) ** 2 + b.horizontalVelocity ** 2 / radius - (speed > 0 ? drag * b.verticalVelocity / speed / mass : 0)) * dt;
        b.altitude += b.verticalVelocity * dt; b.downrange += b.horizontalVelocity * dt; b.velocity = Math.hypot(b.horizontalVelocity, b.verticalVelocity);
        b.pitch += clamp(90 - b.pitch, -0.5 * dt, 0.5 * dt); if (b.verticalVelocity < 0) b.phase = 'DESCENT';
        if (b.altitude <= 0) { if (b.velocity >= 4) this._incident('booster', 'impact', 'booster:impact', true); b.touchdownSpeed = b.velocity; b.altitude = 0; b.verticalVelocity = b.horizontalVelocity = b.velocity = 0; b.phase = 'SPLASHDOWN'; this._once('boosterdown', 'Booster reached the water on the ascent-only ballistic profile.'); }
      }
    }
    _capsuleFlight(dt) {
      const s = this.state, c = s.capsule; if (['LANDED', 'IMPACT'].includes(c.phase)) return;
      const elapsed = s.elapsed - this._capsuleTime; c.elapsed = elapsed;
      const air = this._air(c.altitude);
      const burnInterval = Math.min(dt, Math.max(0, 3 - (elapsed - dt)));
      const burned = Math.min(c.fuel, 600000 / (285 * G0) * burnInterval);
      c.thrust = burned * 285 * G0 / dt; c.fuel -= burned; c.mass = 11350 + c.fuel;
      if (c.thrust === 0 && c.phase === 'ESCAPE') { c.phase = 'COAST'; this._once('escapeCoast', 'Escape motor burnout. Capsule follows a gravity and drag trajectory.'); }
      if (c.verticalVelocity < 0 && !c.parachute && c.phase !== 'ESCAPE') c.phase = 'DESCENT';
      c.velocity = Math.hypot(c.horizontalVelocity, c.verticalVelocity);
      if (s.config.autoParachute && elapsed > 3) c.parachuteRequested = true;
      if (c.parachuteRequested && c.thrust === 0 && c.verticalVelocity < 0 && air.density > 0.025 && c.velocity < 220 && !c.parachute) {
        c.parachute = true; c.phase = 'CHUTE'; this._once('chute', 'Main parachutes deploying. Reefed canopies inflate over four seconds.', 'success');
      }
      if (c.parachute) c.parachuteInflation = Math.min(1, c.parachuteInflation + dt / 4);
      const relX = c.horizontalVelocity - s.config.wind * Math.exp(-c.altitude / 12000), speed = Math.hypot(relX, c.verticalVelocity);
      const area = 18 + 3400 * c.parachuteInflation ** 2;
      const drag = 0.5 * air.density * speed ** 2 * area * (c.parachute ? 1.5 : 1);
      // Drag impulse is capped at available relative momentum per step; a canopy cannot reverse airspeed in one step.
      const dragImpulse = Math.min(drag * dt, c.mass * speed * 0.8);
      const dragForceX = speed ? dragImpulse / dt * relX / speed : 0;
      const dragForceY = speed ? dragImpulse / dt * c.verticalVelocity / speed : 0;
      // Accelerometer load is proper acceleration from engine and drag forces, excluding gravity.
      c.gForce = Math.hypot(c.thrust * Math.cos(c.pitch * DEG) - dragForceX, c.thrust * Math.sin(c.pitch * DEG) - dragForceY) / c.mass / G0;
      const ax = c.thrust * Math.cos(c.pitch * DEG) / c.mass;
      const ay = c.thrust * Math.sin(c.pitch * DEG) / c.mass - G0 * (R / (R + Math.max(c.altitude, 0))) ** 2;
      c.horizontalVelocity += ax * dt - (speed ? dragImpulse * relX / speed / c.mass : 0);
      c.verticalVelocity += ay * dt - (speed ? dragImpulse * c.verticalVelocity / speed / c.mass : 0);
      c.altitude += c.verticalVelocity * dt; c.downrange += c.horizontalVelocity * dt;
      c.velocity = Math.hypot(c.horizontalVelocity, c.verticalVelocity);
      c.maxAltitude = Math.max(c.maxAltitude, c.altitude); c.maxVelocity = Math.max(c.maxVelocity, c.velocity);
      if (c.altitude <= 0) {
        const touchdown = c.velocity, safe = touchdown < 12 && c.parachute;
        if (!safe) this._incident('capsule', 'impact', 'capsule:impact', true);
        c.touchdownAt = s.elapsed; c.touchdownSpeed = touchdown; c.altitude = 0; c.verticalVelocity = c.horizontalVelocity = c.velocity = c.thrust = 0;
        c.phase = safe ? 'LANDED' : 'IMPACT'; c.gForce = 1;
        s.outcome = safe ? 'TRAINING CAPSULE RECOVERED' : 'TRAINING CAPSULE IMPACT';
        this._once('capsuleDown', safe ? 'Training capsule landed under parachute. Escape exercise complete.' : 'Training capsule impacted the surface outside recovery limits.', safe ? 'success' : 'danger');
      }
    }
    _updateEngineStatus() {
      const s = this.state;
      const boosterActive = s.booster.separated ? s.booster.activeEngines : s.boosterEngines;
      s.engineStatus.booster = Array.from({ length: 33 }, (_, i) => s.fault === 'engineOut' && this._faultStage === 1 && i === 32 ? 'OFFLINE' : i < boosterActive ? 'RUNNING' : 'STANDBY');
      s.engineStatus.ship = Array.from({ length: 6 }, (_, i) => s.fault === 'engineOut' && this._faultStage === 2 && i === 5 ? 'OFFLINE' : i < s.shipEngines ? 'RUNNING' : 'STANDBY');
    }
  }
  MissionSim.SYSTEMS = SYSTEMS; MissionSim.STATIONS = STATIONS; MissionSim.FAULTS = FAULTS;
  MissionSim.CONSTANTS = { G0, earthRadius: R, boosterPropellant: BP, shipPropellant: SP, boosterDryMass: BD, shipDryMass: SD };
  if (typeof module !== 'undefined' && module.exports) module.exports = MissionSim;
  if (root) root.MissionSim = MissionSim;
})(typeof window !== 'undefined' ? window : globalThis);
