# Demo app (React SPA + Express BFF) — single-container image.
# The BFF serves both /api and the built client (see server/index.ts).
#
# IMPORTANT: this image is built with the REPO ROOT as the build context (set the
# Railway service's Root Directory to the repo root, and dockerfilePath to
# demo/Dockerfile). Root context is required so the demo can copy the repo-root
# lexicons/ at build time — the custom CGS lexicons are NOT duplicated into demo/.
FROM node:22-slim AS builder
WORKDIR /app
# CI=true so pnpm runs non-interactively (e.g. `prune --prod` won't block on a
# TTY confirmation for purging modules).
ENV CI=true
RUN corepack enable

# Install the demo's deps from demo/ as its own pnpm workspace root (demo has its
# own pnpm-workspace.yaml carrying `allowBuilds`, so esbuild/core-js build their
# native pieces without an interactive `pnpm approve-builds`). Paths are relative
# to the repo root (the build context).
COPY demo/package.json demo/pnpm-lock.yaml demo/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# App source + the custom lexicons (single source of truth in repo-root lexicons/,
# copied here at build time — never committed into demo/).
COPY demo/ ./
COPY lexicons/ ./lexicons

# vite build -> dist/ (client), tsc -p tsconfig.server.json -> dist-server/ (BFF)
RUN pnpm build
RUN pnpm prune --prod

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
# Tell the proxy agent exactly where the lexicons are, rather than relying on a
# relative ../../../ walk from the compiled file.
ENV LEXICONS_DIR=/app/lexicons/app/certified
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-server ./dist-server
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/lexicons ./lexicons
# The server listens on PORT (Railway's convention) then BFF_PORT then 3001.
EXPOSE 3001
CMD ["node", "dist-server/index.js"]
