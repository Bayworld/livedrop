# Static checks, no browser needed:  python3 tests/static-audit.py
import re, subprocess, sys, glob, pathlib
root = pathlib.Path(__file__).resolve().parent.parent / 'public'
html = (root / 'index.html').read_text(encoding='utf-8')
files = sorted(glob.glob(str(root / 'js' / '**' / '*.js'), recursive=True))
order = re.findall(r'<script src="(js/[^"]+)"', html)
js = '\n'.join(pathlib.Path(root / f).read_text(encoding='utf-8') for f in order)
ok = all(subprocess.run(['node', '--check', f]).returncode == 0 for f in files)
unlisted = sorted(set(str(pathlib.Path(f).relative_to(root)) for f in files) - set(order))
defs = set(re.findall(r'function\s+(\w+)', js)) | set(re.findall(r'(?:const|let|var)\s+(\w+)\s*=', js))
calls = set(c for m in re.findall(r'on\w+="([^"]*)"', html) for c in re.findall(r'\b([A-Za-z_]\w*)\s*\(', m))
bad = sorted(c for c in calls if c not in defs | {'if'})
ids = set(re.findall(r'id="([^"]+)"', html))
miss = sorted(u for u in set(re.findall(r"getElementById\('([^']+)'\)", js)) if u not in ids and u not in {'pfFollowBtn','lrAsk','lrCount'})
fake = [w for w in ['Escrow vault', 'Platform take', '3,135', 'Wallet refund', 'Spotlight'] if w in html]
# security: no secret keys, no eval, no document.write
secrets = [k for k in ['service_role', 'sk_live', 'sk_test'] if k in html + js]
danger = [k for k in ['eval(', 'document.write(', 'new Function('] if k in js]
stray = [l[:50] for l in html.split('\n') if re.match(r'^\s*(\.[\w-]+|@media|/\*)[^<]*[{}]', l)]
print('stray CSS in html:', stray[:2])
print('JS syntax ok:', ok, '| unlisted js:', unlisted, '| undefined handlers:', bad, '| missing ids:', miss,
      '| fake claims:', fake, '| secrets:', secrets, '| dangerous calls:', danger)
sys.exit(0 if ok and not (stray or unlisted or bad or miss or fake or secrets or danger) else 1)
