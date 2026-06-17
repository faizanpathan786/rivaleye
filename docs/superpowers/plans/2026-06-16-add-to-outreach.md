# Add to Outreach Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users save Growth-lens pricing leads to a per-user "Outreach" list they can view, open the source for, and remove.

**Architecture:** New Drizzle table `outreach_items` storing a snapshot of each saved lead; an Elysia `outreach/` controller + service (owner-scoped, dedup via unique constraint); TanStack Query hooks + a new Outreach page; the existing "Add to outreach" button in the Growth lens wired to the add mutation.

**Tech Stack:** Bun, Elysia, Drizzle (Supabase Postgres), better-auth, Vite + React + TanStack Query, Tailwind/shadcn.

**Verification note:** This repo has no API integration-test harness (documented TODO). Verification uses `pnpm type-check`, targeted DB inspection scripts, and manual UI checks — consistent with the repo's actual workflow. Do NOT commit anything; the repo owner commits manually.

---

### Task 1: Drizzle schema — `outreach_items` table

**Files:**
- Create: `packages/api/src/db/schema/outreach.ts`
- Modify: `packages/api/src/db/schema/index.ts`

- [ ] **Step 1: Create the schema file**

`packages/api/src/db/schema/outreach.ts`:
```ts
import {
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { reports } from "./reports";

export const outreach_items = pgTable(
  "outreach_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    owner_id: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    report_id: uuid("report_id")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    pricing_issue: text("pricing_issue"),
    plan_limitation: text("plan_limitation"),
    team_size_hint: text("team_size_hint"),
    budget_sensitivity: text("budget_sensitivity"),
    alternative_interest: text("alternative_interest"),
    suggested_pricing_angle: text("suggested_pricing_angle"),
    source_url: text("source_url"),
    created_at: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    unique("outreach_items_owner_report_title_uniq").on(
      t.owner_id,
      t.report_id,
      t.title,
    ),
    index("outreach_items_owner_id_idx").on(t.owner_id),
  ],
);

export type OutreachItem = typeof outreach_items.$inferSelect;
export type NewOutreachItem = typeof outreach_items.$inferInsert;
```

- [ ] **Step 2: Export from schema index**

In `packages/api/src/db/schema/index.ts`, add after the `report-role-sections` export line:
```ts
export * from "./outreach";
```

- [ ] **Step 3: Verify it type-checks**

Run: `pnpm --filter @rivaleye/api type-check`
Expected: PASS (no errors).

---

### Task 2: Migration (CAREFUL — destructive-bundling risk)

**Files:**
- Create: `packages/api/drizzle/<generated>.sql` (hand-trimmed)

- [ ] **Step 1: Generate the migration**

Run: `pnpm db:generate`
Then OPEN the newly generated SQL file in `packages/api/drizzle/`.

- [ ] **Step 2: Hand-trim to ONLY the new table**

The repo is known to bundle an unrelated **destructive** `report_platform_jobs`
migration. DELETE every statement except the ones that create the new table:
```sql
CREATE TABLE "outreach_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"report_id" uuid NOT NULL,
	"title" text NOT NULL,
	"pricing_issue" text,
	"plan_limitation" text,
	"team_size_hint" text,
	"budget_sensitivity" text,
	"alternative_interest" text,
	"suggested_pricing_angle" text,
	"source_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "outreach_items" ADD CONSTRAINT "outreach_items_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "outreach_items" ADD CONSTRAINT "outreach_items_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "outreach_items" ADD CONSTRAINT "outreach_items_owner_report_title_uniq" UNIQUE("owner_id","report_id","title");
--> statement-breakpoint
CREATE INDEX "outreach_items_owner_id_idx" ON "outreach_items" USING btree ("owner_id");
```
(Match exact identifiers/types to what Drizzle generated; only the new-table
statements remain. Verify against the generated file — drop any line touching
`report_platform_jobs` or any other existing table.)

- [ ] **Step 3: STOP — ask the repo owner before applying**

Do NOT run `pnpm db:migrate`. This is a destructive operation against the live
Supabase DB. Present the trimmed SQL to the owner and get explicit YES before
applying. Owner runs (or approves running): `pnpm db:migrate`.

---

### Task 3: Permission codes

**Files:**
- Modify: `packages/api/src/types/permissions.ts`

- [ ] **Step 1: Add codes**

In the `PERMISSIONS` object, add:
```ts
  OUTREACH_VIEW: "OUTREACH_VIEW",
  OUTREACH_MANAGE: "OUTREACH_MANAGE",
```

- [ ] **Step 2: Verify**

Run: `pnpm --filter @rivaleye/api type-check`
Expected: PASS.

---

### Task 4: Outreach service

**Files:**
- Create: `packages/api/src/services/outreach.service.ts`

- [ ] **Step 1: Write the service**

`packages/api/src/services/outreach.service.ts`:
```ts
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { outreach_items, type OutreachItem } from "@/db/schema/outreach";

export type AddOutreachInput = {
  report_id: string;
  title: string;
  pricing_issue?: string | null;
  plan_limitation?: string | null;
  team_size_hint?: string | null;
  budget_sensitivity?: string | null;
  alternative_interest?: string | null;
  suggested_pricing_angle?: string | null;
  source_url?: string | null;
};

export async function listOutreach(owner_id: string): Promise<OutreachItem[]> {
  return db
    .select()
    .from(outreach_items)
    .where(eq(outreach_items.owner_id, owner_id))
    .orderBy(desc(outreach_items.created_at));
}

export async function addOutreach(
  owner_id: string,
  input: AddOutreachInput,
): Promise<OutreachItem> {
  const [row] = await db
    .insert(outreach_items)
    .values({
      owner_id,
      report_id: input.report_id,
      title: input.title,
      pricing_issue: input.pricing_issue ?? null,
      plan_limitation: input.plan_limitation ?? null,
      team_size_hint: input.team_size_hint ?? null,
      budget_sensitivity: input.budget_sensitivity ?? null,
      alternative_interest: input.alternative_interest ?? null,
      suggested_pricing_angle: input.suggested_pricing_angle ?? null,
      source_url: input.source_url ?? null,
    })
    .onConflictDoNothing()
    .returning();

  // onConflictDoNothing returns [] when the row already exists; fetch it so the
  // add is idempotent and always returns the saved item.
  if (row) return row;
  const [existing] = await db
    .select()
    .from(outreach_items)
    .where(
      and(
        eq(outreach_items.owner_id, owner_id),
        eq(outreach_items.report_id, input.report_id),
        eq(outreach_items.title, input.title),
      ),
    )
    .limit(1);
  return existing!;
}

export async function removeOutreach(
  id: string,
  owner_id: string,
): Promise<boolean> {
  const deleted = await db
    .delete(outreach_items)
    .where(and(eq(outreach_items.id, id), eq(outreach_items.owner_id, owner_id)))
    .returning({ id: outreach_items.id });
  return deleted.length > 0;
}
```

- [ ] **Step 2: Verify**

Run: `pnpm --filter @rivaleye/api type-check`
Expected: PASS.

---

### Task 5: Outreach controller (3 handlers + index) and mount

**Files:**
- Create: `packages/api/src/controllers/outreach/index.ts`
- Create: `packages/api/src/controllers/outreach/handlers/listOutreach.ts`
- Create: `packages/api/src/controllers/outreach/handlers/addOutreach.ts`
- Create: `packages/api/src/controllers/outreach/handlers/deleteOutreach.ts`
- Modify: `packages/api/src/controllers/index.ts`
- Modify: `packages/api/src/types/swagger.ts`

- [ ] **Step 1: Add swagger tag**

In `packages/api/src/types/swagger.ts`, add to the `Tags` enum:
```ts
  OUTREACH = "Outreach",
```

- [ ] **Step 2: listOutreach handler**

`packages/api/src/controllers/outreach/handlers/listOutreach.ts`:
```ts
import { Elysia } from "elysia";
import { loggerPlugin } from "@/config/logger";
import { authPlugin } from "@/plugins/auth";
import { listOutreach } from "@/services/outreach.service";
import { okList } from "@/utils/response";
import { Tags } from "@/types/swagger";

export const listOutreachHandler = new Elysia()
  .use(loggerPlugin)
  .use(authPlugin)
  .get(
    "/",
    async ({ log, user, status }) => {
      try {
        const rows = await listOutreach(user!.id);
        return okList(rows);
      } catch (e) {
        log.error(e);
        return status(400, {
          message: "Failed to list outreach items",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    },
    {
      auth: {},
      detail: { tags: [Tags.OUTREACH], summary: "List saved outreach items" },
    },
  );
```

- [ ] **Step 3: addOutreach handler**

`packages/api/src/controllers/outreach/handlers/addOutreach.ts`:
```ts
import { Elysia, t } from "elysia";
import { loggerPlugin } from "@/config/logger";
import { authPlugin } from "@/plugins/auth";
import { addOutreach } from "@/services/outreach.service";
import { ok } from "@/utils/response";
import { Tags } from "@/types/swagger";

const nullableString = t.Optional(t.Union([t.String(), t.Null()]));

export const addOutreachBodySchema = t.Object({
  report_id: t.String({ format: "uuid" }),
  title: t.String({ minLength: 1 }),
  pricing_issue: nullableString,
  plan_limitation: nullableString,
  team_size_hint: nullableString,
  budget_sensitivity: nullableString,
  alternative_interest: nullableString,
  suggested_pricing_angle: nullableString,
  source_url: nullableString,
});

export const addOutreachHandler = new Elysia()
  .use(loggerPlugin)
  .use(authPlugin)
  .post(
    "/",
    async ({ log, user, body, status }) => {
      try {
        const row = await addOutreach(user!.id, body);
        return ok(row);
      } catch (e) {
        log.error(e);
        return status(400, {
          message: "Failed to add outreach item",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    },
    {
      auth: {},
      body: addOutreachBodySchema,
      detail: { tags: [Tags.OUTREACH], summary: "Save a lead to outreach" },
    },
  );
```

- [ ] **Step 4: deleteOutreach handler**

`packages/api/src/controllers/outreach/handlers/deleteOutreach.ts`:
```ts
import { Elysia, t } from "elysia";
import { loggerPlugin } from "@/config/logger";
import { authPlugin } from "@/plugins/auth";
import { removeOutreach } from "@/services/outreach.service";
import { ok } from "@/utils/response";
import { Tags } from "@/types/swagger";

export const deleteOutreachHandler = new Elysia()
  .use(loggerPlugin)
  .use(authPlugin)
  .delete(
    "/:id",
    async ({ log, user, params, status }) => {
      try {
        const success = await removeOutreach(params.id, user!.id);
        if (!success)
          return status(404, {
            message: "Outreach item not found",
            error: "OUTREACH_NOT_FOUND",
          });
        return ok({ success: true });
      } catch (e) {
        log.error(e);
        return status(400, {
          message: "Failed to delete outreach item",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    },
    {
      auth: {},
      params: t.Object({ id: t.String({ format: "uuid" }) }),
      detail: { tags: [Tags.OUTREACH], summary: "Remove a saved outreach item" },
    },
  );
```

- [ ] **Step 5: controller index**

`packages/api/src/controllers/outreach/index.ts`:
```ts
import { Elysia } from "elysia";
import { listOutreachHandler } from "./handlers/listOutreach";
import { addOutreachHandler } from "./handlers/addOutreach";
import { deleteOutreachHandler } from "./handlers/deleteOutreach";

export const outreachController = new Elysia({
  prefix: "/outreach",
  tags: ["outreach"],
})
  .use(listOutreachHandler)
  .use(addOutreachHandler)
  .use(deleteOutreachHandler);
```

- [ ] **Step 6: Mount in controllers/index.ts**

In `packages/api/src/controllers/index.ts`: add the import
```ts
import { outreachController } from "./outreach";
```
and add `.use(outreachController)` to the chain.

- [ ] **Step 7: Verify**

Run: `pnpm --filter @rivaleye/api type-check`
Expected: PASS.

---

### Task 6: Frontend API client + endpoints

**Files:**
- Create: `packages/web/src/api/outreach.ts`
- Modify: `packages/web/src/lib/axios.ts`

- [ ] **Step 1: Add endpoints**

In `packages/web/src/lib/axios.ts`, inside the `endpoints` object add:
```ts
  outreach: {
    list: "/v1/outreach",
    add: "/v1/outreach",
    remove: (id: string) => `/v1/outreach/${id}`,
  },
```

- [ ] **Step 2: API client**

`packages/web/src/api/outreach.ts`:
```ts
import axios, { endpoints } from "@/lib/axios";
import { unwrap, unwrapList } from "./_envelope";
import type { ApiList, ApiSuccess } from "./_envelope";

export type OutreachItem = {
  id: string;
  owner_id: string;
  report_id: string;
  title: string;
  pricing_issue: string | null;
  plan_limitation: string | null;
  team_size_hint: string | null;
  budget_sensitivity: string | null;
  alternative_interest: string | null;
  suggested_pricing_angle: string | null;
  source_url: string | null;
  created_at: string;
};

export type AddOutreachPayload = {
  report_id: string;
  title: string;
  pricing_issue?: string | null;
  plan_limitation?: string | null;
  team_size_hint?: string | null;
  budget_sensitivity?: string | null;
  alternative_interest?: string | null;
  suggested_pricing_angle?: string | null;
  source_url?: string | null;
};

export async function listOutreach(): Promise<OutreachItem[]> {
  const res = await axios.get<ApiList<OutreachItem>>(endpoints.outreach.list);
  return unwrapList(res).items;
}

export async function addOutreach(
  payload: AddOutreachPayload,
): Promise<OutreachItem> {
  const res = await axios.post<ApiSuccess<OutreachItem>>(
    endpoints.outreach.add,
    payload,
  );
  return unwrap(res);
}

export async function removeOutreach(id: string): Promise<void> {
  await axios.delete(endpoints.outreach.remove(id));
}
```

- [ ] **Step 3: Verify**

Run: `pnpm --filter @rivaleye/web type-check`
Expected: PASS. (Confirm `unwrapList(res).items` matches the `_envelope` API used
by `api/competitors.ts`; if `unwrapList` returns a different shape there, mirror
that exact usage.)

---

### Task 7: TanStack Query hooks

**Files:**
- Create: `packages/web/src/hooks/queries/use-outreach.ts`

- [ ] **Step 1: Write hooks**

`packages/web/src/hooks/queries/use-outreach.ts`:
```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addOutreach,
  listOutreach,
  removeOutreach,
} from "@/api/outreach";
import type { AddOutreachPayload, OutreachItem } from "@/api/outreach";

export const outreachKeys = {
  all: ["outreach"] as const,
  list: () => [...outreachKeys.all, "list"] as const,
};

export function useOutreachQuery() {
  return useQuery<OutreachItem[]>({
    queryKey: outreachKeys.list(),
    queryFn: listOutreach,
  });
}

export function useAddOutreach() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: AddOutreachPayload) => addOutreach(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: outreachKeys.list() }),
  });
}

export function useRemoveOutreach() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => removeOutreach(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: outreachKeys.list() }),
  });
}
```

- [ ] **Step 2: Verify**

Run: `pnpm --filter @rivaleye/web type-check`
Expected: PASS.

---

### Task 8: Outreach page + route + nav

**Files:**
- Create: `packages/web/src/routes/outreach.tsx`
- Modify: `packages/web/src/app.tsx`
- Modify: `packages/web/src/components/layout/app-shell.tsx`

- [ ] **Step 1: Outreach page**

`packages/web/src/routes/outreach.tsx`:
```tsx
import { Skeleton } from "@/components/ui/skeleton";
import { Icon } from "@/components/icons";
import { useOutreachQuery, useRemoveOutreach } from "@/hooks/queries/use-outreach";

export function OutreachPage() {
  const { data, isLoading, error } = useOutreachQuery();
  const remove = useRemoveOutreach();

  return (
    <div className="px-4 py-8 md:px-7 md:py-10" style={{ maxWidth: 900, margin: "0 auto" }}>
      <h1 className="text-2xl font-semibold tracking-tight">Outreach</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Pricing leads you've saved to act on.
      </p>

      <div className="mt-6 space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))
        ) : error ? (
          <p className="text-sm text-destructive">Failed to load outreach items.</p>
        ) : !data?.length ? (
          <div className="rounded-lg border border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No saved leads yet. Use “Add to outreach” on a pricing lead in the
              Growth lens.
            </p>
          </div>
        ) : (
          data.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-border bg-card p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-medium">{item.title}</h3>
                  {item.pricing_issue && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {item.pricing_issue}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  className="re-btn re-btn-ghost re-btn-sm shrink-0"
                  onClick={() => remove.mutate(item.id)}
                  disabled={remove.isPending}
                >
                  <Icon name="trash" size={12} /> Remove
                </button>
              </div>

              {item.suggested_pricing_angle && (
                <p className="mt-3 text-sm">{item.suggested_pricing_angle}</p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {item.team_size_hint && <span>Team: {item.team_size_hint}</span>}
                {item.budget_sensitivity && (
                  <span>Budget: {item.budget_sensitivity}</span>
                )}
                {item.source_url && (
                  <a
                    href={item.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="underline hover:text-foreground"
                  >
                    Open source
                  </a>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```
NOTE: confirm an icon named `"trash"` exists in `@/components/icons`; if not, use
an existing one (e.g. `"x"` or `"close"`). Grep the icon registry first.

- [ ] **Step 2: Register route**

In `packages/web/src/app.tsx`: add import
```ts
import { OutreachPage } from "./routes/outreach";
```
and add a route in the children array (near `competitors`):
```ts
      { path: "outreach", Component: OutreachPage },
```

- [ ] **Step 3: Add sidebar nav item**

In `packages/web/src/components/layout/app-shell.tsx`, add to the `NAV` array
(after the Competitors entry):
```ts
  { to: "/outreach",    icon: "spark",   label: "Outreach" },
```
(Use an existing icon name; confirm against the `Icon` registry. Optionally add
`"/outreach": ["RivalEye", "Outreach"]` to `CRUMB_MAP`.)

- [ ] **Step 4: Verify**

Run: `pnpm --filter @rivaleye/web type-check`
Expected: PASS.

---

### Task 9: Wire the "Add to outreach" button in the Growth lens

**Files:**
- Modify: `packages/web/src/routes/growth.tsx`
- Modify: `packages/web/src/routes/scan-report.tsx`

- [ ] **Step 1: Thread `reportId` into GrowthPage**

In `packages/web/src/routes/growth.tsx`, add `reportId?: string` to the
`GrowthPage` props (signature near line 623) exactly like founder/product:
```ts
export function GrowthPage({
  embedded = false,
  data,
  evidenceSection,
  range: propRange,
  reportId,
}: {
  embedded?: boolean;
  data?: GrowthViewProps;
  evidenceSection?: EvidenceSection | null;
  range?: string;
  reportId?: string;
}) {
```

- [ ] **Step 2: Create add handler in GrowthPage body**

Near where `openEvidence`/`closeEvidence` are defined, add:
```ts
  const addOutreach = useAddOutreach();
  const onAddToOutreach = reportId
    ? (l: PricingLeadProps) =>
        addOutreach.mutate({
          report_id: reportId,
          title: l.title,
          pricing_issue: l.pricingIssue,
          plan_limitation: l.planLimitation,
          team_size_hint: l.teamSizeHint,
          budget_sensitivity: l.budgetSensitivity,
          alternative_interest: l.alternativeInterest,
          suggested_pricing_angle: l.suggestedPricingAngle,
          source_url: l.sourceUrl,
        })
    : undefined;
```
Add the import at the top of the file:
```ts
import { useAddOutreach } from "@/hooks/queries/use-outreach";
```
(`PricingLeadProps` is already imported from the growth adapter.)

- [ ] **Step 3: Pass handler to PricingLeadCard**

Update the map (near line 742):
```tsx
          {G.pricingLeads.map((l, i) => (
            <PricingLeadCard key={i} l={l} openEvidence={openEvidence} onAddToOutreach={onAddToOutreach} />
          ))}
```

- [ ] **Step 4: Accept + wire the prop in PricingLeadCard**

Find the `PricingLeadCard` component signature and add the prop. Change the
signature to include `onAddToOutreach`:
```tsx
function PricingLeadCard({
  l,
  openEvidence,
  onAddToOutreach,
}: {
  l: PricingLeadProps;
  openEvidence: (refs: EvidenceRef) => void;
  onAddToOutreach?: (l: PricingLeadProps) => void;
}) {
```
(Match the existing prop-typing style of the component; if it uses an interface,
add `onAddToOutreach?` there instead.)

Then replace the dead button (the `<button type="button" className="re-btn re-btn-sm">…Add to outreach</button>`) with:
```tsx
          {onAddToOutreach && (
            <button
              type="button"
              className="re-btn re-btn-sm"
              onClick={() => onAddToOutreach(l)}
            >
              <Icon name="arrow-right" size={12} /> Add to outreach
            </button>
          )}
```

- [ ] **Step 5: Pass `reportId` from scan-report**

In `packages/web/src/routes/scan-report.tsx`, update the GrowthPage render to
pass `reportId={id}` (mirroring founder/product):
```tsx
        return <GrowthPage embedded data={growthProps} evidenceSection={evidenceSection} range={range} reportId={id} />;
```

- [ ] **Step 6: Verify**

Run: `pnpm type-check`
Expected: PASS (5/5 packages).

---

### Task 10: End-to-end verification (manual)

- [ ] **Step 1:** Ensure the migration was applied (Task 2, owner-approved).
- [ ] **Step 2:** Restart dev (`pnpm dev`), confirm `curl -s localhost:4000/health` → `{"ok":true,...}`.
- [ ] **Step 3:** In the browser, open a completed report → Growth lens → click "Add to outreach" on a pricing lead. No error.
- [ ] **Step 4:** Open the **Outreach** sidebar page → the saved lead appears with its angle + "Open source".
- [ ] **Step 5:** Click "Add to outreach" again on the same lead → still only one item on the Outreach page (dedup works).
- [ ] **Step 6:** Click "Remove" → item disappears.
- [ ] **Step 7 (optional DB check):** a temporary script selecting `outreach_items` for the user confirms rows insert/delete as expected.

---

## Notes for the implementer
- **Do not commit.** The repo owner commits manually.
- **Do not run `pnpm db:migrate` without explicit owner approval** (Task 2 Step 3).
- Follow the existing envelope helpers (`unwrap`/`unwrapList`) exactly as
  `api/competitors.ts` uses them — verify the `.items` shape before relying on it.
- Confirm icon names (`trash`, `arrow-right`, `spark`) exist in the `Icon`
  registry; substitute an existing icon if not.
