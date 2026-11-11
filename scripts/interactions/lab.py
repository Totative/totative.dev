def interact(page, page_name, viewport, shot):
    problems = []
    dial = page.locator(".demo[data-mod-dial]")
    status = dial.locator("[data-dial-status]")

    def expect(label, got, want):
        if want not in str(got):
            problems.append(f"{label}: got {got!r}, expected it to contain {want!r}")

    if dial.get_attribute("data-live") is None:
        return ["the dial's script did not start"]

    # A preset button moves the dial to that pair and shows its note.
    dial.locator('[data-dial-preset="1"]').click()
    expect("preset button", status.text_content(), "6 shares the factor 6 with 120")
    expect("preset note", dial.locator("[data-dial-note]").text_content(), "five residues in six")
    expect("reached count for a collision", dial.locator("[data-dial-reached]").text_content(), "20")

    # Sliders and steppers.
    dial.locator('[data-dial-input="n"]').fill("36")
    dial.locator('[data-dial-input="m"]').fill("7")
    expect("slider to a totative", status.text_content(), "7 is a totative of 36")
    dial.locator('[data-dial-step="m:1"]').click()
    expect("stepper to a shared factor", status.text_content(), "8 shares the factor 4 with 36")
    if status.get_attribute("aria-live") != "polite":
        problems.append("status is not announced after the visitor changed the dial")

    # Dragging on the face sets m to the residue under the pointer: the rightmost point of a dial of 36 is 9.
    canvas = dial.locator("[data-dial-canvas]")
    canvas.evaluate("el => el.scrollIntoView({ block: 'center', behavior: 'instant' })")
    box = canvas.bounding_box()
    page.mouse.move(box["x"] + box["width"] * 0.5, box["y"] + box["height"] * 0.1)
    page.mouse.down()
    page.mouse.move(box["x"] + box["width"] * 0.9, box["y"] + box["height"] * 0.5, steps=6)
    page.mouse.up()
    expect("drag on the dial", dial.get_attribute("data-m"), "9")
    if viewport == "desktop":
        page.mouse.move(box["x"] + box["width"] * 0.5, box["y"] + box["height"] * 0.9)
        expect("pointing at a residue", dial.get_attribute("data-probe"), "18:18")

    play = dial.locator("[data-dial-play]")
    play.click()
    page.wait_for_timeout(2000)
    if play.get_attribute("aria-pressed") != "true" or dial.get_attribute("data-m") in ("9", None):
        problems.append(f"play did not step m (m = {dial.get_attribute('data-m')})")
    play.click()
    if play.get_attribute("aria-pressed") != "false":
        problems.append("play did not pause")

    # A host page drives the dial with an event, and the picture-only dials cycle on their own.
    dial.evaluate("el => el.dispatchEvent(new CustomEvent('moddial:show', { detail: { n: 61, m: 2, note: 'from the host' } }))")
    expect("moddial:show", status.text_content(), "2 is a totative of 61")
    expect("moddial:show note", dial.locator("[data-dial-note]").text_content(), "from the host")
    picture = page.locator(".as-e[data-mod-dial]")
    picture.evaluate("el => el.scrollIntoView({ block: 'center', behavior: 'instant' })")
    before = picture.get_attribute("data-m")
    page.wait_for_timeout(4600)
    if picture.get_attribute("data-m") == before and picture.get_attribute("data-n") == "120":
        problems.append("the picture-only dial did not move to its next pair")
    page.wait_for_timeout(1200)
    shot("palettes")
    return problems
