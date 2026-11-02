"""browser_check.py - The Arena in headless Chromium and WebKit at 375 px, OFF the live channels.

    python lab/arena/test/browser_check.py            # both browsers
    python lab/arena/test/browser_check.py chromium   # one

Serves the site repo on 127.0.0.1, opens /lab/arena/a/ as a phone (375 x 812, touch), and blocks every request that
is not this local server or three.js on jsdelivr. That includes the realtime client (@supabase/supabase-js), so the
test guest never joins hb-arena: other players are injected through the page's test handle instead.

Checks: spawn by URL (team A), a ball fired from A crosses the seam ("crossed A→B"), a ball from a fake B player hits
me and MY side reports it (score B 1, out, respawn at base after 3 s), a hit I report on someone else (score A 1),
walking across the line switches the URL to /b/ and Back returns, the zones.json hot-load adds a bunker without a
reload, no console errors. Screenshots go to the scratch folder given by --out (default: lab/arena/test/shots/).
"""
import functools, http.server, json, sys, threading, time
from pathlib import Path
from playwright.sync_api import sync_playwright

SITE = Path(__file__).resolve().parents[3]
OUT = Path(next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--out=")), str(SITE / "lab/arena/test/shots")))
WANT = [a for a in sys.argv[1:] if not a.startswith("--")] or ["chromium", "webkit"]


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def serve():
    h = functools.partial(Quiet, directory=str(SITE))
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), h)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def run(pw, name, base):
    br = getattr(pw, name).launch(headless=True, args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] if name == "chromium" else [])
    ctx = br.new_context(viewport={"width": 375, "height": 812}, device_scale_factor=2, has_touch=True, is_mobile=(name == "chromium"))
    page = ctx.new_page()
    errors, aborted, hot = [], set(), {"text": None}

    def route(r):
        u = r.request.url
        if u.startswith(base):
            if hot["text"] is not None and "/lab/arena/zones.json" in u:
                return r.fulfill(status=200, content_type="application/json", body=hot["text"])
            return r.continue_()
        if u.startswith("https://cdn.jsdelivr.net/npm/three@"):
            return r.continue_()
        aborted.add(u.split("?")[0])
        return r.abort()
    page.route("**/*", route)

    every = []

    def on_console(m):
        every.append(f"{m.type}: {m.text[:160]}")
        if m.type != "error":
            return
        loc = (m.location or {}).get("url", "") or ""
        if loc.split("?")[0] in aborted or "Failed to load resource" in m.text and (not loc.startswith(base) or "supabase" in m.text):
            return   # a request this test blocked on purpose
        errors.append(m.text[:300])
    page.on("console", on_console)
    page.on("pageerror", lambda e: errors.append("pageerror: " + str(e)[:300]))
    pending = {}
    page.on("request", lambda r: pending.__setitem__(r.url, 1))
    page.on("requestfinished", lambda r: pending.pop(r.url, None))
    page.on("requestfailed", lambda r: pending.pop(r.url, None))

    res = {}
    page.goto(base + "/lab/arena/a/", wait_until="load")
    try:
        page.wait_for_function("window.__arena && window.__arena.ready && document.getElementById('loading').classList.contains('off')", timeout=90000)
    except Exception:
        raise RuntimeError(f"page never became ready; errors: {errors}; still loading: {list(pending)[:8]}; state: {page.evaluate('[!!window.__arena, document.getElementById(`loading`).className]')}; console: {every[-12:]}; loaded: {page.evaluate("performance.getEntriesByType('resource').map(e => e.name.replace(location.origin, '').slice(0, 60))")}")
    page.wait_for_timeout(1500)
    st = page.evaluate("window.__arena.state")
    res["spawn"] = {"zone": st["zone"], "team": st["team"], "url": st["url"], "x": st["me"]["x"], "cover": st["cover"], "connected": st["connected"]}
    assert st["team"] == "a" and st["zone"] == "a" and st["url"] == "/lab/arena/a/", st
    assert not st["connected"], "the test guest must stay off the live channel"
    OUT.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(OUT / f"{name}-spawn.png"))

    # 1. fire from A across the seam
    page.evaluate("window.__arena.teleport(-6, 0); window.__arena.aimAt(8, 0)")
    page.wait_for_timeout(300)
    page.evaluate("window.__arena.fireAt(8, 1.2, 0)")
    page.wait_for_timeout(250)
    page.screenshot(path=str(OUT / f"{name}-ball-in-flight.png"))
    page.wait_for_timeout(1200)
    log = [l["text"] for l in page.evaluate("window.__arena.log")]
    res["cross"] = [l for l in log if "crossed A→B" in l]
    assert res["cross"], log

    # 2. a fake player on B fires at me; MY side decides the hit
    page.evaluate("""async () => {
      const FD = await import('/lab/arena/field.js');
      const sh = window.HBShell.current, now = performance.now();
      sh.peers.set('peer-b', { id: 'peer-b', name: 'Test B', place: 'b|b', appearance: { ai: true }, color: '#1f9bd6',
        buf: [{ t: now, x: 6, y: 0, z: 0, yaw: -1.5708, pitch: 0, stance: 'stand' }], last: now });
      const s = window.__arena.state.me, F = window.__arena.F();
      const p = [5.4, 1.26, 0], v = FD.solveLaunch(F, p, [s.x, 1.1, s.z]);
      window.__arena.inject('arena-fire', { ball: { id: 'B-TEST1', by: 'peer-b', byName: 'Test B', team: 'b', page: 'b', pages: ['b'], t0: Date.now(), p, v } });
    }""")
    page.wait_for_timeout(1000)
    st = page.evaluate("window.__arena.state")
    log = [l["text"] for l in page.evaluate("window.__arena.log")]
    res["got_hit"] = {"out": st["me"]["out"], "score": st["score"], "log": [l for l in log if "tagged you" in l or "crossed B→A" in l]}
    assert st["me"]["out"] and st["score"]["b"] == 1, (st, log)
    page.screenshot(path=str(OUT / f"{name}-tagged.png"))
    page.wait_for_timeout(3200)
    st = page.evaluate("window.__arena.state")
    res["respawn"] = {"out": st["me"]["out"], "x": st["me"]["x"], "z": st["me"]["z"]}
    assert not st["me"]["out"] and st["me"]["x"] < -16, st

    # 3. a hit I report on someone else (as the target's side would) scores for A
    page.evaluate("window.__arena.inject('arena-hit', { hit: { ball: 'A-TEST2', by: window.__arena.state.key, byName: 'You', byTeam: 'a', target: 'peer-b', targetName: 'Test B', targetTeam: 'b', at: Date.now(), p: [6, 1.2, 0] } })")
    st = page.evaluate("window.__arena.state")
    res["scored"] = st["score"]
    assert st["score"]["a"] == 1 and st["me"]["hits"] == 1, st

    # 4. walk across the line: the URL changes, Back returns
    page.evaluate("window.__arena.teleport(1.2, 0)")
    page.wait_for_timeout(200)
    res["cross_walk"] = page.evaluate("[window.__arena.state.zone, location.pathname, document.title]")
    assert res["cross_walk"][1] == "/lab/arena/b/", res["cross_walk"]
    page.go_back()
    page.wait_for_timeout(300)
    res["back"] = page.evaluate("[window.__arena.state.zone, location.pathname, window.__arena.state.me.x]")
    assert res["back"][1] == "/lab/arena/a/", res["back"]

    # 5. hot-load: a bunker added to zones.json arrives without a reload
    data = json.loads((SITE / "lab/arena/zones.json").read_text(encoding="utf8"))
    data["cover"].append({"id": "T-block", "kind": "block", "x": 0, "z": 6, "w": 1.2, "d": 1.2, "h": 1.2})
    hot["text"] = json.dumps(data, indent=2)
    page.evaluate("window.__arena.pollZones(true)")
    page.wait_for_timeout(1500)
    st = page.evaluate("window.__arena.state")
    log = [l["text"] for l in page.evaluate("window.__arena.log")]
    res["hotload"] = {"cover": st["cover"], "log": [l for l in log if "updated live" in l]}
    assert st["cover"] == 19 and res["hotload"]["log"], res["hotload"]
    page.evaluate("window.__arena.teleport(-4, 2); window.__arena.aimAt(0, 6)")
    page.wait_for_timeout(500)
    page.screenshot(path=str(OUT / f"{name}-hotload.png"))
    res["draw_calls"] = page.evaluate("window.__arena.state.draws")
    res["fire_button"] = page.evaluate("(() => { const b = document.querySelector('.hbs-act.go'); return b ? [b.textContent, getComputedStyle(b).display, !b.classList.contains('hide')] : null })()")
    res["hscroll"] = page.evaluate("document.documentElement.scrollWidth > innerWidth")
    res["errors"] = errors
    br.close()
    return res


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    srv = serve()
    base = f"http://127.0.0.1:{srv.server_address[1]}"
    ok = True
    with sync_playwright() as pw:
        for name in WANT:
            try:
                r = run(pw, name, base)
                print(f"== {name}: PASS" if not r["errors"] else f"== {name}: checks pass, console errors:")
                print(json.dumps(r, indent=1, ensure_ascii=False))
                ok = ok and not r["errors"]
            except Exception as e:
                ok = False
                print(f"== {name}: FAIL {e}")
    srv.shutdown()
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
