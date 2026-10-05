# Flight model and evidence boundary — V5 cinematic failures

V5 adds immutable failure incidents to the educational flight engine in `dist/simulation.js` and uses them to drive cinematic effects. Independent capsule descent, manual parachutes and the near-vertical booster/ship recovery rehearsal remain in place. A more detailed scene does not make the underlying physics a validated aerospace model.

This is an independent Starship-inspired simulator. Its reference stack is 120 m tall and 9 m in diameter, with 33 booster and six ship engines. This is a chosen historical-style configuration, not a claim to reproduce the latest flight article. Real flight data are not connected. Vehicle masses, thrust curves, guidance, operating limits, mission-control workflow and crew hardware include illustrative assumptions.

## Primary references checked October 3, 2026

- NASA Advanced Supercomputing, [SpaceX Starship Hot Staging — From Concept to Flight](https://www.nas.nasa.gov/SC24/research/project24.php), last updated November 16, 2024: upper-stage engines ignite before booster engines fully shut down. NASA's work discusses interstage plume flow and CFD. This simulator implements a simple thrust overlap, not those flow simulations.
- NASA Glenn, [Drag Equation](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/drag-equation/): `D = 0.5 × density × velocity² × Cd × reference area`. This is the physical basis for the drag calculation; the simulator's coefficient curve is an assumption, not a value validated by NASA.
- FAA, [Starship/Super Heavy](https://www.faa.gov/space/stakeholder_engagement/spacex_starship/starship_super_heavy), last updated July 24, 2025: Boca Chica location, two-stage architecture, oxygen/methane propellants and preflight rehearsal concepts. This is a proposed-operations description; its stated engine envelope is not treated as an as-flown specification.
- SpaceX, [Starship](https://www.spacex.com/vehicles/starship/): retained as the vehicle's official reference destination. The page returned no readable article body to the retrieval tool during the October 3 source check. It therefore does not verify the simulator's numerical parameters or a current configuration.
- SpaceX, [Updates / Reusability](https://www.spacex.com/updates/reusability), February 24, 2025 Flight 7 recap: describes 33 booster and six ship engines, hot staging, booster boostback, a landing burn and the second successful Super Heavy tower catch. This establishes a real recovery reference, not the simulator's guidance or landing-site configuration.
- SpaceX, [Mission / Landing](https://www.spacex.com/mission/?os=0): describes Falcon-family booster recoveries on landing zones and droneships. The simulator's Super Heavy ground landing and upper-stage tower return deliberately combine training concepts; they are not represented as a documented as-flown Starship mission.

## Motion and propulsion

The main vehicle is integrated in two dimensions relative to a spherical Earth. Radius is 6,371 km and surface gravity is 9.80665 m/s². Gravity decreases with the inverse square of radius. Radial and tangential curvature terms are included; Earth rotation is omitted. The scene's three-dimensional camera freedom does not turn this into six-degree-of-freedom rigid-body dynamics.

A semi-implicit integration step is no larger than 0.05 seconds. The physics engine subdivides a caller's positive finite delta until it has integrated that entire delta. Playback rate changes simulation time, and every viewpoint consumes the same resulting state.

| Parameter | Model value | Status |
|---|---:|---|
| Booster propellant | 3,400,000 kg at full load | Illustrative input |
| Ship propellant | 1,200,000 kg at full load | Illustrative input |
| Booster dry mass | 200,000 kg | Illustrative input |
| Ship dry mass | 120,000 kg | Illustrative input |
| Payload | 0–150,000 kg; default 100,000 kg | User configuration |
| Booster thrust | 74.5 MN near sea level, approaching 80 MN in vacuum | Assumed curve for 33 engines |
| Ship thrust | 14.7 MN before throttle and acceleration limiting | Assumed value for six engines |
| Booster specific impulse | 330–350 s | Assumed altitude-dependent curve |
| Ship specific impulse | 365 s | Assumed constant |

Propellant flow is `thrust / (Isp × g0)`. Mass decreases with propellant consumption and excludes the booster after separation. Oxygen and methane are represented as one combined propellant mass; mixture ratio, turbopump behavior, ullage, temperature and tank fluid motion are not solved.

Atmospheric density follows an 8.5 km exponential scale height and is set to zero above 180 km. Pressure uses an 8.4 km scale height. Temperature follows an approximate lapse rate with a floor, and the speed of sound is calculated from that temperature. Drag uses a circular 9 m frontal area, a transonic coefficient bump and a simple angle-of-attack penalty. Wind decays with altitude; the wind-shear fault adds an oscillating component. This is an interactive approximation, not a validated atmosphere or aerodynamics dataset.

Automatic guidance follows a piecewise pitch schedule. Pitch changes are limited to 2°/s. During booster ascent, automatic guidance reduces throttle when dynamic pressure exceeds 30 kPa. Ship thrust is capped at the force corresponding to 3.2 g. The displayed g-load derives from thrust and aerodynamic force, rather than simply reporting net vertical acceleration. These controls and limits are invented for the scenario.

## Countdown and flight sequence

The count begins at T−120 seconds. All eight system checks and six station GO votes are required. The training launch gates require at least 95% propellant, at least 85% throttle, wind no greater than 15 m/s, no storm or unresolved fault, and either automatic guidance or manual pitch of at least 85°.

An unsafe change late in the count produces a hold at T−10. Ignition begins at T−3, with thrust and engine count ramping up. Failed ignition readiness safes the pad. Holding after ignition also safes the pad. Payload, propellant and recovery-profile selection lock at T−8 and remain locked after that phase. The training capsule toggle remains changeable so escape can be enabled during a live exercise.

In the original suborbital scenario, booster cutoff is triggered at 260 t of remaining booster propellant. Three booster engines and six ship engines overlap for a three-second hot-staging interval, followed by separation. The default recovery rehearsal instead commands cutoff at T+75 seconds and separation about three seconds later, unless an early return was requested. A near-vertical trajectory preserves the fuel and local geometry needed for the recovery exercise. The ship burns for a further 70 seconds before cutoff, coast and return.

With recovery rehearsal disabled, ship cutoff occurs at 6.5 km/s, 45 t remaining fuel or T+600 seconds, whichever condition occurs first. After 60 seconds of coast, the scenario freezes its main-vehicle telemetry for debrief. In the earlier automated suborbital run on October 3, 2026, completion occurred at T+450 seconds, with a maximum altitude of 181.765 km, final altitude of 154.988 km, final velocity of 6.528 km/s and maximum dynamic pressure of 34.794 kPa. Those are model outputs from the retained suborbital profile, not the default recovery rehearsal and not SpaceX measurements.

## Recovery rehearsal

Recovery rehearsal is enabled by default. It is a near-vertical suborbital exercise, not an orbital ascent followed by a physical return from orbit. The detached booster has independent position, velocity, propellant and thrust. A guidance controller directs boostback and landing burns toward an illustrative landing zone 360 m from the launch axis. Gravity, drag and fuel consumption continue during the maneuver. The displayed exhaust follows the engine thrust state; it is not an animation that alone determines descent.

The ship uses a separate return sequence, which can be requested with `requestReturn()`. It guides back toward launch downrange zero and a 75 m catch altitude, then attempts a low-speed catch. Capture requires horizontal position within 12 m of target, vertical speed below 3 m/s and horizontal speed below 2 m/s. The tower's closing progress follows the recovery state. The engine simulates translation and finite available thrust, while body attitude and tower contact remain simplified. There is no multibody arm-contact solver, structural flex, propellant slosh, verified flight-control law or thermal reentry model.

Both recoveries can fail. Touchdown or capture state is based on the modeled approach rather than an unconditional visual snap to a success animation. The combined recovery mission is an invented training profile; it should not be read as a prediction of Starship performance.

The default regression run reached a peak altitude of 104.739 km and tower capture at T+576.15 seconds. Ship approach speed at capture was 0.635 m/s, with 205,973 kg of ship propellant remaining. Booster touchdown speed was 0.624 m/s, with 761,856 kg remaining. These are deterministic model outputs, not measured SpaceX performance; mass, controller and reserve assumptions are illustrative.

## Faults and aborts

The six injected faults are engine loss, telemetry dropout, tank pressure loss, structural breakup, guidance failure and wind shear. Engine loss reduces the affected stage's thrust and engine count during powered ascent. Pressure, structural and guidance faults command an airborne abort. Telemetry loss affects how the interface identifies displayed values; it does not erase the model's internal state. Clearing a fault is a training reset of that fault, not a realistic hardware repair, and does not undo an abort. New fault injections are rejected after the vehicle reaches `ABORTED` or `COMPLETE`.

A pad abort terminates thrust while the vehicle remains on the pad. A flight abort terminates thrust and continues ballistic motion to surface impact. A dynamic-pressure value above 90 kPa also triggers the existing structural-envelope abort during the powered ascent sequence; V5 records a rupture at that point. Detailed breakup dynamics and an explosive range-termination system are not implemented.

## V5 incident and effect boundary — October 4, 2026

The model records pre-contact speed, velocity components, fuel, mass, pitch, stage, attachment state and position before terminal code zeroes the live motion. Destructive impacts are recorded independently for ship, booster and capsule. Airborne engine-loss injections produce `engine-failure`; airborne pressure loss, structural breakup and structural overload produce `rupture`. Safe pad safing and successful recoveries do not create these incidents. A commanded abort or guidance fault alone does not create an airborne fireball.

`state.incidents` contains the latest 24 frozen records in chronological order, with monotonic mission-local IDs. Impact and structural-overload keys prevent repeated emission, while clearing and reinjecting an airborne fault intentionally begins another training incident. Reset clears the history and IDs while preserving the public state object's identity. Attached-stack incidents retain combined mass and fuel when the whole stack is affected; localized booster engine incidents identify that stage.

`dist/failure-fx.js` converts incident facts into authored visual scales. Fireball billows, smoke, a ground ring, metal fragments, scorch marks and lighting are cinematic approximations. Fragment gravity and bounce are decorative motion; fragments do not alter the flight model or damage nearby objects. The implementation does not solve combustion chemistry, fluid flow, tank rupture, overpressure, blast injury or structural fragmentation. A visually large explosion is not evidence of a calculated physical blast radius.

Effects use an unaccelerated rendering clock shared by all camera views. Pause and a hidden tab freeze their progression; the mission's 1×–25× setting still controls the flight model. The automatic debrief waits ten active real-time seconds after the most recent major incident so the failure remains visible. Ground contact can still occur after an airborne rupture, producing a separate impact incident.

## Fictional crew escape

The training capsule is invented hardware and is installed by default in this edition. It can separate once per scenario whenever the launch vehicle is intact, including from the pad, powered ascent, coast or return. This broad availability is a training affordance, not a claim that a real crew escape system could survive every flight state.

Separation inherits the parent vehicle's current velocity and begins an independently integrated powered escape. Initial capsule mass is 12,000 kg, including 650 kg of modeled propellant. The 600 kN escape motor burns for three seconds at an illustrative 285 s specific impulse, then thrust becomes zero. Gravity and velocity-dependent atmospheric drag continue through ascent, apogee and freefall to the surface. There is no hover or fixed-altitude capsule phase.

`deployParachute()` accepts a recovery request after separation. A request can be made during the powered burn or at high altitude; it remains armed until the motor has shut down, the capsule is descending, atmospheric density exceeds 0.025 kg/m³ and speed is below 220 m/s. This distinguishes commanding recovery from physically opening a canopy. Inflation takes four seconds; effective reference area is `18 + 3400 × inflation²` m². The chute drag coefficient is 1.5. Per-step drag impulse is limited so drag cannot reverse relative airspeed in one integration step. The default is manual deployment; an optional automatic backup can also request recovery. A safe touchdown requires a deployed canopy and total speed below 12 m/s. A late request, high-energy trajectory or uncommanded chute can produce an impact.

Capsule peak altitude, peak velocity and touchdown speed are recorded separately from the parent vehicle. Capsule dynamics are an isolated training calculation; the stack mass budget is not rebuilt to account for installing or ejecting this invented module. The cockpit, escape motor, deployment envelope and parachute behavior must not be interpreted as real Starship equipment or procedures.

## Rendering and geography

The mission-control room and crew cockpit are conceptual environments. The launch complex is an illustrative arrangement, not a surveyed or current site reconstruction. Free-camera movement provides visual exploration, not vehicle or pedestrian collision physics. Smoke, exhaust, water and lighting are visual effects, not computational fluid dynamics.

Photographic surface maps and the sunset HDR environment are CC0 assets from [Poly Haven](https://polyhaven.com/license). The sunset sky was photographed outside Texas and is used as an artistic lighting baseline. Earth and space textures by [Solar System Scope / INOVE](https://extension.solarsystemscope.com/textures/) are licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) and are composited rendering maps, not live observation data. Exact asset sources, modifications and hashes are recorded in `dist/assets/v2/SOURCES.json`.

## State and command contract

`window.MissionSim` is also exported through CommonJS. It owns a persistent `.state` object. `tick(dt)` advances simulation seconds independently of the rendered viewpoint. Numeric kinematic quantities use SI units; pitch is degrees above the local horizon.

Public commands return `{ok, message}`: `configure`, `setSystem`, `vote`, `startCountdown`, `hold`, `resume`, `abort`, `eject`, `deployParachute`, `requestReturn`, `reset`, `setFault` and `clearFault`. `MissionSim.SYSTEMS`, `.STATIONS`, `.FAULTS` and `.CONSTANTS` describe the supported controls. Events are stored newest first and are also supplied through `.onEvent`. `state.capsule`, `state.booster` and `state.recovery` expose the independently tracked recovery quantities used by cameras and instruments.

## Verification boundary

Run `node tests/physics.cjs` from the repository root. V5 passes 25 test groups covering command gates, hold/resume, staging, fuel and finite-state invariants, numerical consistency, aborts, faults, reset behavior and invalid input, plus escape commands throughout flight, manual chute arming and inflation, finite powered burns, freefall, recovery guidance and terminal outcomes. Added incident checks cover immutable pre-impact facts, simultaneous independent impacts, safe recoveries, structural overload before and after staging, terminal fault rejection and bounded/reset history. Recovery results are compared across 0.02, 1 and 25 second caller deltas. Commands for all suites are listed in [repository checks](../README.md#checks).

These checks establish internal behavior and numerical consistency. They do not validate real-world aerospace performance or the visual quality of the scene. Browser checks remain necessary; see the [performance verification boundary](PERFORMANCE.md#verification-boundary-and-useful-next-measurements) for measurement limits.

## V4 cameras, traffic and sound

The Starship, booster and capsule panes read the same mission state and render through a single WebGL context. Selecting a pane changes its camera priority, not its vehicle dynamics. The fleet at the five background sites is authored scene animation depicting hypothetical future operations; it does not run five additional copies of the mission physics. Fleet time runs at real time and freezes with pause, independently of mission time acceleration. Trucks, traffic exhaust and recovery dust are decorative visual systems.

Music and effects are synthesized locally through Web Audio. Narrative callouts are generated from mission and fleet events, with browser speech synthesis and visible captions. This is authored scenario narration rather than live SpaceX communications or an AI flight controller.
