# The production image once Coolify's build pack is `dockerfile` (README.md, "Deploy"). The two
# oven/bun tags name the Bun in package.json's packageManager, and the node tag names the major
# in .nvmrc. tests/scripts/docker-pins.test.ts and tests/node-pins.test.ts fail CI when they
# differ, and read only the forms this file uses today.
FROM oven/bun:1.4.4 AS bun

# Vite needs a real Node: under the oven/bun image's node symlink it emits a different chunk.
FROM node:26-slim AS build
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app
COPY package.json bun.lock .npmrc ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run pregen && bun run build

FROM oven/bun:1.4.4-slim
WORKDIR /app
ENV NODE_ENV=production
# This upgrade applies Debian fixes newer than the base image. BuildKit reuses a cached layer,
# so a fix published after the layer was built lands only when the layer rebuilds. The RUN
# echoes APT_REFRESH: set it to today's date to rebuild the layer when a scan flags an OS
# package that a fresh upgrade fixes.
ARG APT_REFRESH=2026-11-23
RUN echo Debian packages refreshed ${APT_REFRESH} && apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/build ./build
COPY --from=build /app/serve.js ./
EXPOSE 3000
CMD ["bun", "serve.js"]
