# STARSHIP Flight Director - environment asset pack

Downloaded and verified 2026-10-03. Assets are self-hosted; runtime does not use source APIs.

## Photography and PBR maps

- **Belfast Sunset (Pure Sky)**, Dimitrios Savva / Greg Zaal / Jarod Guest, [Poly Haven](https://polyhaven.com/a/belfast_sunset_puresky), [CC0](https://polyhaven.com/license). `sky-sunset-2k.hdr` is the original 2048 × 1024 RGBE HDR map. `sky-sunset-4k.jpg` is the official tonemapped panorama resized from 8192 × 4096 to 4096 × 2048. The environment is an artistic sky baseline, not Texas geospatial imagery.
- **Concrete Floor Worn 001**, Dimitrios Savva / Rico Cilliers, [Poly Haven](https://polyhaven.com/a/concrete_floor_worn_001), CC0. `concrete-{color,normal,roughness}.jpg`. Physical tile span 3m.
- **Asphalt 02**, Rob Tuytel, [Poly Haven](https://polyhaven.com/a/asphalt_02), CC0. `asphalt-{color,normal,roughness}.jpg`. Physical tile span 3m.
- **Gravel Floor**, Matterfield / Jenelle van Heerden, [Poly Haven](https://polyhaven.com/a/gravel_floor), CC0. `gravel-{color,normal,roughness}.jpg`. Physical tile span 2.3m.
- **Metal Plate**, Rob Tuytel, [Poly Haven](https://polyhaven.com/a/metal_plate), CC0. `metal-{color,normal,roughness}.jpg`. Physical tile span 0.5m; weathered diamond plate.
- **Scuba Suede**, colormass / Rico Cilliers, [Poly Haven](https://polyhaven.com/a/scuba_suede), CC0. `fabric-{color,normal,roughness}.jpg`. Physical tile span 0.3m; technical neoprene-like material.

All PBR maps are original 1024-pixel JPEG exports. Normal maps use OpenGL (positive Y), not DirectX. Color textures require sRGB color space; normal and roughness textures remain linear. Scale repetition by world span divided by the listed physical tile span. Use modest normal strength on interior panels to avoid exaggerated embossing.

## Planet and space maps

`earth-color.jpg`, `earth-clouds.jpg`, `earth-night.jpg`, `stars-milkyway.jpg`: [Solar System Scope / INOVE](https://extension.solarsystemscope.com/textures/), based in part on NASA imagery. [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). These are unchanged original 2K maps. Credit Solar System Scope in visible simulator credits and preserve this notice when redistributing. Earth textures are composites for rendering, not current Earth observation imagery.

## Loader

`RGBELoader.js`: Three.js r160 official loader, [source](https://github.com/mrdoob/three.js/blob/r160/examples/jsm/loaders/RGBELoader.js), MIT license in `THREE-LICENSE.txt`. Only ES-module import/export declarations were changed to an IIFE exposing `THREE.RGBELoader`. Include after Three and before scene construction. Load HDR as EquirectangularReflectionMapping and use PMREM for physically based reflections.

## Verification

Poly Haven originals were byte-verified against MD5 values in its public file API. `SOURCES.json` lists download URLs, provenance, license links, and digests. The resized sky carries its own SHA256. No private assets, site preview renders, trademarks, or paywalled models are included.
