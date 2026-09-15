FROM oven/bun:1
WORKDIR /repo

COPY . .
RUN bun install --frozen-lockfile

ENV NODE_ENV=production
WORKDIR /repo/packages/worker
CMD ["bun", "src/pg-runner/index.ts"]
