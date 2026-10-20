"""Proves the delegated action system works (no inline handlers): tabs, filters, modals, report modal. python3 tests/actions-test.py"""
import pathlib, re
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parent.parent / 'public'
fails = []
def check(n, c):
    print(('PASS ' if c else 'FAIL ') + n)
    if not c: fails.append(n)
html = (root / 'index.html').read_text()
check('no inline on* handlers left in index.html', not re.search(r'\son(click|input|submit|change)=', html))
check('CSP has no unsafe-inline for scripts', "script-src 'self';" in (root / '_headers').read_text())
with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    for label, vp in (('desktop', {'width': 1280, 'height': 800}), ('phone', {'width': 375, 'height': 740})):
        pg = b.new_page(viewport=vp); pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto((root / 'index.html').as_uri() + '?demo=1'); pg.wait_for_timeout(700)
        if label == 'desktop':
            pg.click('.tabs .tab[data-act*="creators"]'); check('tab click switches panel', pg.is_visible('#p-creators'))
            pg.click('.tabs .tab[data-act*="explore"]'); pg.click('.filter-chip >> nth=1'); check('filter chip becomes active', 'on' in (pg.get_attribute('.filter-chip >> nth=1', 'class') or ''))
            pg.evaluate("document.getElementById('reportModal').style.display='flex'"); pg.click('#reportModal [data-act="closeReport()"]'); check('report modal Cancel closes it', not pg.is_visible('#reportModal'))
        else:
            pg.click('#bottomNav button >> nth=1'); check('phone bottom bar switches to Creators', pg.is_visible('#p-creators'))
        pg.close()
    check('no uncaught JS errors', not errs)
raise SystemExit(1 if fails else 0)
