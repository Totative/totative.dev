# Totative site mocks

The Lattice design for the future totative.dev site, built in Astro, plus one animation component (the multiplication dial) kept for reuse.

The copy comes from the current site, the organisation profile, the security policy and the three library READMEs. The write-up is the existing post, byte for byte, under its Jekyll file name. Tool versions and release file names were read from the live releases.

## Run

```sh
bun install
bun run dev        # http://<this machine>:4321/, bound to 0.0.0.0
```

Stop it with Ctrl-C. If it was started without a terminal it runs in the background; stop that with `bunx astro dev stop`.

| Page | Home | Write-up |
| --- | --- | --- |
| E Lattice | `/e/` | `/e/writeups/checking-a-totative-release/` |
| Lab: multiplication dial | `/lab/f-animation/` | |

`/` is the chooser. Each design also has a write-ups index at `/<id>/writeups/`. The black strip at the top of every page is mock chrome for opening the same page in the other design; it is not part of either.

Other commands:

```sh
bun run build      # static site into dist/
bun run check      # astro check (types in .astro and .ts files)
bun run shots      # screenshots, contact sheets and browser checks, from dist/
```

`bun run shots` serves `dist/`, loads each design's home page, write-ups index and write-up, and the lab page, at 1440px and 390px, and fails on:

- a console error or warning, a page error or a failed request;
- anything wider than the viewport outside a scrolling code block;
- a page without exactly one `h1`, a `main#main` or a skip link to it;
- a home page whose first screen lacks the tagline, "Work with us" or "Report a vulnerability";
- an interaction that did nothing. Each page's are exercised by `scripts/interactions/<id>.py`, which asserts on what changed and saves a few extra shots of those states.

It writes `screenshots/<id>-<page>-<viewport>.png` and one contact sheet per page type (`contact-home.png`, `contact-index.png`, `contact-writeup.png`), with a desktop row and a phone row. To look at one design while working on it: `bun run shots --base http://127.0.0.1:4321 --out /tmp/shots-e e`.

`screenshots/benchmark/` holds captures of netphantomsecurity.com, the site these designs are measured against.

## What both designs have

- The tagline as text with both routes (work with us, report a vulnerability) in the first screen at 1440x900 and 390x844, "Work with us" in the header on every page, and both routes again before the footer.
- All six services, the three tools with version (linked to its release) and install command, the commands that download and verify a release with copy buttons, the three files each release publishes, "What you can check", and the latest write-up.
- On the write-up: a contents list that marks the section being read, a reading-progress line, heading anchors, and copy buttons on code blocks.
- A skip link, landmarks, visible focus, keyboard access to every control, and `prefers-reduced-motion` honoured. All content is in the HTML before any script runs.
- No raster images. Fonts are self-hosted. One section spacing and one heading style per design; the monospace face is used for commands and code only.

## The designs

### E Lattice (`/e/`)

The integer lattice seen from a point you move. A lattice point is in line of sight exactly when its two offsets from the viewpoint share no factor but 1, so the lit dots are the coprime pairs, and their share tends to 6/π². Ice cyan on blue-black, light display type in Atkinson Hyperlegible Next, open sections with the heading on the left and the content on the right.

- Interactions: the pointer moves the viewpoint (tap or drag on touch, arrow keys when the canvas has focus), and left alone it drifts slowly. One sentence under the hero says, in words, how many dots are in sight from where you are and how close that share is to the limit. Copy buttons on commands. On the write-up: contents marking the current section, a progress line, heading anchors. Pages cross-fade.
- Dependencies: none of its own. The canvas is first-party (`src/lib/e-lattice.ts`, `src/scripts/e/lattice.ts`).

## Lab: the multiplication dial (`/lab/f-animation/`)

The animation from the dropped design F, kept as a component so another design can use it. The residues 0 to n − 1 sit on a circle and a chord joins each k to m·k mod n. When m is a totative of n no two chords end on the same residue; when it shares a factor with n they collide.

- Everything is in `src/components/mod-dial/`: `ModDial.astro` (markup, styles, script), `maths.ts`, `draw.ts`, `mount.ts`. It needs `gcd` and `inverse` from `src/lib/totient.ts` and `reducedMotion` from `src/lib/enhance.ts`, and nothing from npm (the tween that design F did with GSAP is a few lines here).
- Props: `presets` (pairs of n and m, each with an optional label and note), `cycle` (seconds between presets while the dial is on screen and untouched), `controls` (preset buttons, sliders, steppers, play), `class`.
- Colours and faces come from `--dial-from`, `--dial-to`, `--dial-ink`, `--dial-muted`, `--dial-line`, `--dial-ground`, `--dial-sans`, `--dial-mono` and `--dial-size`, so a host sets them from its own palette. The lab page shows it in F's pink and orange and in E's colours.
- A host page moves the dial by dispatching `moddial:show` on the component with `{ n, m, label, note }` (for example as sections scroll past, which is what F did), and hears each change as `moddial:change`.
- Without script the first pair is drawn as a still SVG. Under reduced motion the dial changes in steps and does not cycle.

## Dependencies

| Package | Used by | For |
| --- | --- | --- |
| `astro`, `@astrojs/check`, `typescript` | all | the build and the type check |
| `shiki` | all | the type of the highlighting transformer (Astro bundles the highlighter) |
| `@fontsource-variable/atkinson-hyperlegible-next`, `-mono` | all | default faces |

Nothing else ships to the browser.

## Security scan

```sh
bun run scan       # builds, serves dist/ on 127.0.0.1:4322, runs everything, stops the server
```

Raw outputs go to `scan-out/` (overwritten each run). Everything is local; nothing is sent to an outside scanning service. It runs:

- dependencies and secrets: `osv-scanner`, `grype`, `retire`, `trivy fs` (vuln, secret, misconfig) and `gitleaks dir`;
- code: `semgrep` (JavaScript and TypeScript rules) over `src/` and `scripts/`, and `scripts/scan_dist.py`, a grep of `dist/` for `eval`, `new Function`, `document.write`, `innerHTML`, inline handlers, `javascript:` URLs, WebAssembly and packed-looking blobs;
- antivirus: `clamscan` with the database in `/var/tmp/clamav-db`, and YARA-X with the Neo23x0 signature-base rules cloned into `/var/tmp/yara-rules` (`git clone --depth 1 https://github.com/Neo23x0/signature-base` there once);
- runtime (`scripts/scan_runtime.py`, Playwright, 1440 and 390 wide): requests to other origins, service workers, sockets, popups, downloads, clipboard reads, permission APIs, fingerprinting calls with their calling script, idle CPU share over 15 s, and violations of a strict Content-Security-Policy added to each page;
- `lighthouse` (best practices, accessibility, performance) on both home pages and both write-ups, and `nuclei` against the preview server.

## Host

Neither design needs server rendering or an edge function: the build is static files. The mocks send no security headers and were not built to fit a Content-Security-Policy; whether the real site sends one, and what the chosen design needs changed to fit it, is a decision for then.

Files under `/_astro/` have hashed names, so the host can serve them with `Cache-Control: public, max-age=31536000, immutable`.

## Why Astro

- The site is pages of text. Astro renders them to HTML at build time, so every page reads without script, and each design adds only the script its own interactions need.
- Write-ups are a content collection: Markdown files with a checked frontmatter schema. The existing `_posts/` folder moves over unchanged (`src/lib/writeups.ts` reads the date and slug from the Jekyll file name).
- Syntax highlighting happens at build time with Shiki. A transformer (`src/lib/token-classes.ts`) turns its inline colours into classes so each design colours the same markup from its own stylesheet.

## Layout of the project

```text
src/data/site.ts              shared copy, links and the tool list
src/content/writeups/         the posts
src/lib/                      shared: writeups.ts, totient.ts, enhance.ts (copy, anchors,
                              scroll spy, reading progress), token-classes.ts
src/lib/e-lattice.ts          the lattice maths
src/layouts/E.astro           the page frame
src/styles/e.css              the design's styles; base.css is shared
src/pages/<id>/               home, write-ups index and write-up page per design
src/scripts/<id>/             one design's browser code
src/components/mod-dial/      the multiplication dial
src/pages/lab/                its demo page
src/pages/index.astro         the chooser
scripts/shots.py              screenshots, contact sheets and browser checks
scripts/interactions/<id>.py  what shots.py does to each page
screenshots/                  output of `bun run shots`, plus benchmark/
archive/                      the six dropped designs as one tarball, kept so the removal can be undone
```

## Notes

- `archive/killed-designs-a-b-c-d-f-g.tar.gz` holds the source of the six dropped designs as they were when they were removed (the project is not under version control, so nothing else would bring them back). Nothing reads it; delete it once it is not wanted.
- TypeScript is held at 6 here because `astro check` does not run on TypeScript 7 yet.
- Astro caches rendered Markdown. After changing the Markdown or Shiki settings, delete `.astro/` and `node_modules/.astro/` before building, or the old HTML is reused.
- After adding a package, restart the dev server: it does not always reload its config on its own.
- `src/lib/enhance.ts` copies through the Clipboard API where it exists and through a selection copy elsewhere, because the mocks are opened over plain HTTP on the LAN where the Clipboard API is absent.
- The current site's `.well-known/security.txt` is not copied: its `Canonical` line names totative.github.io and has to be rewritten for the new domain when the site moves.
