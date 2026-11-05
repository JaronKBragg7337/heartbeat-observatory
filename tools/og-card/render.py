"""Render the home share card from card.json, and the H-heartbeat brand PNG.

    python tools/og-card/render.py            # writes <site root>/<card.json "out"> (e.g. og-home-2026-11.jpg)
    python tools/og-card/render.py --thumb    # also writes a phone-size preview (360 px wide) to your temp folder
    python tools/og-card/render.py --brand    # also re-renders brand/h-heartbeat.png from brand/h-heartbeat.svg

Needs Python Playwright (pip install playwright; python -m playwright install chromium).
After a new filename: update og:image / twitter:image in index.html (the deploy check warns if you forget).
"""
import json
import sys
import tempfile
from pathlib import Path

from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent

card = json.loads((HERE / "card.json").read_text(encoding="utf-8"))
out = ROOT / card["out"]

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1200, "height": 630})
    pg.add_init_script("window.CARD = " + json.dumps(card) + ";")
    pg.goto((HERE / "og-card.html").as_uri())
    pg.wait_for_selector("body[data-ready='1']")
    pg.wait_for_load_state("networkidle")
    pg.wait_for_timeout(300)
    pg.screenshot(path=str(out), type="jpeg", quality=90)
    print("card:", out)
    if "--thumb" in sys.argv:
        from PIL import Image  # pip install pillow
        thumb = Path(tempfile.gettempdir()) / (out.stem + "-thumb.png")
        Image.open(out).resize((360, 189), Image.LANCZOS).save(thumb)
        print("thumb:", thumb)
    if "--brand" in sys.argv:
        s = b.new_page(viewport={"width": 512, "height": 512})
        s.goto((ROOT / "brand" / "h-heartbeat.svg").as_uri())
        s.screenshot(path=str(ROOT / "brand" / "h-heartbeat.png"), omit_background=True)
    b.close()
