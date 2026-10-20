"""Deploy config checks: python3 tests/deploy-check.py
Keeps vercel.json in step with public/_headers and proves the config builder refuses unsafe keys."""
import base64, json, os, pathlib, subprocess, tempfile, shutil

root = pathlib.Path(__file__).resolve().parent.parent
fails = []

def check(name, ok):
    print(('PASS ' if ok else 'FAIL ') + name)
    if not ok:
        fails.append(name)

# 1. vercel.json carries every header from _headers
netlify = {}
cur = None
for line in (root / 'public/_headers').read_text().splitlines():
    if not line.strip():
        continue
    if not line.startswith(' '):
        cur = line.strip().replace('/*', '/(.*)') if line.strip() != '/*' else '/(.*)'
        netlify[cur] = {}
    else:
        k, v = line.strip().split(':', 1)
        netlify[cur][k.strip()] = v.strip()
vercel = {h['source']: {x['key']: x['value'] for x in h['headers']} for h in json.loads((root / 'vercel.json').read_text())['headers']}
check('vercel.json has the same header groups as _headers', set(vercel) == set(netlify))
check('vercel.json header values match _headers exactly', vercel == netlify)
check('CSP forbids inline scripts', "script-src 'self';" in vercel['/(.*)']['Content-Security-Policy'])
cfg = json.loads((root / 'vercel.json').read_text())
check('output directory is public', cfg['outputDirectory'] == 'public')

# 2. config builder: run it against a throwaway copy
def build(env_extra, vercel_flag=True):
    tmp = pathlib.Path(tempfile.mkdtemp())
    (tmp / 'scripts').mkdir(); (tmp / 'public').mkdir()
    shutil.copy(root / 'scripts/build-config.mjs', tmp / 'scripts/')
    env = {k: v for k, v in os.environ.items() if not k.startswith(('SUPABASE', 'CONTACT', 'PAYMENTS', 'VERCEL'))}
    if vercel_flag:
        env['VERCEL'] = '1'
    env.update(env_extra)
    r = subprocess.run(['node', str(tmp / 'scripts/build-config.mjs')], env=env, capture_output=True, text=True)
    out = (tmp / 'public/config.js')
    return r.returncode, (out.read_text() if out.exists() else '')

def jwt(role):
    part = lambda d: base64.urlsafe_b64encode(json.dumps(d).encode()).decode().rstrip('=')
    return part({'alg': 'HS256'}) + '.' + part({'role': role}) + '.sig'

good_url = 'https://abcdefghij.supabase.co'
code, out = build({'SUPABASE_URL': good_url, 'SUPABASE_ANON_KEY': 'sb_publishable_abc123'})
check('valid publishable key builds config.js', code == 0 and good_url in out and 'PAYMENTS_ENABLED = false' in out)
code, _ = build({'SUPABASE_URL': good_url, 'SUPABASE_ANON_KEY': jwt('anon')})
check('legacy anon JWT is accepted', code == 0)
code, _ = build({'SUPABASE_URL': good_url, 'SUPABASE_ANON_KEY': jwt('service_role')})
check('service_role JWT is refused', code != 0)
code, _ = build({'SUPABASE_URL': good_url, 'SUPABASE_ANON_KEY': 'sb_secret_abc'})
check('sb_secret key is refused', code != 0)
code, _ = build({'SUPABASE_URL': 'http://evil.example.com', 'SUPABASE_ANON_KEY': 'sb_publishable_abc'})
check('non-supabase URL is refused', code != 0)
code, _ = build({})
check('missing variables fail the Vercel build', code != 0)
code, out = build({'SUPABASE_URL': good_url, 'SUPABASE_ANON_KEY': 'sb_publishable_abc', 'CONTACT_EMAIL': 'x";alert(1);//@a.com'})
check('hostile contact email is refused', code != 0)
code, out = build({'SUPABASE_URL': good_url, 'SUPABASE_ANON_KEY': 'sb_publishable_abc', 'PAYMENTS_ENABLED': 'yes'})
check('payments stay off unless exactly "true"', code == 0 and 'PAYMENTS_ENABLED = false' in out)

print('RESULT:', ('FAILURES: ' + ', '.join(fails)) if fails else 'all clear')
raise SystemExit(1 if fails else 0)
