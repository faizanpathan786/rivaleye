# Add to Outreach — Saved Leads List

**Date:** 2026-06-16
**Status:** Approved design, pending implementation

## Summary

Wire up the currently-dead "Add to outreach" button on the Growth lens's
pricing-lead cards. Clicking it saves a snapshot of that pricing lead to a
per-user **Outreach** list, viewable on a dedicated page where the user can open
the source link or remove the item. No status tracking (no "contacted/responded"
states) — a saved/bookmarked list only.

## Scope

- **In scope:** pricing-lead cards in the Growth lens only.
- **Out of scope (for now):** feed items, priority conversations, other lenses,
  status workflow, export/CSV. These can be added later without reworking the
  data model.

## Decisions (from brainstorming)

1. **Saved list, no status tracking** — dedicated Outreach page; add + remove +
   open source.
2. **Pricing leads only** — wire the one existing button.
3. **Snapshot, not reference** — store a copy of the lead's text at save time, so
   it survives re-scans/re-synthesis (which change or remove leads). Dedup by
   `(owner_id, report_id, title)`.

## Architecture

### 1. Database — new Drizzle table `outreach_items`

| column | type | notes |
|---|---|---|
| `id` | uuid PK (defaultRandom) | |
| `owner_id` | uuid → users | who saved it |
| `report_id` | uuid → reports (onDelete cascade) | context + dedup |
| `title` | text not null | lead title |
| `pricing_issue` | text | snapshot |
| `plan_limitation` | text null | snapshot |
| `team_size_hint` | text null | snapshot |
| `budget_sensitivity` | text null | snapshot |
| `alternative_interest` | text null | snapshot |
| `suggested_pricing_angle` | text null | snapshot |
| `source_url` | text null | snapshot |
| `created_at` | timestamp not null default now | |

- Unique constraint `outreach_items_owner_report_title_uniq` on
  `(owner_id, report_id, title)` for dedup.
- Index on `owner_id` for list queries.

**Migration safety:** This repo's `pnpm db:generate` is known to bundle an
unrelated destructive `report_platform_jobs` migration. The generated SQL MUST be
hand-trimmed to only `CREATE TABLE outreach_items` (+ its constraint/index).
`db:migrate` is a destructive operation against the live Supabase DB and MUST NOT
be run without explicit user confirmation.

### 2. API — `outreach/` controller + service

Mirrors the `competitors/` domain pattern.

```
controllers/outreach/
  index.ts                 ← Elysia sub-app, prefix "/outreach", mounted under /v1
  handlers/
    listOutreach.ts        ← GET    /v1/outreach        → user's saved items, newest first
    addOutreach.ts         ← POST   /v1/outreach        → insert (onConflictDoNothing dedup)
    deleteOutreach.ts      ← DELETE /v1/outreach/:id     → ownership-checked delete
services/outreach.service.ts → listOutreach / addOutreach / removeOutreach (all owner-scoped)
types/permissions.ts         → add OUTREACH_VIEW, OUTREACH_MANAGE
```

- `addOutreach` body validated with `t.Object`: `report_id` + snapshot fields.
  Insert is idempotent via the unique constraint + `onConflictDoNothing`.
- `deleteOutreach` returns 404 when the row is missing or not owned by the user.
- All handlers use `authPlugin` and declare `auth: { permissions: [...] }` per
  convention. (Note: the auth plugin does not yet enforce the permission
  allow-list; ownership via `owner_id` is the real access control today.)

### 3. Frontend

```
api/outreach.ts                 ← typed client (get/add/remove) + envelope unwrap
hooks/queries/use-outreach.ts   ← useOutreachQuery, useAddOutreach, useRemoveOutreach
routes/outreach.tsx             ← Outreach page: saved cards w/ "Open source" + "Remove"
app.tsx                         ← register /outreach route
components/layout/app-shell.tsx ← add "Outreach" sidebar nav item
routes/growth.tsx               ← thread reportId in; wire button → useAddOutreach;
                                  show "Saved ✓" + disable when already saved
```

### 4. Data flow

Click "Add to outreach" → `useAddOutreach` mutation → `POST /v1/outreach` →
service insert (dedup) → invalidate `["outreach"]` query. Outreach page →
`useOutreachQuery` → renders cards with remove + open-source actions.

### 5. Error handling & states

- Adding the same lead twice is a safe no-op (unique constraint +
  `onConflictDoNothing`); the button reflects "Saved ✓".
- Delete enforces ownership (404 otherwise).
- Outreach page: skeleton while loading, empty state ("No saved leads yet"),
  typed error + retry.

### 6. Testing / verification

- `pnpm type-check` across the workspace.
- Manual: save a lead → appears on Outreach page → remove → gone; re-add the same
  lead → no duplicate.

## Units & boundaries

- **`outreach.service.ts`** — owns all DB access + dedup/ownership logic. Pure
  data in/out; no HTTP concerns.
- **`outreach/` controller** — validates input, shapes responses; calls the
  service.
- **`use-outreach.ts`** — the only place the web app talks to the outreach API;
  components never call fetch directly.
- **`outreach.tsx`** — presentation of the saved list; depends only on the hook.
- **growth.tsx button** — depends only on `useAddOutreach` + the lead data it
  already has.
