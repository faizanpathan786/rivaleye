# RivalEye Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone, state-of-the-art marketing landing page for RivalEye as a new `@rivaleye/landing` package.

**Architecture:** Astro 5 static site, Tailwind v4 (CSS-first config). Nine static `.astro` section components stacked in one page. One React island for the email form. No dependency on any other workspace package.

**Tech Stack:** Astro 5, `@astrojs/react`, React 18, Tailwind CSS v4 (`@tailwindcss/vite`), `@fontsource-variable/inter`, TypeScript strict.

**Note on testing:** This is a static marketing page — content is markup and styling, not logic. The verification gate for each task is `astro build` succeeding plus visual/structural checks, not unit tests. The one piece of real logic (email form validation) gets explicit behavioral verification in Task 11.

---

## File Structure

```
packages/landing/
  package.json              name @rivaleye/landing, scripts: dev/build/preview/type-check
  astro.config.mjs          react + tailwind vite plugin, static output
  tsconfig.json             extends ../../tsconfig.base.json + astro/tsconfigs/strict
  src/
    styles/global.css       Tailwind import + @theme tokens
    layouts/Base.astro      <html>/<head>, meta + OG, font import, global.css
    pages/index.astro       imports + stacks all 9 sections
    components/
      Nav.astro             sticky top nav, wordmark + anchor links
      Hero.astro            headline, subcopy, EmailForm island, trust note
      Logos.astro           "Pulls signal from" platform row
      Problem.astro         empathy block
      HowItWorks.astro      3 numbered steps
      Features.astro        6-card grid
      ReportPreview.astro   mock Pain Report card
      CtaBand.astro         indigo band + EmailForm island
      Footer.astro          wordmark, copyright, links
      EmailForm.tsx         React island, variant prop, validation + thanks state
  public/
    favicon.svg
```

Each section component owns exactly one band of the page. `index.astro` holds only ordering. `EmailForm.tsx` is the only stateful unit.

---

### Task 1: Scaffold the package

**Files:**
- Create: `packages/landing/package.json`
- Create: `packages/landing/astro.config.mjs`
- Create: `packages/landing/tsconfig.json`
- Create: `packages/landing/src/env.d.ts`

- [ ] **Step 1: Create `packages/landing/package.json`**

```json
{
  "name": "@rivaleye/landing",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "type-check": "astro check"
  },
  "dependencies": {
    "astro": "^5.2.5",
    "@astrojs/react": "^4.2.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "@fontsource-variable/inter": "^5.1.1"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.0.6",
    "tailwindcss": "^4.0.6",
    "@astrojs/check": "^0.9.4",
    "@types/react": "^18.3.18",
    "@types/react-dom": "^18.3.5"
  }
}
```

- [ ] **Step 2: Create `packages/landing/astro.config.mjs`**

```js
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  output: "static",
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
});
```

- [ ] **Step 3: Create `packages/landing/tsconfig.json`**

```json
{
  "extends": ["../../tsconfig.base.json", "astro/tsconfigs/strict"],
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "react"
  },
  "include": [".astro/types.d.ts", "src/**/*"],
  "exclude": ["dist"]
}
```

- [ ] **Step 4: Create `packages/landing/src/env.d.ts`**

```ts
/// <reference path="../.astro/types.d.ts" />
```

- [ ] **Step 5: Install dependencies**

Run from repo root: `pnpm install`
Expected: completes without error; `@rivaleye/landing` appears in the workspace.

- [ ] **Step 6: Commit**

```bash
git add packages/landing
git commit -m "feat(landing): scaffold @rivaleye/landing astro package"
```

---

### Task 2: Theme tokens and global styles

**Files:**
- Create: `packages/landing/src/styles/global.css`

- [ ] **Step 1: Create `packages/landing/src/styles/global.css`**

```css
@import "tailwindcss";
@import "@fontsource-variable/inter";

@theme {
  --color-bg: #fbfbfd;
  --color-surface: #ffffff;
  --color-ink: #0c0c0e;
  --color-muted: #5b5b66;
  --color-line: #e6e6ea;
  --color-accent: #4f46e5;
  --color-accent-hover: #4338ca;
  --color-accent-soft: #eef0ff;

  --font-sans: "Inter Variable", ui-sans-serif, system-ui, sans-serif;

  --radius-card: 16px;
  --shadow-soft: 0 1px 2px rgba(12, 12, 14, 0.04),
    0 8px 24px rgba(12, 12, 14, 0.06);
}

html {
  scroll-behavior: smooth;
}

body {
  background-color: var(--color-bg);
  color: var(--color-ink);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
}

/* Scroll-reveal: elements start hidden, .is-visible reveals them. */
.reveal {
  opacity: 0;
  transform: translateY(16px);
  transition: opacity 0.6s ease, transform 0.6s ease;
}
.reveal.is-visible {
  opacity: 1;
  transform: none;
}
@media (prefers-reduced-motion: reduce) {
  .reveal {
    opacity: 1;
    transform: none;
    transition: none;
  }
}
```

- [ ] **Step 2: Verify the file is valid CSS**

Run: `node -e "require('fs').readFileSync('packages/landing/src/styles/global.css','utf8')"`
Expected: no output, exit 0. (Full build verification happens in Task 4.)

- [ ] **Step 3: Commit**

```bash
git add packages/landing/src/styles/global.css
git commit -m "feat(landing): theme tokens and global styles"
```

---

### Task 3: Base layout

**Files:**
- Create: `packages/landing/src/layouts/Base.astro`

- [ ] **Step 1: Create `packages/landing/src/layouts/Base.astro`**

```astro
---
import "../styles/global.css";

interface Props {
  title?: string;
  description?: string;
}

const {
  title = "RivalEye — Find what your competitor's users hate before you build",
  description = "RivalEye scrapes Reddit, G2, Capterra and more, then uses AI to cluster what users complain about in competing products into a Competitor Pain Report.",
} = Astro.props;
---

<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <title>{title}</title>
    <meta name="description" content={description} />
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary_large_image" />
  </head>
  <body>
    <slot />
    <script>
      const els = document.querySelectorAll(".reveal");
      const io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) {
              e.target.classList.add("is-visible");
              io.unobserve(e.target);
            }
          }
        },
        { threshold: 0.12 },
      );
      els.forEach((el) => io.observe(el));
    </script>
  </body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add packages/landing/src/layouts/Base.astro
git commit -m "feat(landing): base layout with meta tags and scroll-reveal"
```

---

### Task 4: Favicon and minimal index page (build smoke test)

**Files:**
- Create: `packages/landing/public/favicon.svg`
- Create: `packages/landing/src/pages/index.astro`

- [ ] **Step 1: Create `packages/landing/public/favicon.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="8" fill="#4f46e5" />
  <circle cx="16" cy="16" r="7" fill="none" stroke="#fff" stroke-width="2.5" />
  <circle cx="16" cy="16" r="2.5" fill="#fff" />
</svg>
```

- [ ] **Step 2: Create a minimal `packages/landing/src/pages/index.astro`**

```astro
---
import Base from "../layouts/Base.astro";
---

<Base>
  <main>
    <h1>RivalEye</h1>
  </main>
</Base>
```

- [ ] **Step 3: Build to verify the toolchain works**

Run: `pnpm --filter @rivaleye/landing build`
Expected: build succeeds, `packages/landing/dist/index.html` is produced.

- [ ] **Step 4: Commit**

```bash
git add packages/landing/public packages/landing/src/pages/index.astro
git commit -m "feat(landing): favicon and minimal index page"
```

---

### Task 5: Nav and Footer components

**Files:**
- Create: `packages/landing/src/components/Nav.astro`
- Create: `packages/landing/src/components/Footer.astro`

- [ ] **Step 1: Create `packages/landing/src/components/Nav.astro`**

```astro
---
---

<header
  class="sticky top-0 z-50 border-b border-line/80 bg-bg/80 backdrop-blur-md"
>
  <nav
    class="mx-auto flex h-16 max-w-6xl items-center justify-between px-6"
  >
    <a href="#top" class="flex items-center gap-2 font-semibold tracking-tight">
      <span
        class="grid h-7 w-7 place-items-center rounded-lg bg-accent text-white"
      >
        <svg width="16" height="16" viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="9" stroke="currentColor" stroke-width="3" />
          <circle cx="16" cy="16" r="3" fill="currentColor" />
        </svg>
      </span>
      <span class="text-[17px]">RivalEye</span>
    </a>
    <div class="hidden items-center gap-8 text-sm text-muted sm:flex">
      <a href="#how" class="transition-colors hover:text-ink">How it works</a>
      <a href="#features" class="transition-colors hover:text-ink">Features</a>
      <a
        href="#cta"
        class="rounded-lg bg-ink px-4 py-2 font-medium text-white transition-colors hover:bg-ink/90"
      >
        Get early access
      </a>
    </div>
  </nav>
</header>
```

- [ ] **Step 2: Create `packages/landing/src/components/Footer.astro`**

```astro
---
const year = new Date().getFullYear();
---

<footer class="border-t border-line bg-surface">
  <div
    class="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-6 py-12 sm:flex-row"
  >
    <div class="flex items-center gap-2 font-semibold">
      <span
        class="grid h-6 w-6 place-items-center rounded-md bg-accent text-white"
      >
        <svg width="14" height="14" viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="9" stroke="currentColor" stroke-width="3" />
          <circle cx="16" cy="16" r="3" fill="currentColor" />
        </svg>
      </span>
      RivalEye
    </div>
    <p class="text-sm text-muted">
      &copy; {year} RivalEye. Find what your competitor's users hate.
    </p>
    <div class="flex gap-6 text-sm text-muted">
      <a href="#how" class="transition-colors hover:text-ink">How it works</a>
      <a href="#features" class="transition-colors hover:text-ink">Features</a>
    </div>
  </div>
</footer>
```

- [ ] **Step 3: Commit**

```bash
git add packages/landing/src/components/Nav.astro packages/landing/src/components/Footer.astro
git commit -m "feat(landing): nav and footer components"
```

---

### Task 6: EmailForm React island

**Files:**
- Create: `packages/landing/src/components/EmailForm.tsx`

- [ ] **Step 1: Create `packages/landing/src/components/EmailForm.tsx`**

```tsx
import { useState, type FormEvent } from "react";

interface EmailFormProps {
  variant?: "hero" | "band";
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EmailForm({ variant = "hero" }: EmailFormProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const onBand = variant === "band";

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    setError("");
    setDone(true);
  }

  if (done) {
    return (
      <p
        class={
          onBand
            ? "text-base font-medium text-white"
            : "text-base font-medium text-ink"
        }
      >
        Thanks — we'll be in touch.
      </p>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      class="flex w-full max-w-md flex-col gap-2 sm:flex-row"
      noValidate
    >
      <div class="flex-1">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
          placeholder="you@company.com"
          aria-label="Work email"
          class={
            "w-full rounded-lg border px-4 py-3 text-sm outline-none transition-shadow focus:ring-2 " +
            (onBand
              ? "border-white/30 bg-white/10 text-white placeholder:text-white/60 focus:ring-white/40"
              : "border-line bg-surface text-ink placeholder:text-muted focus:ring-accent/30")
          }
        />
        {error ? (
          <p
            class={
              "mt-1 text-xs " + (onBand ? "text-white/90" : "text-red-600")
            }
          >
            {error}
          </p>
        ) : null}
      </div>
      <button
        type="submit"
        class={
          "rounded-lg px-5 py-3 text-sm font-semibold transition-colors " +
          (onBand
            ? "bg-white text-accent hover:bg-white/90"
            : "bg-accent text-white hover:bg-accent-hover")
        }
      >
        Get early access
      </button>
    </form>
  );
}
```

Note: Astro's JSX uses `class`, not `className`, even in `.tsx` island files rendered by Astro's React integration — `class` works in both. Keep `class` for consistency with the `.astro` files.

- [ ] **Step 2: Commit**

```bash
git add packages/landing/src/components/EmailForm.tsx
git commit -m "feat(landing): email form react island with validation"
```

---

### Task 7: Hero and Logos sections

**Files:**
- Create: `packages/landing/src/components/Hero.astro`
- Create: `packages/landing/src/components/Logos.astro`

- [ ] **Step 1: Create `packages/landing/src/components/Hero.astro`**

```astro
---
import { EmailForm } from "./EmailForm.tsx";
---

<section id="top" class="relative overflow-hidden">
  <div
    class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px] bg-[radial-gradient(60%_60%_at_50%_0%,var(--color-accent-soft),transparent)]"
  >
  </div>
  <div class="mx-auto max-w-3xl px-6 pb-20 pt-24 text-center sm:pt-32">
    <span
      class="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-muted"
    >
      <span class="h-1.5 w-1.5 rounded-full bg-accent"></span>
      Competitor intelligence for B2B SaaS founders
    </span>
    <h1
      class="mt-6 text-balance text-4xl font-bold tracking-tight sm:text-6xl"
    >
      Find what your competitor's users
      <span class="text-accent"> hate</span> before you build.
    </h1>
    <p class="mx-auto mt-6 max-w-xl text-balance text-lg text-muted">
      RivalEye pulls real complaints from across the web and uses AI to turn
      them into a Competitor Pain Report — pain points, feature gaps, and
      positioning angles you can act on.
    </p>
    <div class="mt-8 flex justify-center">
      <EmailForm client:load variant="hero" />
    </div>
    <p class="mt-3 text-xs text-muted">
      No credit card. Be first in line for the private beta.
    </p>
  </div>
</section>
```

- [ ] **Step 2: Create `packages/landing/src/components/Logos.astro`**

```astro
---
const platforms = [
  "Reddit",
  "G2",
  "Capterra",
  "Product Hunt",
  "X",
  "App Store",
  "Play Store",
  "Google Maps",
];
---

<section class="border-y border-line bg-surface">
  <div class="mx-auto max-w-6xl px-6 py-10">
    <p class="text-center text-xs font-medium uppercase tracking-wider text-muted">
      Pulls signal from
    </p>
    <div
      class="mt-5 flex flex-wrap items-center justify-center gap-x-10 gap-y-4"
    >
      {
        platforms.map((p) => (
          <span class="text-sm font-semibold text-ink/40">{p}</span>
        ))
      }
    </div>
  </div>
</section>
```

- [ ] **Step 3: Commit**

```bash
git add packages/landing/src/components/Hero.astro packages/landing/src/components/Logos.astro
git commit -m "feat(landing): hero and logos sections"
```

---

### Task 8: Problem and HowItWorks sections

**Files:**
- Create: `packages/landing/src/components/Problem.astro`
- Create: `packages/landing/src/components/HowItWorks.astro`

- [ ] **Step 1: Create `packages/landing/src/components/Problem.astro`**

```astro
---
---

<section class="mx-auto max-w-3xl px-6 py-24 text-center">
  <p class="reveal text-sm font-semibold uppercase tracking-wider text-accent">
    The problem
  </p>
  <h2 class="reveal mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
    You're building on guesses.
  </h2>
  <p class="reveal mt-5 text-lg text-muted">
    Your competitor's users are telling you exactly what's broken — in Reddit
    threads, review sites, and app store ratings. But that signal is scattered
    across a dozen platforms and thousands of posts. Most founders never read
    it, and ship features nobody asked for.
  </p>
</section>
```

- [ ] **Step 2: Create `packages/landing/src/components/HowItWorks.astro`**

```astro
---
const steps = [
  {
    n: "01",
    title: "Name a competitor",
    body: "Enter a competing product or a category. That's the entire setup.",
  },
  {
    n: "02",
    title: "Workers scrape in parallel",
    body: "RivalEye pulls discussions and reviews from every supported platform at once.",
  },
  {
    n: "03",
    title: "Get a Pain Report",
    body: "AI clusters thousands of complaints into clear, ranked, actionable themes.",
  },
];
---

<section id="how" class="mx-auto max-w-6xl px-6 py-24">
  <div class="mx-auto max-w-2xl text-center">
    <p class="reveal text-sm font-semibold uppercase tracking-wider text-accent">
      How it works
    </p>
    <h2 class="reveal mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
      From competitor name to insight in three steps.
    </h2>
  </div>
  <div class="mt-14 grid gap-6 sm:grid-cols-3">
    {
      steps.map((s) => (
        <div
          class="reveal rounded-card border border-line bg-surface p-7"
          style={`box-shadow: var(--shadow-soft)`}
        >
          <span class="text-sm font-semibold text-accent">{s.n}</span>
          <h3 class="mt-3 text-lg font-semibold">{s.title}</h3>
          <p class="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
        </div>
      ))
    }
  </div>
</section>
```

- [ ] **Step 3: Commit**

```bash
git add packages/landing/src/components/Problem.astro packages/landing/src/components/HowItWorks.astro
git commit -m "feat(landing): problem and how-it-works sections"
```

---

### Task 9: Features grid

**Files:**
- Create: `packages/landing/src/components/Features.astro`

- [ ] **Step 1: Create `packages/landing/src/components/Features.astro`**

```astro
---
const features = [
  {
    title: "Pain clusters",
    body: "Thousands of complaints grouped into ranked themes, so you see the biggest problems first.",
  },
  {
    title: "Feature gaps",
    body: "What users wish the competitor had — your roadmap, sourced from real demand.",
  },
  {
    title: "Pricing pain",
    body: "Where users feel overcharged, nickel-and-dimed, or trapped by the pricing model.",
  },
  {
    title: "Switching signals",
    body: "Users actively looking to leave — and exactly what would make them switch.",
  },
  {
    title: "Positioning angles",
    body: "The messaging wedges your competitor leaves wide open for you to take.",
  },
  {
    title: "Product opportunities",
    body: "Concrete, prioritized ideas for what to build to win frustrated users.",
  },
];
---

<section id="features" class="border-y border-line bg-surface">
  <div class="mx-auto max-w-6xl px-6 py-24">
    <div class="mx-auto max-w-2xl text-center">
      <p
        class="reveal text-sm font-semibold uppercase tracking-wider text-accent"
      >
        What you get
      </p>
      <h2 class="reveal mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
        Six lenses on your competitor's weaknesses.
      </h2>
    </div>
    <div class="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {
        features.map((f) => (
          <div class="reveal rounded-card border border-line bg-bg p-7">
            <div class="grid h-10 w-10 place-items-center rounded-lg bg-accent-soft text-accent">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M5 12l5 5L19 7"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </div>
            <h3 class="mt-4 text-lg font-semibold">{f.title}</h3>
            <p class="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
          </div>
        ))
      }
    </div>
  </div>
</section>
```

- [ ] **Step 2: Commit**

```bash
git add packages/landing/src/components/Features.astro
git commit -m "feat(landing): features grid section"
```

---

### Task 10: ReportPreview and CtaBand sections

**Files:**
- Create: `packages/landing/src/components/ReportPreview.astro`
- Create: `packages/landing/src/components/CtaBand.astro`

- [ ] **Step 1: Create `packages/landing/src/components/ReportPreview.astro`**

```astro
---
const painPoints = [
  { label: "Onboarding is confusing", weight: 92, mentions: 184 },
  { label: "Sync breaks silently", weight: 78, mentions: 141 },
  { label: "Pricing jumps at scale", weight: 64, mentions: 97 },
  { label: "Slow, unhelpful support", weight: 51, mentions: 73 },
];
---

<section class="mx-auto max-w-6xl px-6 py-24">
  <div class="mx-auto max-w-2xl text-center">
    <p class="reveal text-sm font-semibold uppercase tracking-wider text-accent">
      The deliverable
    </p>
    <h2 class="reveal mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
      A report you can act on the same day.
    </h2>
  </div>

  <div
    class="reveal mx-auto mt-14 max-w-3xl rounded-card border border-line bg-surface p-2"
    style="box-shadow: var(--shadow-soft)"
  >
    <div class="rounded-[12px] bg-bg p-6 sm:p-8">
      <div class="flex items-center justify-between border-b border-line pb-4">
        <div>
          <p class="text-xs font-medium uppercase tracking-wider text-muted">
            Competitor Pain Report
          </p>
          <p class="mt-1 text-lg font-semibold">Acme Project Tool</p>
        </div>
        <span
          class="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent"
        >
          495 posts analyzed
        </span>
      </div>

      <p class="mt-5 text-sm font-semibold">Top pain points</p>
      <div class="mt-3 space-y-3">
        {
          painPoints.map((p) => (
            <div>
              <div class="flex items-center justify-between text-sm">
                <span class="font-medium">{p.label}</span>
                <span class="text-xs text-muted">{p.mentions} mentions</span>
              </div>
              <div class="mt-1.5 h-2 rounded-full bg-line">
                <div
                  class="h-2 rounded-full bg-accent"
                  style={`width: ${p.weight}%`}
                />
              </div>
            </div>
          ))
        }
      </div>

      <div class="mt-6 grid gap-3 sm:grid-cols-2">
        <div class="rounded-lg border border-line bg-surface p-4">
          <p class="text-xs font-semibold uppercase tracking-wide text-accent">
            Positioning angle
          </p>
          <p class="mt-1.5 text-sm text-muted">
            "Set up in 5 minutes" — onboarding is their loudest complaint.
          </p>
        </div>
        <div class="rounded-lg border border-line bg-surface p-4">
          <p class="text-xs font-semibold uppercase tracking-wide text-accent">
            Product opportunity
          </p>
          <p class="mt-1.5 text-sm text-muted">
            Reliable background sync with visible failure states.
          </p>
        </div>
      </div>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Create `packages/landing/src/components/CtaBand.astro`**

```astro
---
import { EmailForm } from "./EmailForm.tsx";
---

<section id="cta" class="px-6 pb-24">
  <div
    class="mx-auto max-w-5xl overflow-hidden rounded-card bg-accent px-8 py-16 text-center"
  >
    <h2
      class="text-balance text-3xl font-bold tracking-tight text-white sm:text-4xl"
    >
      Stop guessing what to build.
    </h2>
    <p class="mx-auto mt-4 max-w-lg text-balance text-accent-soft">
      Join the private beta and get your first Competitor Pain Report free.
    </p>
    <div class="mt-8 flex justify-center">
      <EmailForm client:load variant="band" />
    </div>
  </div>
</section>
```

- [ ] **Step 3: Commit**

```bash
git add packages/landing/src/components/ReportPreview.astro packages/landing/src/components/CtaBand.astro
git commit -m "feat(landing): report preview and cta band sections"
```

---

### Task 11: Assemble the full page and verify

**Files:**
- Modify: `packages/landing/src/pages/index.astro`

- [ ] **Step 1: Replace `packages/landing/src/pages/index.astro` with the full assembly**

```astro
---
import Base from "../layouts/Base.astro";
import Nav from "../components/Nav.astro";
import Hero from "../components/Hero.astro";
import Logos from "../components/Logos.astro";
import Problem from "../components/Problem.astro";
import HowItWorks from "../components/HowItWorks.astro";
import Features from "../components/Features.astro";
import ReportPreview from "../components/ReportPreview.astro";
import CtaBand from "../components/CtaBand.astro";
import Footer from "../components/Footer.astro";
---

<Base>
  <Nav />
  <main>
    <Hero />
    <Logos />
    <Problem />
    <HowItWorks />
    <Features />
    <ReportPreview />
    <CtaBand />
  </main>
  <Footer />
</Base>
```

- [ ] **Step 2: Type-check the package**

Run: `pnpm --filter @rivaleye/landing type-check`
Expected: `astro check` reports 0 errors, 0 warnings.

- [ ] **Step 3: Build the package**

Run: `pnpm --filter @rivaleye/landing build`
Expected: build succeeds; `packages/landing/dist/index.html` produced; build log shows the `EmailForm` client island bundled.

- [ ] **Step 4: Manually verify in the browser**

Run: `pnpm --filter @rivaleye/landing preview`
Open the printed URL. Confirm:
- All nine sections render top to bottom in order.
- Layout is responsive — narrow the window to ~360px, nothing overflows horizontally.
- Scroll-reveal: sections fade/slide in as they enter the viewport.
- Email form (hero): submitting an empty or invalid value shows "Enter a valid email address."; submitting a valid value (e.g. `a@b.com`) swaps to "Thanks — we'll be in touch."
- Email form (CTA band, indigo): same behavior, white-on-indigo styling, thanks message readable.
- Nav anchor links jump to How it works / Features.

- [ ] **Step 5: Commit**

```bash
git add packages/landing/src/pages/index.astro
git commit -m "feat(landing): assemble full landing page"
```

---

### Task 12: Final polish pass

**Files:**
- Modify: any component file as needed

- [ ] **Step 1: Add scroll-reveal to Hero and ReportPreview if missing**

Verify `Hero.astro` heading block and `ReportPreview.astro` card carry the `reveal` class where a fade-in improves the feel. Hero's above-the-fold content may stay un-revealed (it should be visible immediately). Adjust only if a section feels static.

- [ ] **Step 2: Re-run build to confirm no regressions**

Run: `pnpm --filter @rivaleye/landing build`
Expected: build succeeds with 0 errors.

- [ ] **Step 3: Run the workspace-wide type-check to confirm nothing else broke**

Run: `pnpm type-check`
Expected: all packages pass, including `@rivaleye/landing`.

- [ ] **Step 4: Commit (only if step 1 changed files)**

```bash
git add packages/landing/src/components
git commit -m "polish(landing): scroll-reveal tuning"
```

---

## Self-Review

**Spec coverage:**
- Standalone `@rivaleye/landing` package — Task 1. ✓
- Astro 5 + Tailwind v4 + React island — Tasks 1, 2, 6. ✓
- Light SaaS theme, indigo accent, Inter — Task 2. ✓
- Nine sections — Tasks 5, 7, 8, 9, 10 (Nav, Hero, Logos, Problem, HowItWorks, Features, ReportPreview, CtaBand, Footer). ✓
- EmailForm with `variant` prop, validation, thanks state, reused hero + band — Tasks 6, 7, 10. ✓
- File layout matches spec §6 — File Structure section. ✓
- Out-of-scope items (pricing, testimonials, FAQ, login, backend) — none included. ✓
- Success criteria (dev/build run, responsive, type-check, no `@rivaleye/*` imports) — Tasks 11, 12. ✓

**Placeholder scan:** No TBD/TODO. Every code step has complete code. Task 12 step 1 is a conditional verify-and-adjust, not a placeholder — the condition and target are explicit.

**Type consistency:** `EmailForm` props `variant: "hero" | "band"` defined in Task 6, used identically in Tasks 7 and 10. Theme token names (`--color-accent`, `--color-line`, etc.) defined in Task 2, referenced consistently via Tailwind utilities (`bg-accent`, `border-line`) and raw `var()` thereafter.

No gaps found.
