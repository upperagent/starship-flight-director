# Starship · Flight Director — V5 cinematic failures

A browser launch simulator built around three full-screen 3D environments: a flight director's mission-control room, a conceptual commander's cockpit, and a camera operator's view of the launch complex. All perspectives follow the same mission, clock and vehicle state.

V5 adds incident-driven fireballs, debris, smoke, ground shockwaves and layered explosion sound to the shared 3D world. Three simultaneous vehicle cameras, scheduled spaceport traffic, the original score and mission narration remain available, together with independent capsule escape, manual parachutes, engine inspection and booster/ship recovery. Every player runs an independent mission locally in their browser; this is not a shared multiplayer world. It remains an independent browser simulation and does not claim GTA 6 or AAA production quality.

## Self-contained edition

Run `python3 tools/build-standalone.py` from the repository root to create `artifacts/Starship-Flight-Director.html`. It embeds all scripts, fonts, third-party notices and 21 visual assets in one file, including the optional High-quality HDR environment. The generated file needs no external asset service. Use the local HTTP method below if your browser restricts direct opening. This portable file is larger than a normal first visit to the hosted page because it contains every quality tier and asset up front.

## Run the source folder locally

The `dist` folder contains the app, fonts, renderer and visual assets. No build, account or API key is required. Serve the folder over local HTTP so the browser can load its textures and HDR environment reliably.

From the simulator's folder, run:

```sh
python3 -m http.server 8080 --bind 127.0.0.1 --directory dist
```

Then open [the local simulator](http://127.0.0.1:8080). Keep the terminal running while you play; press Ctrl+C to stop it. Any other static HTTP server can serve the same `dist` folder. Opening `index.html` directly with a `file:` URL can block texture loading in some browsers.

After download, the core local simulation does not require an internet connection. Optional browser/OS narration voices may depend on their provider. A modern browser with WebGL and hardware acceleration is recommended. Use the graphics setting to reduce detail when needed.

## Start a mission

Choose **Enter mission** to take control, **Quick launch** for a prepared nominal flight, **Launch with three live views** for a launch with three vehicle views, or **Explore the spaceport** to begin with the spaceport overview. Audio starts from the first entry interaction; use **M** to mute it.

To direct your own launch:

1. Enter **Mission control** and press **C** to open the command console.
2. In **Checklist**, enable the eight launch systems individually or select **Run auto checkout**.
3. Complete the six station votes. Each vote cycles Pending → GO → NO GO; **Set all stations GO** is available for a quick checkout.
4. In **Vehicle**, set payload, propellant, throttle, guidance and **Return to Starbase**. In **Training**, set weather, wind, an anomaly and capsule/parachute options.
5. When all interlocks are satisfied, select **Start countdown**. Hold, resume, pause or abort as the flight develops.
6. Switch among all three viewpoints during the same flight. Inspect **Flight data**, then review the debrief or export the mission log.

Payload and propellant lock during terminal count. The training escape module is installed by default, so its escape command remains available on the pad, during ascent and in flight. Throttle and guidance remain available in flight. Audio requires a user interaction; the simulation pauses its time progression while the browser tab is hidden.

## Views and controls

| Control | Action |
|---|---|
| 1 / 2 / 3 | Mission control / commander / pad camera |
| C | Open or close the command console |
| S / 3 VIEWS | Toggle simultaneous Starship, booster and capsule views; S moves backward while FREE camera movement is active |
| Vehicle pane label | Make that vehicle the main view |
| SPACEPORT | Open the active spaceport overview and traffic board |
| Drag | Look around the room, cockpit or camera view |
| Click / E | Click a physical control, or aim at it and press E |
| Space | Pause or resume the simulation |
| H | Hold or resume the countdown |
| P | Arm capsule parachutes after separation |
| F | Toggle browser fullscreen |
| M | Mute or enable the complete audio experience, including speech |
| TRIPOD / CHASE / FREE | Ground camera / vehicle-following cinematic camera / pad exploration |
| FOLLOW: STARSHIP / BOOSTER / CAPSULE | Select the independently tracked vehicle |
| ENGINES | View the selected rocket from below to inspect its engine array |
| W / A / S / D in FREE | Move the pad camera forward / left / back / right |
| Q / R in FREE | Move down / up |
| Shift in FREE | Move faster |
| − / + | Adjust camera zoom |
| 1× / 5× / 10× / 25× | Change simulation speed |

The launch-pad environment includes a detailed reference stack and tower, support equipment, service structures, ground materials and launch effects. Engine and recovery camera selections expose the engine bells, detached booster, ship and capsule. The cockpit and mission room are imagined functional spaces, not reconstructions of real SpaceX interiors.

## Faults, abort and escape

The training panel can inject engine loss, telemetry dropout, pressure loss, structural breakup, guidance failure or wind shear. Launch gates reject an unsafe initial configuration. A late failed check holds the count at T−10; an ignition interlock safes the pad. An airborne abort cuts thrust and continues ballistic motion. Finished or safed vehicle scenarios reject new fault injections until reset.

The ejectable capsule is explicitly fictional and installed by default for this training scenario. **Crew escape** can be commanded whenever the vehicle is intact, including on the pad, during powered ascent, coast or return. Separation transfers the vehicle's current motion to an independently simulated capsule. Its finite escape burn produces thrust and visible exhaust, then cuts off; gravity and atmospheric drag continue to act until landing or impact.

Select **Deploy parachutes** or press **P** after escape to arm the large recovery canopies. The command is accepted immediately; opening waits for motor burnout, descending motion, sufficient atmosphere and a survivable deployment speed. The instruments distinguish stowed, armed/waiting, inflating and deployed canopies. Deployment takes time and drag builds with inflation. Without a parachute command or enabled automatic backup, the capsule remains in freefall. A very late command can still result in impact. Physical **PARACHUTES** and **RETURN / CATCH** buttons are also available in the cockpit; mission control has matching controls.

## V5 cinematic failures — October 4, 2026

For an airborne failure, choose **Quick launch**, wait for liftoff, press **C**, and open **Training → Anomaly training → Structural breakup → Inject fault**. Close the console to watch the rupture. For a surface impact, enter a mission, eject the training capsule and leave automatic parachute backup off without commanding parachutes. Reset starts a fresh exercise and clears the effects.

Destructive ship, booster and capsule impacts create major effects at their recorded contact positions. Airborne pressure loss, structural breakup and the existing structural-load limit create ruptures; an injected engine failure creates a smaller local burst. Safe pad aborts, normal tower catches, booster landings and parachute recoveries produce no explosion. A guidance failure or commanded flight abort continues ballistically until physical contact.

Fire, smoke, debris and shockwave rings are stylized visuals; their size and motion do not calculate blast damage, pressure propagation or real propellant combustion. All cameras share the same effects. They play at real-time speed even at 25× flight playback, freeze while paused or hidden, and a major incident delays the automatic debrief for ten active real-time seconds. **Settings → Camera shock** controls the camera impulse and exposure flash; **Engines & environment** controls blast sound and **M** mutes audio. Performance graphics reduces effect detail. Pools limit simultaneous bursts and retained ground marks.

## Booster landing and ship return

The default **Return to Starbase** recovery rehearsal flies a near-vertical trajectory above 100 km before returning to the launch area. After separation the booster automatically guides toward the marked landing zone, burns its engines to slow down and attempts a powered touchdown. Select **BOOSTER** in the recovery controls or **FOLLOW** camera menu to track it independently while Starship continues flying. The nominal model run reaches the tower about 9 minutes 36 seconds after liftoff; accelerated playback is available.

The ship then returns to the launch tower, slows for the catch corridor and attempts capture by the tower arms. **Return / catch** can request the return sequence. Both vehicles retain velocity, propellant, thrust and outcome state; failed recovery is possible. Disable the recovery rehearsal before launch to fly the original suborbital ascent/coast scenario instead.

The landing-zone Super Heavy and returning ship are gameplay training variants. SpaceX has demonstrated Super Heavy tower catches, while Falcon-family boosters use landing zones and droneships. This simulator combines a fictional booster landing site with a conceptual upper-stage tower catch. It is not a reconstruction of a real Starship flight or an orbital return calculation.

## Simultaneous views and spaceport traffic

**3 VIEWS** shows Starship, the detached booster and the escape capsule at once. Choose a pane label to focus that vehicle. Before separation, the corresponding pane shows its attached or stowed state. The flight model advances once; all three cameras observe that same state through one WebGL renderer and one shared world. This avoids running three independent simulations, although rendering three views still costs more than rendering one.

**SPACEPORT** opens an overview of five fictional operational sites, with scheduled departures, arrivals, ground traffic and a live board. These are authored background operations, not other online players or independently simulated orbital missions. Traffic uses elapsed real time rather than the main mission's 5×–25× time acceleration. Pausing a mission also pauses its traffic activity; the title screen can show traffic before a mission begins.

## Sound and mission radio

The original procedural score changes among control-room, ascent, coast and recovery themes. Engine layers follow the monitored vehicle; cockpit audio follows the cabin's vehicle. Wind, ocean, room ventilation, radio noise and staging, escape, landing and capture cues provide context. No music or sound recordings are downloaded.

Settings contain separate **Master**, **Cinematic score**, **Engines & environment** and **Mission narration** volumes. **Mission voice** can be switched off while retaining captions. Speech uses the browser's available voices, so voice choice and quality vary by device. Captions remain available when speech is muted or unavailable. At high simulation speeds, old callouts are discarded instead of building an overlapping speech queue. Pause, hiding the tab and muting stop audio activity.

## Loading and graphics

**Balanced** graphics and **Adaptive resolution** are enabled by default. Geometry can become playable before all textures finish loading; the status line distinguishes a playable scene from completion of the visual downloads. High quality additionally loads the HDR environment. The compressed texture set is 67.2% smaller than its source JPEG set; a normal default visit uses only part of that set.

The flight model runs on the browser CPU, rendering runs on the local GPU, and the host serves static files. There is no cloud-rendered game stream or server simulation for each player. The source audit gives a roughly 5–6 MB planning budget for an uncached default visit; this is not a measured connection speed or a first-frame timing guarantee. Use Performance graphics or one view if your device struggles. See [PERFORMANCE.md](PERFORMANCE.md) for the verified byte counts, rendering design, scaling estimates and measurement limits.

## Sharing

The [hosted entry point](https://starship-flight-director-hanlien.greentazn.chatgpt.site/) uses the hosting project's audience settings. Public anonymous access is a deployment setting and must be verified in a signed-out browser before announcing a public release. This source documentation does not certify the audience of a future or currently pending deployment.

To share on X, open the verified public page in a signed-out browser, copy its URL, then paste it into your own post. A short draft:

> Run a Starship launch from mission control. Follow the ship, booster and escape capsule in three live views, with a busy fictional spaceport and mission radio. Play in your browser: [your verified public link]

Posting is manual; this project does not connect to X or publish on your behalf.

## What is simulated

The reference vehicle has 33 booster and six ship engines. Its two-dimensional variable-mass flight model includes inverse-square gravity, atmospheric drag, propellant consumption, pitch guidance, load relief, engine-out effects and hot staging. Independent recovery guidance controls the detached booster and returning ship in the near-vertical rehearsal. Capsule escape includes a finite powered burn, ballistic motion and progressively inflated parachutes. Orbital insertion, orbital reentry heating, six-degree-of-freedom dynamics and real SpaceX guidance are outside the model.

The flight model is not validated against real telemetry. Its masses, guidance, limits, room layouts and operational workflow include illustrative assumptions. See [MODEL-NOTES.md](MODEL-NOTES.md) for the exact boundary and [repository checks](../README.md#checks) for the executable verification commands.

## Included files and credits

- `dist/` — runnable app and bundled offline assets.
- `tests/physics.cjs` — flight-model and command-behavior tests; run with `node tests/physics.cjs`.
- `tests/audio.cjs` — audio lifecycle, vehicle routing, narration queue and pooled-node checks; run with `node tests/audio.cjs`.
- `tests/failure-fx.cjs` — effect-buffer capacity, pause, quality changes, deterministic motion and cleanup checks; run with `node tests/failure-fx.cjs`.
- `PERFORMANCE.md` — resource budget, local execution model and static-hosting capacity boundaries.
- `dist/assets/v4/manifest.json` — compressed asset map and source/optimized byte totals.
- `MODEL-NOTES.md` — model assumptions, primary references and state contract.
- [Repository checks](../README.md#checks) — commands for flight, audio and effect verification.
- `dist/assets/v2/SOURCES.json` — exact asset provenance, license links and verification hashes.

Rendering uses Three.js r160. Photographic PBR materials and the sunset environment come from [Poly Haven](https://polyhaven.com/license), under CC0. Earth and space textures are by [Solar System Scope / INOVE](https://extension.solarsystemscope.com/textures/), under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Three.js and font license notices are included beside their files. The environment sky is an artistic baseline, not Texas geospatial imagery.
