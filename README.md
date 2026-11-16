<h1 align="center">totative.dev</h1>

<div align="center">

[![CI](https://img.shields.io/github/actions/workflow/status/Totative/totative.dev/ci.yml?label=CI)](https://github.com/Totative/totative.dev/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/Totative/totative.dev)](LICENSE)

</div>

---

Static Astro 7 site for [Totative](https://github.com/Totative), served at <https://totative.dev>. Lattice is the layout: home, write-ups under `/writeups/`, and brand files under `/brand/`. Production Caddy serves `dist/` with a strict CSP (no inline script or style).

Local work uses Bun. The runbook, container, and DigitalOcean deploy notes are in [HUMANS.md](HUMANS.md). File layout and CSP rules are in [AGENTS.md](AGENTS.md).

## Quick start

```sh
bun install
bun run dev
```

Install, verify, container, and deploy: [HUMANS.md](HUMANS.md).

## Highlights

- Astro 7 static build, Bun for install and scripts
- Write-ups at `/writeups/` and `/writeups/<slug>/`
- Brand page at `/brand/` (`public/brand/` copies of the org profile assets)
- Caddy serves `dist/` in production (Docker `EXPOSE 8080`)
- `bun run scan` checks the strict CSP against a running preview
- DigitalOcean App Platform deploys `main` from [`.do/app.yaml`](.do/app.yaml)

## Documentation

| Doc                    | What                                    |
| ---------------------- | --------------------------------------- |
| [HUMANS.md](HUMANS.md) | Install, run, verify, container, deploy |
| [AGENTS.md](AGENTS.md) | Commands, CSP, file layout              |
| [LICENSE](LICENSE)     | Apache License 2.0                      |

## License

Licensed under the Apache License 2.0. See [LICENSE](LICENSE).
