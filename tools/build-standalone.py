"""Create a portable HTML edition with every runtime asset embedded. Python stdlib only."""
from pathlib import Path
import base64, json, mimetypes, re, sys
root = Path(__file__).resolve().parents[1]
dist = root / 'dist'
out = Path(sys.argv[1]) if len(sys.argv)>1 else root/'artifacts/Starship-Flight-Director.html'
def uri(path):
    mime = mimetypes.guess_type(str(path))[0] or 'application/octet-stream'
    return 'data:'+mime+';base64,'+base64.b64encode(path.read_bytes()).decode()
def style(match):
    content=(dist/match.group(1)).read_text()
    return '<style>'+re.sub(r'url\(([^)]+)\)',lambda m:'url('+uri(dist/m.group(1).strip('\"\''))+')',content)+'</style>'
html=(dist/'index.html').read_text()
html=re.sub(r'<link rel="stylesheet" href="([^"]+)">',style,html)
html=html.replace('href="assets/favicon.svg"','href="'+uri(dist/'assets/favicon.svg')+'"')
html=html.replace('href="assets/v2/SOURCES.json"','href="'+uri(dist/'assets/v2/SOURCES.json')+'"')
manifest=json.loads((dist/'assets/v4/manifest.json').read_text())
asset_paths=set(manifest['map'].values()) | {'assets/v2/sky-sunset-2k.hdr'}
assets={name:uri(dist/name) for name in sorted(asset_paths)}
loader='\nwindow.STARSHIP_EMBEDDED_ASSETS='+json.dumps(assets,separators=(',',':'))+';\n'
def script(match):
    path=match.group(1)
    content=(dist/path).read_text().replace('</script','<\\/script')
    if path=='assets/three.min.js': content+=loader
    return '<script>'+content+'</script>'
html=re.sub(r'<script src="([^"]+)"></script>',script,html)
notices = (root / 'THIRD-PARTY-NOTICES.md').read_text()
license_block = '<script type="text/plain" id="third-party-notices">\n' + notices.replace('</script', '<\\/script') + '\n</script>'
html = html.replace('</body>', license_block + '\n</body>')
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(html)
print(f'Created {out.name}: {out.stat().st_size:,} bytes; {len(assets)} embedded visual assets.')
