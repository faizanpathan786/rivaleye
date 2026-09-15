FROM oven/bun:1
WORKDIR /repo

COPY . .
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN bun install --frozen-lockfile

EXPOSE 4000
ENV NODE_ENV=production
WORKDIR /repo/packages/api
CMD ["bun", "src/server.ts"]
