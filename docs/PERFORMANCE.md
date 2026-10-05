# Performance and hosting notes

V5 source notes were updated October 4, 2026 (America/Los_Angeles). The resource table retains the V4 disk audit from October 3; its script subtotal is historical and has not been remeasured for V5 here. Byte sums are not a browser network trace, a load test, or a guarantee about the hosting provider. Runnable checks are documented in the [repository README](../README.md#checks); these source notes do not certify hosting availability or cross-device browser performance.

## Where the work happens

| Work | Location and behavior |
|---|---|
| Main mission physics | JavaScript on each player's browser CPU; one state advances for that session |
| Rendering | The player's GPU through WebGL and Three.js; one renderer/context owns the shared world |
| Three simultaneous views | Three camera passes with viewport/scissor rectangles, reused world transforms, one shared shadow update; no additional mission simulations |
| Spaceport traffic | Authored local scene animation with its own real-time clock; main mission time warp does not accelerate it |
| Music and effects | Local Web Audio synthesis with persistent pooled nodes and reusable noise buffers |
| Cinematic failures | Shared local instanced meshes, bounded bursts and synthesized blast voices; no extra simulation or downloaded explosion media |
| Narration | Browser/operating-system speech synthesis; captions provide the fallback |
| Host | Delivery of static HTML, JavaScript, CSS, fonts and images |

Each visit creates an independent local session. There is no multiplayer server, shared flight state, per-player cloud GPU, video stream, account system inside the app, or mission-data upload. A hosted deployment can still impose its own access gate.

Three views do not triple simulation work, but they do require three scene renders. Screen coverage is divided among the views rather than allocating three full-screen canvases. Three-view rendering skips the full-screen bloom pipeline and reuses the world and shadow map. The mission-control wall feed is rendered at a lower cadence, approximately eight times per second.

## Resource budget — historical V4 audit

The asset map was checked against the actual files:

| Resource set | Bytes | Decimal MB |
|---|---:|---:|
| Original 20 JPEG textures | 13,742,602 | 13.743 |
| Replacement 20 WebP textures | 4,509,780 | 4.510 |
| Texture savings | 9,232,822 | 9.233 |
| 13 unique texture URLs requested in the audited V4 default session | 3,106,768 | 3.107 |
| HTML, CSS, JavaScript and favicon referenced by the entry page | 1,017,554 | 1.018 |
| All nine declared font files | 707,000 | 0.707 |
| Default resource sum, conservatively including every declared font | 4,831,322 | 4.831 |
| Optional High-quality HDR environment, additional | 4,563,204 | 4.563 |

The full 20-texture conversion saves **67.2%**. The High-only HDR is approximately **4.35 MiB**; decimal MB and binary MiB are different units. Source JPEGs remain in the package for provenance and review, but `asset-map.js` redirects runtime texture requests to the WebP replacements. Normal and roughness maps retain their data roles; color maps retain their color-space handling.

The V4 audit found 13 of the 20 mapped WebP URLs requested by scene/interior construction. The larger conversion set also contains retained optional/reference assets. Fonts are loaded on demand by the browser; it may not request all nine declared faces. The same texture URL is used by several material instances. Identical PBR map/repeat requests share one texture object; other repeat settings share the decoded Texture.Source, allowing the renderer to reuse compatible image allocations. Materials and render targets still consume memory, and actual GPU allocation has not been profiled.

These figures are sums of unique file sizes. HTTP compression, caching, retries, browser font selection, hosting-injected resources and protocol overhead can change actual transfer totals. Source edits also change the small script/style subtotal. Use **5.5 MB per uncached Balanced entry** as a conservative planning example, not a measured download amount. Choosing High adds its HDR request. The standalone HTML embeds all mapped assets and the HDR as base64, so it has a larger initial footprint and does not receive the same deferred-download benefit.

## Startup and graphics settings

The application constructs its scene and displays a usable first render while textures can continue loading. Its status text reports ongoing texture work separately from readiness to play. There is no V4 cold-start first-frame measurement in this audit. Scene construction, shader compilation, image decoding and PMREM environment generation still require real work; progressive loading does not remove those costs.

| Setting | Current behavior |
|---|---|
| Balanced, default | Pixel-ratio cap 1.25; photographic sky/reflection baseline; bloom for a single view; no HDR download |
| High | Single-view pixel-ratio cap 1.75; HDR environment loads on demand; four-sample scene target when WebGL2 is available |
| Performance | Pixel-ratio cap 1; shadows and bloom disabled |
| Three views | Pixel-ratio cap 1.25, including High; shared shadow update; direct viewport rendering |
| Adaptive resolution, default on | Samples renderer submission cost and delivered frame cadence over roughly five seconds and adjusts internal pixel ratio, down to 0.75 |

Pixel-ratio caps are also limited by the device's own pixel ratio. Reducing internal resolution decreases fragment work and render-target memory; it does not reduce the number of simulated flight bodies.

The adaptive signal combines elapsed CPU submission time with delivered animation-frame intervals. It is **not a GPU timer query or GPU-completion measurement**; it responds to frame delivery pressure without attributing that pressure to a specific processor. The visible FPS counter reflects animation-loop delivery, not a laboratory benchmark. No minimum FPS, frame-time percentile, first-frame latency, VRAM budget or mobile-device coverage is promised by these implementation choices.

## Audio cost and behavior

Four original harmonic/melodic themes cover mission control, ascent, coast and recovery. Engine, atmosphere, room, radio and event layers are synthesized rather than downloaded. Oscillators and effect voices are pooled; ordinary updates and cues do not allocate a new set of audio nodes. Ambient and blast noise buffers are created during audio initialization and reused.

AudioContext creation requires a user interaction. Pause, a hidden tab and mute suspend sound activity; master mute also cancels speech. Narration has a bounded priority queue, expiry rules and accelerated-playback limits. Device voices differ in availability and quality. Some browser/OS voices may use a provider-backed speech service; the app supplies no external speech API key or custom audio service.

The source audio tests verify lifecycle, selected-vehicle routing, captions, queue behavior, pooled-node reuse and volume limits. They do not judge loudness balance, musical quality or device speaker output.

## V5 failure-effect budget

The scene allocates nine instanced mesh pools once and reuses their geometry, materials and instance buffers. At most five bursts can remain active, including no more than three major explosions. New incidents evict older effects when those limits are reached. Two point lights illuminate blasts; at most six ground marks remain until reset. Major bursts expire after 34 active real-time seconds and smaller engine bursts after 11. Changing graphics quality reduces drawing detail within the existing capacities.

| Detail per major burst | Performance | Balanced | High |
|---|---:|---:|---:|
| Fireball lobes | 5 | 8 | 8 |
| Smoke elements | 16 | 26 | 40 |
| Debris pieces created | 18 | 32 | 48 |
| Embers | 36 | 64 | 96 |

These are configured counts, not a particle-cost or frame-rate benchmark. Existing debris continues its trajectory when graphics quality changes. All views observe the same pool; each camera pass still incurs rendering cost. The renderer's particle shaders and geometry generate the fire, smoke and rings without external effect textures. The three body-specific blast audio voices are pooled, with impact crack, low-frequency body, rolling noise and debris layers. The effects volume and master mute gate these voices; stale muted events are discarded rather than replayed later.

Effect aging and the ten-second automatic-debrief delay use active real time, independent of mission acceleration. Pause or hiding the tab freezes progression. Reset clears effects, ground marks, deduplication state and pending blast audio. **Camera shock** disables the added camera impulse and exposure flash; the world effects remain visible. None of these bounds establishes a measured GPU-memory budget or guarantees a smooth worst-case triple-view explosion on every device.

## Static-hosting scale

A static host/CDN can serve the same resource files to many independent players. Concurrent players add file-delivery load, rather than one server-side flight simulation or game-rendering process per player. A slow player device still renders slowly even if the host is fast.

Using the illustrative 5.5 MB cold-entry budget:

| Completely uncached entries | Approximate content traffic |
|---:|---:|
| 100 | 550 MB |
| 1,000 | 5.5 GB |
| 10,000 | 55 GB |

These are decimal units and simple `entries × resource budget` estimates. They exclude High-quality HDR selection, failed/retried requests, overhead and any provider additions. Repeated visits may reuse cached content, but the actual caching policy and cache hit rate must be measured. A new deployment can invalidate some cached assets.

**The current host's request, bandwidth, concurrency, retention and billing limits have not been verified. No public load test has been run.** This architecture therefore supports a reasonable static-distribution model, but does not establish unlimited traffic capacity or a launch-day service-level guarantee. Anonymous access should be checked after the intended audience setting is applied; publishing a new build alone does not prove it is public.

## Data and access boundary

The application source loads its runtime code, fonts and visual assets from the same static package. It contains no analytics beacon, telemetry collector, application login, connector call, mission upload endpoint or multiplayer socket. JSON flight export is generated in the browser for the user to download or copy. Reference links in the manual open external source pages only when selected.

The host/CDN may retain ordinary HTTP access logs or apply its own access and service policies. Those platform behaviors are outside this app's source. Browser speech synthesis is also provided by the browser/OS, rather than implemented as an app-owned speech backend. The page has no access to real launch systems.

## Verification boundary and useful next measurements

Verified in source: the historical asset byte totals above, same-package asset routing, deferred HDR loading, one renderer with three viewport passes, real-time traffic clock, bounded failure pools and audio pooling/queue behavior. Browser interaction, shader compilation and final scene checks belong in the release's quality report. Source/Node tests cannot measure visual appearance or GPU completion time.

To establish a performance claim, record a cold-cache navigation on a named device/browser with a stated network condition, measure first interactive render and completed asset transfer separately, and collect frame-time samples during launch, three-view recovery and the traffic overview. Inspect cache headers and provider quotas before planning a large public announcement. A single smooth local run or a successful deployment is not a concurrency test.
