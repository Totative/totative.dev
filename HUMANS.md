# HUMANS

Install, run, and verify totative.dev locally. File layout and invariants live in [AGENTS.md](AGENTS.md).

## Quick start

```sh
bun install
bun run dev
```

Open the URL the Astro dev server prints (default `http://localhost:4321`).

## Install

Requires [Bun](https://bun.sh). Clone the repo, then:

```sh
bun install
```

## Usage

| Command             | What it does                                                                                  |
| ------------------- | --------------------------------------------------------------------------------------------- |
| `bun run dev`       | Astro dev server                                                                              |
| `bun run build`     | Static build into `dist/`                                                                     |
| `bun run preview`   | Serve `dist/` locally                                                                         |
| `bun run lint`      | Biome check with warnings as errors                                                           |
| `bun run typecheck` | `astro sync` and `tsc -b --noEmit` (project TypeScript 7)                                     |
| `bun run test`      | `bun test`                                                                                    |
| `bun run check`     | `astro-check` via bunx TypeScript 6 (`@astrojs/check`); the project itself is on TypeScript 7 |
| `bun run scan`      | Runtime CSP check against `http://127.0.0.1:4321` (preview or container must already be up)   |

## Container

```sh
docker build -t totative-dev .
docker run -p 8080:8080 totative-dev
```

Caddy serves `dist/` on `:8080` with the production headers. `www.totative.dev`, `totative.ca`, and `www.totative.ca` 301 to `https://totative.dev{uri}`.

## Deploy

DigitalOcean App Platform builds `main` from [`.do/app.yaml`](.do/app.yaml): the Dockerfile, region `tor1`, one `apps-s-1vcpu-0.5gb` instance, `totative.dev` as the primary domain.

## Verify

```sh
bun run check
bun run build
bun run preview
bun run scan
```

`scan` needs `preview` (or the production container) already listening on `http://127.0.0.1:4321`. Mapped container port 8080 is a different origin; point `scripts/scan_runtime.py` at that URL if you are scanning the container.

## Uninstall

Delete the clone. `rm -rf node_modules` removes installed packages.
