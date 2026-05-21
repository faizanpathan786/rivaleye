# RivalEye — Handoff Notes

A premium B2B SaaS landing page for **RivalEye** — a competitor-intelligence tool.
Direction: **TERMINAL** — Bloomberg-intelligence aesthetic, acid lime on near-black.

## Run it

```bash
tar -xzf rivaleye.tar.gz
cd rivaleye
pnpm install
pnpm dev          # http://localhost:4321
pnpm build        # static output to packages/landing/dist/
```

Requires: Node 20+, pnpm 9+.

## Stack

- **Astro 5** static output
- **Tailwind v4** — CSS-first `@theme` tokens, no config file
- **React 18** — single island for the email form, hydrated with `client:visible`
- **GSAP + ScrollTrigger** — counters, scroll choreography
- **Bricolage Grotesque Variable** display / **Geist Variable** body / **Geist Mono Variable** for terminal labels — all self-hosted via @fontsource

## What's on the page

| Section | Component | Notes |
|---|---|---|
| Header | `Nav.astro` | Sticky terminal chrome: live UTC clock, status row (desktop), wordmark, §0X-indexed links, CTA |
| Hero | `Hero.astro` | Editorial 4-line headline with blink-cursor accent + live scan terminal panel showing 6 sources + 4 cluster bars filling |
| Sources | `PlatformRow.astro` | Full-bleed marquee of 8 platforms with abstract glyphs (not branded logos), live indicators |
| §01 / Problem | `Problem.astro` | "You're building on a hunch." Two-stat callout + a wall of 24 unread complaint snippets scrolling vertically with a center "unread by your team" badge |
| §02 / How it works | `HowItWorks.astro` | Three alternating rows with a vertical lime-dot rail, each step has a unique inline visual (input panel / 8-platform progress grid / report preview) |
| §03 / Lenses | `Features.astro` | 3×2 grid of the six report lenses. **Each card has its own micro-viz**: severity bars / gap list / WTP distribution / migration arrows / sentiment polarity / scored opportunities |
| §04 / Sample report | `SampleReport.astro` | Detailed mock of the deliverable — featured cluster with severity bar, 4 sourced quotes (staggered fade-in), "build this" callout, 50-cell heatmap of all clusters, lens index |
| §05 / FAQ | `FAQ.astro` | Native `<details>` expandable list, terminal Q.0X / A.0X mono prefixes, sticky meta column on desktop |
| §06 / CTA | `CTA.astro` | Big closer with framed React `EmailForm` island, validation + success states, trust strip |
| Footer | `Footer.astro` | Wordmark + tagline + 3 link columns + bottom status row mirroring the Nav's terminal chrome |

## Design tokens — where to tweak

**All design tokens live in one file**: `packages/landing/src/styles/global.css`

The `@theme { … }` block at the top defines every color, font, easing, and tracking value as a CSS variable. Change anything there and Tailwind v4 regenerates utilities automatically — no config rebuild needed.

Key tokens to consider tweaking:

- `--color-lime: #c6f432` — the single accent. Try `#a3e635` for softer, `#dfff4a` for brighter.
- `--color-bg-0` through `--color-bg-4` — the background ramp from page (`bg-0`) through elevated cards (`bg-4`).
- `--font-display` — currently Bricolage Grotesque. Swap to any `@fontsource-variable/*` package by changing both the `@import` at the top and this token.

## Animation primitives

- `.reveal` / `.reveal-stagger` — opacity + translate-up animation triggered when scrolled into view by the IntersectionObserver in `src/lib/motion.ts`. Add `class="reveal"` or `class="reveal-stagger"` to any element.
- `[data-counter="2417"]` — animated number counter. Use `data-counter-decimals="2"`, `data-counter-prefix="$"`, `data-counter-suffix="%"` as needed.
- `.animate-blink` / `.animate-marquee` / `.animate-scan` / `.animate-pulse-lime` / `.animate-glow-pulse` — CSS-only loops defined in global.css.
- `.scanlines` — adds subtle CRT scanlines to a panel.
- `.bg-grid`, `.bg-grid-fine`, `.bg-dots`, `.mask-fade-edges`, `.mask-fade-bottom` — background textures + masks.
- All animations respect `prefers-reduced-motion: reduce`.

## What's intentionally NOT included

- **No real backend** for the email form — it simulates a 700ms submit and shows the success state. Wire it to your provider (Resend, Mailchimp, your own API) in `src/components/react/EmailForm.tsx`.
- **No analytics** — add Plausible/Fathom/Vercel Analytics in `BaseLayout.astro`.
- **No SEO sitemap/robots** — install `@astrojs/sitemap` if needed.
- **Brand logos** for the 8 platforms are intentionally **abstract geometric glyphs**, not actual brand SVGs. This avoids IP issues and matches the terminal aesthetic. If you want real logos, swap them in `PlatformRow.astro`.

## Performance notes

- Total client JS for the landing page: ~46 KB gzipped (most of it GSAP). The React island for the email form adds 2 KB gzipped, hydrated only on `client:visible`.
- Fonts are self-hosted and woff2-compressed. No FOIT, no Google Fonts call.
- All section animations are CSS-keyframe-based — GSAP is only used for the animated counters and ScrollTrigger setup.

## Browser support

Modern evergreen (last 2 years). Uses CSS nesting, `color-scheme`, native `<details>`, and CSS variables — all baseline.
