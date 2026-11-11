import re


def copied(page, button):
    """Copying is asynchronous, so give the button a moment to say it worked."""
    button.click()
    try:
        page.wait_for_function("(el) => el.textContent.trim() === 'Copied'", arg=button.element_handle(), timeout=2000)
    except Exception:
        return False
    return True


def said(page, name):
    return (page.locator(f'[data-say="{name}"]').text_content() or "").strip()


def home(page, viewport, shot):
    problems = []
    canvas = page.locator(".hero canvas")
    if page.locator(".hero").get_attribute("data-lattice") != "on":
        return ["the lattice did not start"]
    box = canvas.bounding_box()

    share = said(page, "share")
    if not re.fullmatch(r"0\.\d{3}", share) or not 0.55 < float(share) < 0.67:
        problems.append(f"the share of dots in sight reads {share!r}, expected about 0.608")
    painted = page.evaluate(
        "() => { const c = document.querySelector('.hero canvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;"
        " let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n }"
    )
    if painted < 500:
        problems.append(f"the canvas has only {painted} painted pixels")

    # Arrow keys move the viewpoint one unit.
    canvas.focus()
    before = said(page, "view")
    page.keyboard.press("ArrowRight")
    page.keyboard.press("ArrowUp")
    after = said(page, "view")
    if after == before:
        problems.append(f"arrow keys did not move the viewpoint from {before}")
    canvas.blur()

    # So does the pointer, and on a phone a tap.
    x, y = box["x"] + box["width"] * 0.6, box["y"] + box["height"] * (0.3 if viewport == "desktop" else 0.62)
    if viewport == "desktop":
        page.mouse.move(x, y)
        shot("moved")
    else:
        page.mouse.click(x, y)
    if said(page, "view") == after:
        problems.append("the pointer did not move the viewpoint")

    install = page.locator(".tools .cmd button").first
    install.scroll_into_view_if_needed()
    if not copied(page, install):
        problems.append("the install command's copy button did not confirm")
    check = page.locator("#check-h ~ div .cmd button")
    if not copied(page, check):
        problems.append("the release check's copy button did not confirm")
    page.evaluate("scrollTo(0, 0)")
    return problems


def writeup(page, viewport, shot):
    problems = []
    if page.locator(".code button.copy").count() != page.locator(".prose pre").count():
        problems.append("not every code block got a copy button")
    if page.locator(".prose h2 a.anchor").count() != page.locator(".prose h2").count():
        problems.append("not every section heading got an anchor")
    copy = page.locator(".code button.copy").first
    copy.scroll_into_view_if_needed()
    if not copied(page, copy):
        problems.append("the code block copy button did not confirm")

    page.locator("#checking-one").evaluate("(el) => scrollTo(0, el.getBoundingClientRect().top + scrollY - 20)")
    page.wait_for_timeout(250)
    current = page.locator(".contents a[aria-current]")
    if current.count() != 1 or "Checking one" not in (current.text_content() or ""):
        problems.append("the contents do not mark 'Checking one' while it is being read")
    read = float(page.locator(".progress").get_attribute("data-read") or 0)
    if not 0.05 < read < 0.95:
        problems.append(f"the progress line reads {read} part way through the page")
    if viewport == "desktop":
        shot("reading")
    page.evaluate("scrollTo(0, document.documentElement.scrollHeight)")
    page.wait_for_timeout(250)
    end = float(page.locator(".progress").get_attribute("data-read") or 0)
    if end < 0.99:
        problems.append(f"the progress line is not full at the end of the page ({end})")
    page.evaluate("scrollTo(0, 0)")
    return problems


def interact(page, page_name, viewport, shot):
    if page_name == "home":
        return home(page, viewport, shot)
    if page_name == "writeup":
        return writeup(page, viewport, shot)
    if page.locator(".posts a").count() == 0:
        return ["the index lists no write-up"]
    return []
