FROM oven/bun:1
WORKDIR /repo

RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium \
  && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

COPY . .
RUN bun install --frozen-lockfile

EXPOSE 10000
ENV NODE_ENV=production
WORKDIR /repo/packages/worker
CMD ["bun", "src/render-web-entry.ts"]
