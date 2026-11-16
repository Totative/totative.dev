FROM oven/bun:1.4.4@sha256:1d22548f177f4ff38e0c15baa3c2c46c6c2060ba2d1bc573bb4720b407548f1d AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY astro.config.ts tsconfig.json ./
COPY public ./public
COPY src ./src
RUN bun run build

FROM caddy:2.11.9@sha256:f971688b2aaf1a26d256de552f17fb13f64fc5ed2dee4cf40c7f9d70cea0e12d
RUN addgroup -S -g 1000 caddy && adduser -S -H -u 1000 -G caddy caddy
COPY --from=build --chown=caddy:caddy /app/dist /usr/share/caddy
COPY --chown=caddy:caddy Caddyfile /etc/caddy/Caddyfile
USER caddy
EXPOSE 8080
