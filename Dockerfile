FROM oven/bun:1@sha256:1d22548f177f4ff38e0c15baa3c2c46c6c2060ba2d1bc573bb4720b407548f1d AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY astro.config.ts tsconfig.json ./
COPY public ./public
COPY src ./src
RUN bun run build

FROM caddy:2@sha256:ce773ec7a742ce15ee6bf2bb5f65882b9e2a4487b10733e6f1484f86e6b5d8bc
RUN addgroup -S -g 1000 caddy && adduser -S -H -u 1000 -G caddy caddy
COPY --from=build --chown=caddy:caddy /app/dist /usr/share/caddy
COPY --chown=caddy:caddy Caddyfile /etc/caddy/Caddyfile
USER caddy
EXPOSE 8080
