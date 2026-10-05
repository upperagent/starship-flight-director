"""Build browser texture derivatives. Originals and credits remain in assets/v2."""
from pathlib import Path
import json
from PIL import Image
root=Path(__file__).resolve().parents[1]; dist=root/'dist'; src=dist/'assets/v2'; dst=dist/'assets/v4'
dst.mkdir(exist_ok=True)
mapping={}; original=0; optimized=0
for p in sorted(src.glob('*.jpg')):
    im=Image.open(p)
    limit=2048 if p.name.startswith(('sky-','earth-','stars-')) else 1024
    im.thumbnail((limit,limit),Image.Resampling.LANCZOS)
    out=dst/(p.stem+'.webp')
    im.save(out,'WEBP',quality=88 if 'normal' in p.stem else 82,method=6)
    mapping[str(p.relative_to(dist))]=str(out.relative_to(dist));original+=p.stat().st_size;optimized+=out.stat().st_size
manifest={'sourceBytes':original,'optimizedBytes':optimized,'map':mapping}
(dst/'manifest.json').write_text(json.dumps(manifest,indent=2))
js='/* Compressed browser assets; source licensing retained in assets/v2/SOURCES.json. */\nwindow.STARSHIP_ASSET_MAP='+json.dumps(mapping,separators=(',',':'))+';\nTHREE.DefaultLoadingManager.setURLModifier(function(url){var mapped=window.STARSHIP_ASSET_MAP[url]||url;return (window.STARSHIP_EMBEDDED_ASSETS||{})[mapped]||(window.STARSHIP_EMBEDDED_ASSETS||{})[url]||mapped;});\n'
(dist/'asset-map.js').write_text(js)
print(f'{len(mapping)} textures: {original:,} → {optimized:,} bytes ({100*(1-optimized/original):.1f}% smaller)')
