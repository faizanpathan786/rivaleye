# Multi-stage build: compile everything in cloud, no disk space issues

# Stage 1: Build stage
FROM node:20-slim as builder

# Install dependencies first (Chrome, build tools)
RUN apt-get update && \
    apt-get install -y \
      chromium \
      chromium-sandbox \
      python3 \
      make \
      g++ && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy lock file and workspace files
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml tsconfig.base.json ./

# Copy all packages
COPY packages ./packages

# Install pnpm and dependencies
RUN npm install -g pnpm@9.15.2 && \
    pnpm install --frozen-lockfile

# Build everything
RUN pnpm exec turbo run build --concurrency=1

# Stage 2: Runtime stage (smaller image)
FROM node:20-slim

# Install only runtime dependencies (Chrome, sandbox)
RUN apt-get update && \
    apt-get install -y \
      chromium \
      chromium-sandbox && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
COPY packages ./packages

# Install pnpm and production dependencies only
RUN npm install -g pnpm@9.15.2 && \
    pnpm install --frozen-lockfile --prod

# Copy built output from builder stage
COPY --from=builder /app/packages ./packages

# Set environment
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=2048"

# Default port for API
EXPOSE 4000

# Start all services with PM2
CMD ["pnpm", "start"]
