# RivalEye Landing Page — Design Spec

**Date:** 2026-05-21
**Status:** Approved
**Package:** `@rivaleye/landing` (new, `packages/landing/`)

## 1. Purpose

A standalone marketing landing page for RivalEye — a tool that helps early-stage
B2B SaaS founders find what users complain about in competing products. The page
sells the product and captures pre-launch leads via an email form.

This package is intentionally decoupled from `@rivaleye/web` and `@rivaleye/api`.
It shares no runtime stack, no components, and no build tooling with them. It can
be moved out of the monorepo later without untangling dependencies.

## 2. Stack

- **Framework:** Astro 5, static output (`output: 'static'`).
- **Styling:** Tailwind CSS v4 via `@tailwindcss/vite` (CSS-first config, no
  `tailwind.config.js`).
- **Fonts:** Inter variable, self-hosted via `@fontsource-variable/inter`.
- **Interactivity:** one React island (`EmailForm.tsx`) via `@astrojs/react`.
  Everything else is static `.astro`.
- **Scroll reveal:** IntersectionObserver in a small inline script. No animation
  library.
- **Dev port:** 4321 (Astro default).

No dependency on other workspace packages. Its own `package.json` with name
`@rivaleye/landing`. `tsconfig.json` extends `../../tsconfig.base.json` to keep
strict-mode parity with the repo.

## 3. Visual direction

Light, clean B2B SaaS ("Linear-lite"):

- Background `#fbfbfd`, surface white, ink text `#0c0c0e`.
- Accent indigo `#4f46e5`; muted text `#5b5b66`; hairline borders `#e6e6ea`.
- Soft, low shadows. Generous whitespace. Rounded corners (`12–16px`).
- Type: Inter. Large bold display headings, comfortable body measure.
- Theme tokens defined once in `src/styles/global.css` with Tailwind v4
  `@theme`.

## 4. Page structure

Single page (`pages/index.astro`) stacking nine section components, top to
bottom:

1. **Nav** — wordmark + anchor links (How it works, Features). No login link.
2. **Hero** — headline "Find what your competitor's users hate before you
   build", subcopy, email-capture form, one-line trust note.
3. **Logos** — "Pulls signal from" row: Reddit, G2, Capterra, Product Hunt, X,
   App Store, Play Store, Google Maps. Grayscale.
4. **Problem** — short empathy block: building blind, guessing at gaps.
5. **HowItWorks** — three steps: enter a competitor → workers scrape across
   platforms → get a Pain Report.
6. **Features** — six cards: Pain clusters, Feature gaps, Pricing pain,
   Switching signals, Positioning angles, Product opportunities.
7. **ReportPreview** — stylized mock of a Pain Report card with realistic but
   fake data, so visitors see the deliverable.
8. **CtaBand** — repeated email capture on an indigo background.
9. **Footer** — wordmark, copyright, minimal links.

## 5. Components

Each component is one file, one section, one purpose. Located in
`src/components/`. `index.astro` imports and stacks them; it holds no layout
logic beyond ordering.

`EmailForm.tsx` is the only interactive unit. Props: `variant: 'hero' |
'band'` (controls color treatment for light vs. indigo background). Behavior: on
submit, `preventDefault`, basic email-shape validation, then swap the form for a
"Thanks — we'll be in touch." message. No network call, no backend. Used in both
Hero and CtaBand.

## 6. File layout

```
packages/landing/
  package.json
  astro.config.mjs
  tsconfig.json
  src/
    styles/global.css        Tailwind import + @theme tokens
    layouts/Base.astro       <head>, meta + OG tags, font import
    components/
      Nav.astro
      Hero.astro
      Logos.astro
      Problem.astro
      HowItWorks.astro
      Features.astro
      ReportPreview.astro
      CtaBand.astro
      Footer.astro
      EmailForm.tsx
    pages/index.astro
  public/                    favicon, og image
```

## 7. Out of scope

Pricing section, testimonials, FAQ, login/app link, real lead-capture backend,
analytics, multi-page routing, i18n. The email form is presentational only.

## 8. Success criteria

- `pnpm --filter @rivaleye/landing dev` serves the page on :4005.
- `pnpm --filter @rivaleye/landing build` produces a static `dist/` with no
  errors.
- All nine sections render, responsive from 360px to wide desktop.
- Email form: invalid input shows an error; valid input swaps to the thanks
  state. Works in both hero and band variants.
- Type-check passes under repo strict settings.
- No imports from `@rivaleye/*` packages.
