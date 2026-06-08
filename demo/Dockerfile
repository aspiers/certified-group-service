# Demo app (React SPA + Express BFF) — single-container image.
# The BFF serves both /api and the built client (see server/index.ts).
FROM node:22-slim AS builder
WORKDIR /app
# CI=true so pnpm runs non-interactively (e.g. `prune --prod` won't block on a
# TTY confirmation for purging modules).
ENV CI=true
RUN corepack enable
# In this build the context is demo/ (Railway Root Directory = demo), so there is
# no parent pnpm workspace — demo/pnpm-workspace.yaml is the workspace root here.
# Copy it so its `allowBuilds` is read, letting esbuild/core-js build their native
# pieces without an interactive `pnpm approve-builds` (no --ignore-workspace).
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
# vite build -> dist/ (client), tsc -p tsconfig.server.json -> dist-server/ (BFF)
RUN pnpm build
RUN pnpm prune --prod

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-server ./dist-server
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
# The server listens on PORT (Railway's convention) then BFF_PORT then 3001.
EXPOSE 3001
CMD ["node", "dist-server/index.js"]
