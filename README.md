# totative.dev

The public site for [Totative](https://github.com/Totative): software security research, and the tools we build for it.

## Local

```sh
bun install
bun run dev
```

Production build:

```sh
bun run build
bun run preview
```

`bun run check` type-checks the Astro project. `bun run scan` runs the strict-CSP runtime check against a preview already listening on <http://127.0.0.1:4321>.

## Container

```sh
docker build -t totative-dev .
docker run -p 8080:8080 totative-dev
```

Caddy serves `dist/` on `:8080` with the production headers. Unknown paths return the 404 page with status 404. `www.totative.dev`, `totative.ca`, and `www.totative.ca` 301 to `https://totative.dev{uri}`.

## Deploy

DigitalOcean App Platform builds `main` from [`.do/app.yaml`](.do/app.yaml): the Dockerfile, region `tor1`, one smallest instance, `totative.dev` as the primary domain.
