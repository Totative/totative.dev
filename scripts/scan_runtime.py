"""Runtime behaviour scan of the built site, served by `astro preview` or the container.

usage: scan_runtime.py BASE_URL OUT_DIR
Writes runtime.json (raw) and runtime.txt (summary) into OUT_DIR.
"""

import json
import sys
from typing import Any
from urllib.parse import urlparse

from playwright.sync_api import BrowserContext, Page, Route, sync_playwright
from playwright.sync_api import Error as PlaywrightError

PAGES = [
    "/",
    "/writeups/",
    "/writeups/checking-a-totative-release/",
]
VIEWPORTS = {"desktop": (1440, 900), "phone": (390, 844)}
IDLE_SECONDS = 15
CPU_FLAG = 0.20
CSP = (
    "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; "
    "connect-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; "
    "upgrade-insecure-requests"
)

INIT_SCRIPT = r"""
(() => {
  const log = (window.__scan = { fp: [], api: [] });
  const caller = () => {
    const lines = String(new Error().stack || '').split('\n').slice(4);
    const hit = lines.find((l) => !l.includes('__scan')) || lines[0] || '';
    return hit.trim().replace(/^at /, '');
  };
  const note = (bucket, name) => log[bucket].push({ name, from: caller() });
  const wrap = (proto, key, bucket, label) => {
    if (!proto) return;
    const d = Object.getOwnPropertyDescriptor(proto, key);
    if (!d) return;
    if (typeof d.value === 'function') {
      const orig = d.value;
      Object.defineProperty(proto, key, { ...d, value: function (...a) { note(bucket, label); return orig.apply(this, a); } });
    } else if (d.get) {
      const orig = d.get;
      Object.defineProperty(proto, key, { ...d, get: function () { note(bucket, label); return orig.call(this); } });
    }
  };
  for (const k of ['toDataURL', 'toBlob', 'getImageData'])
    wrap(k === 'getImageData' ? CanvasRenderingContext2D.prototype : HTMLCanvasElement.prototype, k, 'fp', 'canvas.' + k);
  for (const C of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
    wrap(C && C.prototype, 'readPixels', 'fp', 'webgl.readPixels');
    if (C) {
      const orig = C.prototype.getParameter;
      C.prototype.getParameter = function (p) {
        if (p === 0x9245 || p === 0x9246) note('fp', 'webgl.getParameter(UNMASKED_' + (p === 0x9245 ? 'VENDOR' : 'RENDERER') + ')');
        return orig.call(this, p);
      };
    }
  }
  for (const n of ['AudioContext', 'OfflineAudioContext', 'webkitAudioContext']) {
    const O = window[n];
    if (!O) continue;
    window[n] = new Proxy(O, { construct(t, a, nt) { note('fp', 'new ' + n); return Reflect.construct(t, a, nt); } });
  }
  for (const k of ['plugins', 'mimeTypes', 'deviceMemory', 'hardwareConcurrency', 'languages', 'userAgentData'])
    wrap(Navigator.prototype, k, 'fp', 'navigator.' + k);
  wrap(Navigator.prototype, 'getBattery', 'fp', 'navigator.getBattery');
  wrap(Navigator.prototype, 'getGamepads', 'fp', 'navigator.getGamepads');
  wrap(Screen.prototype, 'colorDepth', 'fp', 'screen.colorDepth');

  const hook = (obj, key, label) => {
    if (!obj || typeof obj[key] !== 'function') return;
    const orig = obj[key];
    obj[key] = function (...a) { note('api', label); return orig.apply(this, a); };
  };
  hook(navigator.serviceWorker, 'register', 'serviceWorker.register');
  hook(navigator.clipboard, 'readText', 'clipboard.readText');
  hook(navigator.clipboard, 'read', 'clipboard.read');
  hook(navigator.geolocation, 'getCurrentPosition', 'geolocation.getCurrentPosition');
  hook(navigator.geolocation, 'watchPosition', 'geolocation.watchPosition');
  hook(navigator.mediaDevices, 'getUserMedia', 'mediaDevices.getUserMedia');
  hook(navigator.mediaDevices, 'getDisplayMedia', 'mediaDevices.getDisplayMedia');
  hook(navigator.mediaDevices, 'enumerateDevices', 'mediaDevices.enumerateDevices');
  hook(navigator, 'sendBeacon', 'navigator.sendBeacon');
  hook(window, 'open', 'window.open');
  hook(window, 'fetch', 'fetch');
  if (window.Notification) hook(Notification, 'requestPermission', 'Notification.requestPermission');
  for (const n of ['WebSocket', 'EventSource', 'Worker', 'SharedWorker', 'XMLHttpRequest', 'RTCPeerConnection', 'WebAssembly']) {
    const O = window[n];
    if (!O) continue;
    if (n === 'WebAssembly') { hook(O, 'instantiate', 'WebAssembly.instantiate'); hook(O, 'compile', 'WebAssembly.compile'); continue; }
    window[n] = new Proxy(O, { construct(t, a, nt) { note('api', 'new ' + n); return Reflect.construct(t, a, nt); } });
  }
  document.addEventListener('securitypolicyviolation', (e) => {
    (window.__scan.csp = window.__scan.csp || []).push(`${e.violatedDirective} blocked ${e.blockedURI || 'inline'} ${e.sourceFile || ''}:${e.lineNumber || ''}`);
  });
})();
"""


def interact(page: Page, path: str) -> str:
    """Use the page's main control once; return what was done (or why it could not be)."""
    try:
        return use_control(page, path)
    except PlaywrightError as err:
        return f"control not usable: {str(err).splitlines()[0]}"


def use_control(page: Page, path: str) -> str:
    def first(selector: str) -> Any:
        loc = page.locator(selector)
        return loc.first if loc.count() else None

    if path == "/":
        canvas = first(".hero canvas")
        if canvas:
            canvas.focus()
            page.keyboard.press("ArrowRight")
            box = canvas.bounding_box()
            if box:
                page.mouse.click(
                    box["x"] + box["width"] * 0.6, box["y"] + box["height"] * 0.4
                )
            return "lattice: arrow key and click on the canvas"
    if path.startswith("/") and path != "/":
        copy = first("button[data-copy], .prose .code .copy")
        if copy:
            copy.click()
            return "copy button"
        link = first("main a[href]")
        if link:
            link.hover()
            return "hover first link"
    link = first("main a[href]")
    if link:
        link.hover()
        return "hover first link"
    return "none found"


def new_context(browser: Any, viewport: tuple[int, int], csp: bool) -> BrowserContext:
    ctx = browser.new_context(
        viewport={"width": viewport[0], "height": viewport[1]}, accept_downloads=True
    )
    ctx.add_init_script(INIT_SCRIPT)
    if csp:

        def add_csp(route: Route) -> None:
            resp = route.fetch()
            headers = dict(resp.headers)
            if "text/html" in headers.get("content-type", ""):
                headers["content-security-policy"] = CSP
            route.fulfill(response=resp, headers=headers)

        ctx.route("**/*", add_csp)
    return ctx


def run_page(
    browser: Any, base: str, path: str, vp_name: str, csp: bool
) -> dict[str, Any]:
    origin = urlparse(base).netloc
    ctx = new_context(browser, VIEWPORTS[vp_name], csp)
    page = ctx.new_page()
    page.set_default_timeout(4000)
    result: dict[str, Any] = {"page": path, "viewport": vp_name, "csp_mode": csp}
    requests: list[str] = []
    console: list[str] = []
    downloads: list[str] = []
    popups: list[str] = []
    ws: list[str] = []
    page.on("request", lambda r: requests.append(r.url))
    page.on(
        "console",
        lambda m: (
            console.append(f"{m.type}: {m.text}")
            if m.type in ("error", "warning")
            else None
        ),
    )
    page.on("pageerror", lambda e: console.append(f"pageerror: {e}"))
    page.on("download", lambda d: downloads.append(d.suggested_filename))
    page.on("websocket", lambda w: ws.append(w.url))
    ctx.on("page", lambda p: popups.append(p.url))
    page.on("dialog", lambda d: (console.append(f"dialog: {d.message}"), d.dismiss()))
    page.goto(base + path, wait_until="networkidle")
    cdp = ctx.new_cdp_session(page)
    cdp.send("Performance.enable")

    def metric(name: str) -> float:
        return next(
            m["value"]
            for m in cdp.send("Performance.getMetrics")["metrics"]
            if m["name"] == name
        )

    if not csp:
        t0, w0 = metric("TaskDuration"), metric("Timestamp")
        page.wait_for_timeout(IDLE_SECONDS * 1000)
        t1, w1 = metric("TaskDuration"), metric("Timestamp")
        result["cpu_idle_share"] = round((t1 - t0) / (w1 - w0), 4)
        result["workers"] = [w.url for w in page.workers]
    result["interaction"] = interact(page, path)
    page.wait_for_timeout(1500)
    scan = page.evaluate("() => window.__scan")
    result["fingerprint_calls"] = scan["fp"]
    result["api_calls"] = scan["api"]
    result["csp_violations"] = scan.get("csp", [])
    result["third_party_requests"] = sorted(
        {
            u
            for u in requests
            if urlparse(u).netloc != origin and not u.startswith(("data:", "blob:"))
        }
    )
    result["all_requests"] = len(requests)
    result["frames"] = [f.url for f in page.frames[1:]]
    result["iframes_in_dom"] = page.locator("iframe").count()
    result["console"] = console
    result["downloads"] = downloads
    result["popups"] = popups
    result["websockets"] = ws
    result["service_workers"] = len(ctx.service_workers)
    ctx.close()
    return result


def summarize(results: list[dict[str, Any]]) -> str:
    lines: list[str] = []
    for r in results:
        tag = f"{r['page']} [{r['viewport']}{', CSP' if r['csp_mode'] else ''}]"
        lines.append(tag)
        lines.append(
            f"  interaction: {r['interaction']}; requests: {r['all_requests']}"
        )
        if r["third_party_requests"]:
            lines.append(f"  THIRD-PARTY: {r['third_party_requests']}")
        if "cpu_idle_share" in r:
            flag = "  FLAG >20%" if r["cpu_idle_share"] > CPU_FLAG else ""
            lines.append(
                f"  cpu idle {IDLE_SECONDS}s: {r['cpu_idle_share'] * 100:.1f}% workers={len(r['workers'])}{flag}"
            )
        for key in ("fingerprint_calls", "api_calls"):
            counts: dict[str, int] = {}
            for c in r[key]:
                k = f"{c['name']} <- {c['from']}"
                counts[k] = counts.get(k, 0) + 1
            for k, n in counts.items():
                lines.append(f"  {key}: {k} x{n}")
        for key in (
            "csp_violations",
            "console",
            "downloads",
            "popups",
            "websockets",
            "frames",
        ):
            for item in r[key]:
                lines.append(f"  {key}: {item}")
        if r["service_workers"]:
            lines.append(f"  service workers: {r['service_workers']}")
    return "\n".join(lines) + "\n"


def main() -> int:
    base, out = sys.argv[1].rstrip("/"), sys.argv[2]
    results: list[dict[str, Any]] = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for csp in (False, True):
            for path in PAGES:
                for vp in VIEWPORTS:
                    print(f"runtime {'csp' if csp else 'base'} {vp} {path}", flush=True)
                    results.append(run_page(browser, base, path, vp, csp))
        browser.close()
    with open(f"{out}/runtime.json", "w") as f:
        json.dump(results, f, indent=1)
    text = summarize(results)
    with open(f"{out}/runtime.txt", "w") as f:
        f.write(text)
    print(text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
