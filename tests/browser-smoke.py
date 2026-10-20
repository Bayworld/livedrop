"""Headless smoke test: python3 tests/browser-smoke.py  (needs: pip install playwright && playwright install chromium)"""
import pathlib, sys
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parent.parent / 'public'
errors, fails = [], []
def check(name, cond):
    print(('PASS ' if cond else 'FAIL ') + name)
    if not cond: fails.append(name)
with sync_playwright() as p:
    b = p.chromium.launch()
    for label, vp in (('desktop', {'width': 1280, 'height': 800}), ('phone', {'width': 375, 'height': 740})):
        pg = b.new_page(viewport=vp)
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.goto((root / 'index.html').as_uri() + '?demo=1'); pg.wait_for_timeout(800)
        check(f'{label}: page renders text', len(pg.inner_text('body')) > 200)
        check(f'{label}: no sideways scroll', pg.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'))
        pg.screenshot(path=f'/tmp/shot-{label}.png')
        if label == 'desktop':
            check('escapeJs blocks entity breakout', pg.evaluate("""()=>{const n="&#39;);window.__x=1;//";const d=document.createElement('div');d.innerHTML='<b onclick="f(\\''+escapeJs(n)+'\\')"></b>';const code=d.firstChild.getAttribute('onclick');window.f=()=>{};try{new Function(code)();}catch(e){}return !window.__x}"""))
            check('escapeJs blocks quote breakout', pg.evaluate("""()=>{const n="');window.__y=1;//";const d=document.createElement('div');d.innerHTML='<b onclick="f(\\''+escapeJs(n)+'\\')"></b>';window.f=()=>{};new Function(d.firstChild.getAttribute('onclick'))();return !window.__y}"""))
            check('escapeHtml escapes single quote', pg.evaluate("escapeHtml(\"'\")==='&#39;'"))
        pg.close()
    b.close()
check('no uncaught JS errors', not errors)
for e in errors: print('  ERR', e)
sys.exit(1 if fails else 0)
