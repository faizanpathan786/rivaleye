import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { planned_actions, type PlannedAction, type InsertPlannedAction } from "@/db/schema";

export async function addPlannedAction(
  owner_id: string,
  input: {
    report_id: string;
    title: string;
    description?: string;
    role?: string;
    effort?: string;
  },
): Promise<PlannedAction> {
  const [result] = await db
    .insert(planned_actions)
    .values({
      owner_id,
      report_id: input.report_id,
      title: input.title,
      description: input.description ?? null,
      role: input.role ?? null,
      effort: input.effort ?? null,
    })
    .returning();
  return result!;
}

export async function listPlannedActions(owner_id: string): Promise<PlannedAction[]> {
  return db
    .select()
    .from(planned_actions)
    .where(eq(planned_actions.owner_id, owner_id))
    .orderBy(planned_actions.created_at);
}

export async function removePlannedAction(
  id: string,
  owner_id: string,
): Promise<boolean> {
  const existing = await db
    .select()
    .from(planned_actions)
    .where(and(eq(planned_actions.id, id), eq(planned_actions.owner_id, owner_id)))
    .limit(1);

  if (existing.length === 0) {
    return false;
  }

  await db
    .delete(planned_actions)
    .where(and(eq(planned_actions.id, id), eq(planned_actions.owner_id, owner_id)));

  return true;
}
