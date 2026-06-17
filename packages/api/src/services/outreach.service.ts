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
