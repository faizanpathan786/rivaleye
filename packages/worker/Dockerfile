FROM oven/bun:1
WORKDIR /repo

COPY . .
RUN bun install --frozen-lockfile

EXPOSE 10000
ENV NODE_ENV=production
WORKDIR /repo/packages/worker
CMD ["bun", "src/render-web-entry.ts"]
