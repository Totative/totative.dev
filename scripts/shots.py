"""Screenshot every design from the built site and report what a browser complains about.

Run `bun run build` first, then `bun run shots`. To look at one design while
working on it, point the script at the dev server and at a scratch folder:

    bun run shots --base http://127.0.0.1:4321 --out /tmp/shots-e e

Each design's interactions are
exercised by `scripts/interactions/<id>.py`, which exposes

    interact(page, page_name, viewport, shot) -> list[str]

and returns one line per thing that did not do what it should. `page_name` is
"home", "index" or "writeup", `viewport` is "desktop" or "phone", and
`shot(name)` saves an extra screenshot of the current state.
"""

import argparse
import functools
import http.server
import importlib.util
import subprocess
import sys
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

# The interaction modules are loaded by path; their bytecode would only litter scripts/.
sys.dont_write_bytecode = True

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
OUT = ROOT / "screenshots"
FONT = ROOT / "node_modules/@fontsource-variable/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-wght-normal.woff2"

DESIGNS = {"e": "Lattice", "lab": "Dial"}
PAGES = {"home": "", "index": "writeups/", "writeup": "writeups/checking-a-totative-release/"}
# The lab holds one page, the dial kept from an earlier design; it is not a site and has no sheet.
LAB_PAGES = {"f-animation": "f-animation/"}
VIEWPORTS = {"desktop": (1440, 900), "phone": (390, 844)}
SHEET_IDS = ("e",)

# Anything wider than the viewport that is not inside a scrolling code block.
OVERFLOW = """() => {
  const width = document.documentElement.clientWidth
  const wide = [...document.querySelectorAll('body *')].filter((el) => {
    const box = el.getBoundingClientRect()
    if (box.width === 0 || box.height === 0) return false
    return (box.right > width + 1 || box.left < -1) && !el.closest('pre, .scroll-x, [data-clip]')
  })
  return {
    page: document.documentElement.scrollWidth - width,
    elements: wide.slice(0, 5).map((el) => el.tagName.toLowerCase() + '.' + String(el.className.baseVal ?? el.className)),
  }
}"""

# What every page owes a visitor before any design question: one h1, a skip link to
# the main landmark, and on the home page the tagline and both routes in the first screen.
BASICS = """(home) => {
  const found = []
  const h1 = document.querySelectorAll('h1')
  if (h1.length !== 1) found.push(`${h1.length} h1 elements`)
  if (!document.querySelector('main#main')) found.push('no <main id="main">')
  if (!document.querySelector('a[href="#main"]')) found.push('no skip link to #main')
  if (!home) return found
  const inFirstScreen = (el) => {
    // A range measures the content, so an element with `display: contents` still has a box.
    const range = document.createRange()
    range.selectNodeContents(el)
    const box = range.getBoundingClientRect()
    const style = getComputedStyle(el)
    return box.width > 0 && box.height > 0 && box.bottom <= innerHeight && box.top >= 0 && style.visibility !== 'hidden'
  }
  if (!h1[0] || !/Software security/.test(h1[0].textContent) || !inFirstScreen(h1[0])) found.push('tagline h1 is not in the first screen')
  const routes = { 'Work with us': 'issues/new?template=engagement.yml', 'Report a vulnerability': 'SECURITY.md' }
  for (const [name, href] of Object.entries(routes)) {
    const links = [...document.querySelectorAll(`main a[href*="${href}"]`)]
    if (!links.some(inFirstScreen)) found.push(`"${name}" is not in the first screen of <main>`)
  }
  return found
}"""

# Walks the page top to bottom so anything revealed on scroll is in the full-page shot.
# The jumps are instant so a design with smooth scrolling still reaches the bottom.
SCROLL_THROUGH = """async () => {
  const step = Math.round(innerHeight * 0.6)
  for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
    scrollTo({ top: y, behavior: 'instant' })
    await new Promise((done) => setTimeout(done, 90))
  }
  scrollTo({ top: 0, behavior: 'instant' })
  await new Promise((done) => setTimeout(done, 400))
}"""


class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def load_interactions(design):
    path = ROOT / "scripts" / "interactions" / f"{design}.py"
    if not path.exists():
        return None
    spec = importlib.util.spec_from_file_location(f"interactions_{design}", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.interact


def check_overflow(page, tag, problems, when=""):
    overflow = page.evaluate(OVERFLOW)
    if overflow["page"] > 0 or overflow["elements"]:
        problems.append(f"{tag}: horizontal overflow{when} {overflow}")


def sheet(page_name, ids):
    rows = []
    for viewport, width in (("desktop", 720), ("phone", 390)):
        tiles = []
        for design in ids:
            source = OUT / f"{design}-{page_name}-{viewport}.png"
            tile = OUT / f".tile-{design}-{viewport}.png"
            label = f"{design.upper()}  {DESIGNS[design]}  {viewport}"
            subprocess.run(
                ["magick", str(source), "-resize", f"{width}x", "-background", "#1c1c1c", "-gravity", "north",
                 "-splice", "0x48", "-font", str(FONT), "-pointsize", "22", "-fill", "#ffffff",
                 "-annotate", "+0+10", label, "-bordercolor", "#1c1c1c", "-border", "12x12", str(tile)],
                check=True,
            )
            tiles.append(tile)
        row = OUT / f".row-{viewport}.png"
        subprocess.run(["magick", *map(str, tiles), "-background", "#1c1c1c", "-gravity", "north", "+append", str(row)], check=True)
        for tile in tiles:
            tile.unlink()
        rows.append(row)
    target = OUT / f"contact-{page_name}.png"
    subprocess.run(["magick", *map(str, rows), "-background", "#1c1c1c", "-gravity", "west", "-append", str(target)], check=True)
    for row in rows:
        row.unlink()
    print(f"sheet {target}")


def main():
    global OUT
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("designs", nargs="*", choices=[*DESIGNS, []], help="design ids to cover (default: all)")
    parser.add_argument("--base", help="a running server to load instead of serving dist/")
    parser.add_argument("--out", type=Path, default=OUT, help="where the screenshots go")
    args = parser.parse_args()
    only = set(args.designs) or set(DESIGNS)
    OUT = args.out
    OUT.mkdir(parents=True, exist_ok=True)
    # A full run replaces everything, so a renamed or dropped shot does not linger.
    for old in OUT.glob("*.png"):
        if only == set(DESIGNS) or old.name.split("-")[0] in only:
            old.unlink()
    server = None
    base = args.base
    if base is None:
        if not (DIST / "index.html").exists():
            sys.exit("dist/ is missing: run `bun run build` first")
        server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Handler, directory=str(DIST)))
        threading.Thread(target=server.serve_forever, daemon=True).start()
        base = f"http://127.0.0.1:{server.server_port}"
    base = base.rstrip("/")
    problems = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        for viewport, (width, height) in VIEWPORTS.items():
            context = browser.new_context(viewport={"width": width, "height": height})
            for design in DESIGNS:
                if design not in only:
                    continue
                interact = load_interactions(design)
                if interact is None:
                    problems.append(f"{design}: scripts/interactions/{design}.py is missing")
                for page_name, path in (LAB_PAGES if design == "lab" else PAGES).items():
                    tag = f"{design}-{page_name}-{viewport}"
                    page = context.new_page()
                    page.on("console", lambda msg, tag=tag: msg.type in ("error", "warning") and problems.append(f"{tag}: console {msg.type}: {msg.text}"))
                    page.on("pageerror", lambda err, tag=tag: problems.append(f"{tag}: page error: {err}"))
                    page.on("requestfailed", lambda req, tag=tag: problems.append(f"{tag}: request failed: {req.url}"))
                    response = page.goto(f"{base}/{design}/{path}", wait_until="networkidle")
                    if response is None or response.status != 200:
                        problems.append(f"{tag}: HTTP {response.status if response else 'none'}")
                    page.evaluate("document.fonts.ready")
                    check_overflow(page, tag, problems)
                    for line in page.evaluate(BASICS, page_name == "home"):
                        problems.append(f"{tag}: {line}")
                    page.evaluate(SCROLL_THROUGH)
                    page.screenshot(path=OUT / f"{tag}.png", full_page=True)
                    print(f"shot  {OUT / tag}.png")
                    if interact is not None:
                        def shot(name, tag=tag, page=page):
                            page.screenshot(path=OUT / f"{tag}-{name}.png")
                            print(f"shot  {OUT / tag}-{name}.png")
                        try:
                            for line in interact(page, page_name, viewport, shot) or []:
                                problems.append(f"{tag}: {line}")
                        except Exception as error:  # a broken interaction is a finding, not a crash
                            problems.append(f"{tag}: interaction raised {type(error).__name__}: {str(error).splitlines()[0]}")
                        check_overflow(page, tag, problems, " after interaction")
                    page.close()
            context.close()
        browser.close()
    if server is not None:
        server.shutdown()

    if only == set(DESIGNS):
        for page_name in PAGES:
            sheet(page_name, SHEET_IDS)

    if problems:
        print(f"\n{len(problems)} problem(s):")
        for problem in problems:
            print(f"  {problem}")
        sys.exit(1)
    print("\nno console errors, failed requests or horizontal overflow; every interaction did something")


if __name__ == "__main__":
    main()
