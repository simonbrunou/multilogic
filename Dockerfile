# syntax=docker/dockerfile:1

# ---- build stage: install deps, pre-generate the puzzle bundle, build the static SPA ----
FROM oven/bun:1 AS builder
WORKDIR /app

# Install dependencies first for better layer caching.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Build the app. `pregen` writes static/puzzles.bundle.json (the worker fallback bundle),
# which `build` then copies into build/. Output is a static SPA in build/.
COPY . .
RUN bun run pregen && bun run build

# ---- runtime stage: serve the static output ----
FROM oven/bun:1-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Only the built site + the tiny static server are needed at runtime.
COPY --from=builder /app/build ./build
COPY --from=builder /app/serve.js ./serve.js

EXPOSE 3000
CMD ["bun", "serve.js"]
