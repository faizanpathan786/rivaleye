# RivalEye

> Find what your competitor's users hate — before you build.

RivalEye scrapes complaints across 8 platforms (Reddit, G2, Capterra, Product Hunt, X, App Store, Play Store, Google Maps), then clusters them into a Competitor Pain Report.

## Repository layout

This is a pnpm workspace. Packages live under `packages/*`.

```
packages/
  landing/   — Astro 5 + Tailwind v4 marketing site (this package)
```

## Getting started

```bash
pnpm install
pnpm dev          # runs the landing site on http://localhost:4005
pnpm build        # static build to packages/landing/dist
pnpm preview      # preview the production build
```

## Stack

- **Astro 5** — static output, zero-JS by default
- **Tailwind v4** — CSS-first, `@theme` tokens, no config file
- **React 18** — one island, for the email capture form
- **GSAP + ScrollTrigger** — scroll choreography, scanning effects, counters
- **TypeScript** — strict mode

## Package independence

Packages under `@rivaleye/*` do not import from one another. Each is independently buildable.
