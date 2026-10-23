# ─── Stage 1: Install dependencies ───────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace manifests for dependency resolution
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/

# Install all dependencies (devDeps needed for build)
RUN pnpm install --frozen-lockfile

# ─── Stage 2: Build ──────────────────────────────────────────────────────────
FROM deps AS builder
WORKDIR /app

# Copy root tsconfig (extended by apps/backend)
COPY tsconfig.base.json ./

# Copy backend source
COPY apps/backend ./apps/backend

# Generate Prisma client (does NOT need DATABASE_URL)
WORKDIR /app/apps/backend
RUN pnpm run db:generate

# Build api entry + worker entry (outputs to dist/api/ and dist/worker/)
RUN pnpm run build

# ─── Stage 3: Production runtime ─────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/

# Install production-only dependencies
RUN pnpm install --frozen-lockfile --prod

# Copy compiled output and prisma schema/migrations from builder
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/apps/backend/prisma ./apps/backend/prisma

# Copy entrypoint scripts and make them executable
COPY apps/backend/entrypoint.api.sh ./apps/backend/entrypoint.api.sh
COPY apps/backend/entrypoint.worker.sh ./apps/backend/entrypoint.worker.sh
RUN chmod +x /app/apps/backend/entrypoint.api.sh /app/apps/backend/entrypoint.worker.sh

# Set working directory to backend so prisma CLI resolves schema correctly
WORKDIR /app/apps/backend
