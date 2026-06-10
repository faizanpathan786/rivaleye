import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  competitors,
  type Competitor,
  type CompetitorSocials,
  type NewCompetitor,
} from "@/db/schema/competitors";

export type CompetitorPriority = Competitor["priority"];
export type MonitorSensitivity = Competitor["monitor_sensitivity"];

export type CreateCompetitorInput = {
  name: string;
  slug?: string;
  website?: string | null;
  category?: string | null;
  color?: string | null;
  priority?: CompetitorPriority;
  tags?: string[];
  socials?: CompetitorSocials;
  monitor_enabled?: boolean;
  monitor_sensitivity?: MonitorSensitivity;
  monitor_watch?: string[];
  notes?: string | null;
};

export type UpdateCompetitorInput = Partial<CreateCompetitorInput>;

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function listCompetitors(ownerId: string): Promise<Competitor[]> {
  return db
    .select()
    .from(competitors)
    .where(eq(competitors.owner_id, ownerId));
}

export async function getCompetitor(
  id: string,
  ownerId: string,
): Promise<Competitor | null> {
  const rows = await db
    .select()
    .from(competitors)
    .where(and(eq(competitors.id, id), eq(competitors.owner_id, ownerId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createCompetitor(
  ownerId: string,
  input: CreateCompetitorInput,
): Promise<Competitor> {
  const values: NewCompetitor = {
    owner_id: ownerId,
    name: input.name,
    slug: input.slug && input.slug.length > 0 ? input.slug : slugify(input.name),
    website: input.website,
    category: input.category,
    color: input.color,
    priority: input.priority,
    tags: input.tags,
    socials: input.socials,
    monitor_enabled: input.monitor_enabled,
    monitor_sensitivity: input.monitor_sensitivity,
    monitor_watch: input.monitor_watch,
    notes: input.notes,
  };

  const [row] = await db.insert(competitors).values(values).returning();
  if (!row) throw new Error("Failed to insert competitor");
  return row;
}

export async function updateCompetitor(
  id: string,
  ownerId: string,
  patch: UpdateCompetitorInput,
): Promise<Competitor | null> {
  const updates: Partial<NewCompetitor> = {
    ...patch,
    updated_at: new Date(),
  };

  const [row] = await db
    .update(competitors)
    .set(updates)
    .where(and(eq(competitors.id, id), eq(competitors.owner_id, ownerId)))
    .returning();
  return row ?? null;
}

export async function deleteCompetitor(
  id: string,
  ownerId: string,
): Promise<boolean> {
  const rows = await db
    .delete(competitors)
    .where(and(eq(competitors.id, id), eq(competitors.owner_id, ownerId)))
    .returning({ id: competitors.id });
  return rows.length > 0;
}
