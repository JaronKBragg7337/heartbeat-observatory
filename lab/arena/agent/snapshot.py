"""snapshot.py - the AI player's camera: draws one moment of The Arena from its character's eyes into a PNG.

    python snapshot.py --state state.json --out view.png [--w 960 --h 540]

arena-agent.mjs `snapshot` writes the state (its position and facing, the other players, balls in flight, splats, score)
and calls this. It serves the site repo on 127.0.0.1, opens /lab/arena/<page>/ in headless Chromium with that state set
as window.__ARENA_SNAPSHOT, and screenshots it. In that mode arena.js never mounts the shell, and this script blocks
every request that is not the local server or three.js, so the camera NEVER joins the live channel as an extra player.
"""
import argparse, functools, http.server, json, sys, threading
from pathlib import Path
from playwright.sync_api import sync_playwright

SITE = Path(__file__).resolve().parents[3]


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--state", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--w", type=int, default=960)
    ap.add_argument("--h", type=int, default=540)
    a = ap.parse_args()
    state = json.loads(Path(a.state).read_text(encoding="utf8"))
    page_id = "b" if (state.get("me") or {}).get("zone") == "b" else "a"

    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=str(SITE)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{srv.server_address[1]}"
    errors = []
    try:
        with sync_playwright() as pw:
            br = pw.chromium.launch(headless=True, args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
            ctx = br.new_context(viewport={"width": a.w, "height": a.h}, device_scale_factor=1)
            page = ctx.new_page()
            page.route("**/*", lambda r: r.continue_() if (r.request.url.startswith(base) or r.request.url.startswith("https://cdn.jsdelivr.net/npm/three@"))
                       and not any(s in r.request.url for s in ("/bubble.js", "/hb-editor.js", "/lab/lab-top.js")) else r.abort())
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.add_init_script("window.__ARENA_SNAPSHOT = " + json.dumps(state) + ";")
            page.goto(f"{base}/lab/arena/{page_id}/?snapshot=1", wait_until="load")
            page.wait_for_function("window.__arenaReady === true", timeout=90000)
            Path(a.out).parent.mkdir(parents=True, exist_ok=True)
            page.screenshot(path=a.out)
            br.close()
    finally:
        srv.shutdown()
    if errors:
        print("page errors: " + " | ".join(errors)[:800], file=sys.stderr)
    print(a.out)


if __name__ == "__main__":
    main()
