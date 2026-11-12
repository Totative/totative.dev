FROM oven/bun:1.4.4@sha256:1d22548f177f4ff38e0c15baa3c2c46c6c2060ba2d1bc573bb4720b407548f1d AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY astro.config.ts tsconfig.json ./
COPY public ./public
COPY src ./src
RUN bun run build

FROM caddy:2.11.9@sha256:e40b94d0a43b5ff69cb20568d73f10c70703df7b0ffc2298eb3d723cdc9d0bd1
RUN addgroup -S -g 1000 caddy && adduser -S -H -u 1000 -G caddy caddy
COPY --from=build --chown=caddy:caddy /app/dist /usr/share/caddy
COPY --chown=caddy:caddy Caddyfile /etc/caddy/Caddyfile
USER caddy
EXPOSE 8080
