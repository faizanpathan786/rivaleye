# @rivaleye/web — Frontend Guide for Agents

The RivalEye web client. Lives at `packages/web/`. Consumes `@rivaleye/api`. Custom UI — **not** the Minimals template.

Read the root `CLAUDE.md` first. This file extends it with frontend-specific rules.

---

## 1. Stack

- **Build**: [Vite](https://vitejs.dev/) 6 + React 18 + TypeScript (strict).
- **Routing**: [react-router-dom v6](https://reactrouter.com/) (data routers).
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) + CSS variables for theme tokens (light + dark).
- **Components**: [shadcn/ui](https://ui.shadcn.com/) on top of Radix primitives. Components are **copied into** `src/components/ui/` via the shadcn CLI, then owned by us.
- **State / data**: [TanStack Query](https://tanstack.com/query) for server state. Local UI state stays in components or `useReducer`. No Redux.
- **Forms**: react-hook-form + zod (zod schemas come from `@rivaleye/shared` where shared with backend).
- **Icons**: `lucide-react`.
- **No MUI. No Minimals. No Next.js.**

---

## 2. Folder structure

```
packages/web/
  src/
    main.tsx              ← Vite entry. Mounts <App />.
    app.tsx               ← Top-level App component (router + providers).
    routes/               ← One file per route (or a folder with nested routes).
    components/
      ui/                 ← shadcn-generated primitives (button, dialog, ...).
      <feature>/          ← Feature-specific components.
    hooks/                ← React hooks (data hooks live under hooks/queries/).
      queries/            ← TanStack Query hooks: use-<domain>.ts
    lib/
      utils.ts            ← cn() and small utilities.
      api.ts              ← API client (typed from @rivaleye/api when stable).
      auth.ts             ← better-auth client config.
    styles/
      globals.css         ← Tailwind layers + CSS vars.
  index.html
  vite.config.ts
  tailwind.config.ts
  postcss.config.js
  components.json         ← shadcn CLI config
  tsconfig.json
  package.json
```

---

## 3. Adding shadcn components

```sh
pnpm --filter @rivaleye/web dlx shadcn@latest add button card dialog
```

- Components land in `src/components/ui/`.
- After generation, they are **ours** — edit freely, but keep API close to the upstream so future `shadcn add` doesn't surprise.
- Never reach into `node_modules` for Radix directly when a shadcn wrapper exists.

---

## 4. Routing

Use `react-router-dom` data routers (`createBrowserRouter`). Routes live in `src/routes/`. Each route file exports a `loader`, `action`, and `Component` where applicable.

```ts
// src/routes/reports.tsx
export const reportsRoute = {
  path: "/reports",
  Component: ReportsPage,
};
```

Wire routes in `src/app.tsx`.

---

## 5. Data fetching

- Server state goes through TanStack Query. Define hooks in `src/hooks/queries/use-<domain>.ts`.
- Never call `fetch` directly from a component. Always go through a hook.
- API client: `src/lib/api.ts`. Type it from the Elysia app type when stable (`import type { App } from "@rivaleye/api"`).

```ts
// src/hooks/queries/use-reports.ts
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useReports() {
  return useQuery({
    queryKey: ["reports"],
    queryFn: () => api.v1.reports.get(),
  });
}
```

---

## 6. Loading & empty states

- Every `useQuery` boundary must render a skeleton during `isLoading`. No blank gaps.
- Every list must handle `data.length === 0` with an empty state.
- Errors render a typed error message + retry, not a silent fail.

---

## 7. Forms & inputs

- Use react-hook-form for every form. Never uncontrolled `<input>` for anything beyond a one-off filter.
- Validation via zod schemas — share with backend through `@rivaleye/shared` when the shape is bilateral.
- Never use native `<select>`, `type="datetime-local"`, etc. — wrap shadcn primitives.
- Confirmations: shadcn `<AlertDialog>`. Never `window.confirm`.

---

## 8. Theming

- All colors come from CSS variables in `src/styles/globals.css` (Tailwind reads them via `tailwind.config.ts`).
- Light and dark mode toggle via the `dark` class on `<html>`. Default is dark for the MVP.
- Never use hex / `rgb()` literals in component code. Always Tailwind tokens (`bg-background`, `text-muted-foreground`, etc.). Grep for `#` / `rgb(` before claiming a feature done.

---

## 9. Coding conventions

- TS strict. No `any`.
- Named exports. Functional components only.
- File naming: kebab-case for files (`pain-report-card.tsx`), PascalCase for component names inside.
- Co-locate styles via Tailwind classes. No CSS modules, no styled-components.
- Comments only when the *why* is non-obvious.

---

## 10. Dev commands

```sh
pnpm --filter @rivaleye/web dev          # Vite on :5173
pnpm --filter @rivaleye/web build        # type-check + vite build
pnpm --filter @rivaleye/web type-check
```

---

## 11. Hard rules for agents

1. **Never reintroduce MUI, Minimals, or Next.js.** Stack is locked: Vite + React + Tailwind + shadcn.
2. **All colors via CSS variables / Tailwind tokens.** No raw hex/rgb in components.
3. **All forms go through react-hook-form + zod.** No raw native inputs.
4. **All server state goes through TanStack Query hooks** under `src/hooks/queries/`.
5. **Every query has loading + empty + error states.** Skeletons during loading. No blank gaps.
6. **Confirmations via shadcn `AlertDialog`** — never `window.confirm` / `window.alert`.
7. **shadcn components are owned by us** once generated. No upstream auto-update.
8. **Auth flows through better-auth's client** in `src/lib/auth.ts`. Never roll a parallel session store.
9. **Lint before push.** `pnpm --filter @rivaleye/web lint` must pass.

---

## 12. Open questions / TODO

- [ ] Pick a state/store solution if anything beyond TanStack Query is needed (probably Zustand for small global UI state).
- [ ] Wire `better-auth` client + protected routes.
- [ ] Build the first real screen: Report Wizard (category → competitors → goal → generate).
- [ ] Build the Pain Report view (sections from PRD §10).
- [ ] Decide on charting lib if/when charts are needed. Default off — PRD says insights first, charts second.

Update this section as decisions land.
