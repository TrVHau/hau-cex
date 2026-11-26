# ─── Stage 1: Install dependencies ───────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

ENV NODE_OPTIONS="--dns-result-order=ipv4first"
ENV PNPM_FETCH_TIMEOUT=600000

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@11.11.0 --activate

# Copy workspace manifests for dependency resolution
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/

# Install frontend dependencies from the workspace lockfile
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter @hau-cex/web...

# ─── Stage 2: Build ──────────────────────────────────────────────────────────
FROM deps AS builder
WORKDIR /app

# Copy root tsconfig (extended by apps/web/tsconfig.app.json)
COPY tsconfig.base.json ./

# Copy web source and assets
COPY apps/web ./apps/web

# Build-time Vite environment variables
ARG VITE_API_URL=http://localhost:3000/api/v1
ARG VITE_WS_URL=http://localhost:3000/ws
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL

WORKDIR /app/apps/web
RUN pnpm run build

# ─── Stage 3: Production runtime (Nginx) ─────────────────────────────────────
FROM nginx:1.27-alpine AS runner

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=3s --retries=5 --start-period=5s \
  CMD wget -qO- http://127.0.0.1:80/ >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
