FROM oven/bun:1.4.5@sha256:3aa040e5445efa09d75bb428a64ba50db13e2b3ac9b6b0c7f145615f62b2ee18 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY astro.config.ts tsconfig.json ./
COPY public ./public
COPY src ./src
RUN bun run build

FROM caddy:2.11.9@sha256:4851e54a46b206517c574821bb5cc67f170d2156041e9fbc4c9193b45e84a75b
RUN addgroup -S -g 1000 caddy && adduser -S -H -u 1000 -G caddy caddy
COPY --from=build --chown=caddy:caddy /app/dist /usr/share/caddy
COPY --chown=caddy:caddy Caddyfile /etc/caddy/Caddyfile
USER caddy
EXPOSE 8080
