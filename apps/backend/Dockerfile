# ─── Stage 1: Install dependencies ───────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

ENV NODE_OPTIONS="--dns-result-order=ipv4first"
ENV PNPM_STORE_DIR="/pnpm/store"
ENV PNPM_FETCH_TIMEOUT=600000
ENV PNPM_NETWORK_CONCURRENCY=8

# Enable pnpm matching root packageManager
RUN corepack enable && corepack prepare pnpm@11.11.0 --activate

# Copy workspace manifests for dependency resolution
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/

# Install backend dependencies (devDeps needed for build)
RUN pnpm install --frozen-lockfile --filter @hau-cex/backend...

# ─── Stage 2: Build ──────────────────────────────────────────────────────────
FROM deps AS builder
WORKDIR /app

# Copy root tsconfig (extended by apps/backend)
COPY tsconfig.base.json ./

# Copy backend source
COPY apps/backend ./apps/backend

# Generate Prisma client (prisma.config.ts reads DATABASE_URL, so provide build-time dummy URL)
WORKDIR /app/apps/backend
RUN DATABASE_URL="postgresql://postgres:postgres@localhost:5432/hau_cex?schema=public" pnpm run db:generate

# Build api entry + worker entry (outputs to dist/api/ and dist/worker/)
RUN pnpm run build

# ─── Stage 3: Prune to production dependencies (offline, no extra network fetch)
FROM deps AS prod-deps
WORKDIR /app

RUN CI=true pnpm install --frozen-lockfile --prod --offline --filter @hau-cex/backend...

# ─── Stage 4: Production runtime ─────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

# Copy workspace manifests and production node_modules (keep workspace .pnpm symlinks intact)
COPY --from=prod-deps /app/package.json ./
COPY --from=prod-deps /app/apps/backend/package.json ./apps/backend/
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/apps/backend/node_modules ./apps/backend/node_modules

# Copy compiled output, prisma config/schema/migrations from builder
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/apps/backend/prisma ./apps/backend/prisma
COPY --from=builder /app/apps/backend/prisma.config.ts ./apps/backend/prisma.config.ts

# Copy entrypoint scripts and make them executable
COPY apps/backend/entrypoint.api.sh ./apps/backend/entrypoint.api.sh
COPY apps/backend/entrypoint.worker.sh ./apps/backend/entrypoint.worker.sh
RUN chmod +x /app/apps/backend/entrypoint.api.sh /app/apps/backend/entrypoint.worker.sh

# Set working directory to backend so prisma CLI resolves schema and config correctly
WORKDIR /app/apps/backend
