"""Mobile audit: python3 tests/mobile-audit.py. Checks every panel + modal at phone/tablet widths:
horizontal overflow, form fields under 16px (iOS zooms the page on focus), small tap targets."""
import pathlib, sys
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parent.parent / 'public'
SIZES = [(360, 740), (390, 844), (430, 932), (844, 390), (768, 1024)]  # (844,390) = iPhone landscape
JS = """() => {
  const vis = e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const fields = [...document.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=hidden]),select,textarea')]
    .filter(vis).filter(e => parseFloat(getComputedStyle(e).fontSize) < 16)
    .map(e => (e.id || e.name || e.tagName) + ':' + getComputedStyle(e).fontSize);
  const small = [...document.querySelectorAll('button,a[href],.tab,.filter-chip')].filter(vis)
    .filter(e => { const r = e.getBoundingClientRect(); return r.height < 36 && !e.closest('p,li,.cb,.legal-body'); })
    .map(e => (e.id || e.className || e.tagName).toString().slice(0, 24) + ':' + Math.round(e.getBoundingClientRect().height));
  return { overflow: document.documentElement.scrollWidth - window.innerWidth, fields, small: [...new Set(small)].slice(0, 6) };
}"""
bad = 0
with sync_playwright() as p:
    b = p.chromium.launch()
    for w, h in SIZES:
        ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=3, is_mobile=True, has_touch=True)
        pg = ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto((root / 'index.html').as_uri() + '?demo=1'); pg.wait_for_timeout(700)
        panels = pg.evaluate("[...document.querySelectorAll('.pn')].map(p=>p.id.slice(2))")
        for name in panels:
            pg.evaluate(f"sw('{name}', document.querySelector('.tab'))"); pg.wait_for_timeout(120)
            r = pg.evaluate(JS)
            ok = r['overflow'] <= 1 and not r['fields']
            bad += (not ok)
            print(f"{'OK  ' if ok else 'FAIL'} {w}px panel:{name:10} overflow={r['overflow']} fields<16px={r['fields'][:4]} smallTargets={r['small'][:3]}")
        for mid in ['authModal', 'accountModal', 'notifModal']:
            pg.evaluate(f"document.getElementById('{mid}').style.display='flex'"); pg.wait_for_timeout(100)
            r = pg.evaluate(JS)
            fit = pg.evaluate(f"(()=>{{const i=document.getElementById('{mid}').firstElementChild;const b=i.getBoundingClientRect();return b.height<=innerHeight&&['auto','scroll'].includes(getComputedStyle(i).overflowY)}})()")
            ok = r['overflow'] <= 1 and not r['fields'] and fit; bad += (not ok)
            print(f"{'OK  ' if ok else 'FAIL'} {w}x{h} modal:{mid:12} overflow={r['overflow']} fields<16px={r['fields'][:4]} fitsScreen={fit}")
            pg.evaluate(f"document.getElementById('{mid}').style.display='none'")
        for e in errs: print('ERR', e); bad += 1
        ctx.close()
    b.close()
print('RESULT:', 'all clear' if not bad else f'{bad} problem(s)')
sys.exit(1 if bad else 0)
