# Multi-stage build: compile everything in cloud, no disk space issues

# Stage 1: Build stage
FROM node:20-slim as builder

# Install dependencies first (Chrome, build tools, and extraction tools)
RUN apt-get update && \
    apt-get install -y \
      chromium \
      chromium-sandbox \
      python3 \
      make \
      g++ \
      tar \
      unzip \
      gzip && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy root config files needed for build
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml tsconfig.base.json turbo.json .prettierrc* ./

# Copy all packages
COPY packages ./packages

# Install pnpm and dependencies
RUN npm install -g pnpm@9.15.2 && \
    pnpm install --frozen-lockfile

# Build everything
RUN pnpm exec turbo run build --concurrency=1

# Stage 2: Runtime stage (smaller image)
FROM node:20-slim

# Install runtime dependencies (Chrome, sandbox, and tools)
RUN apt-get update && \
    apt-get install -y \
      chromium \
      chromium-sandbox \
      tar \
      unzip && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy root config files
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml tsconfig.base.json turbo.json .prettierrc* ./
COPY packages ./packages

# Install pnpm and production dependencies only
RUN npm install -g pnpm@9.15.2 && \
    pnpm install --frozen-lockfile --prod

# Copy built output from builder stage
COPY --from=builder /app/packages ./packages

# Set environment - use system chromium and limit memory
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=2048"
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_DOWNLOAD=false

# Default port for API
EXPOSE 4000

# Start all services with PM2
CMD ["pnpm", "start"]
