import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users, type User } from "@/db/schema/users";

export type MeProfile = Pick<
  User,
  "id" | "email" | "name" | "image" | "email_verified" | "created_at"
>;

export type UpdateMeInput = {
  name?: string | null;
  image?: string | null;
};

function toProfile(row: User): MeProfile {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    image: row.image,
    email_verified: row.email_verified,
    created_at: row.created_at,
  };
}

export async function getMe(userId: string): Promise<MeProfile | null> {
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const row = rows[0];
  return row ? toProfile(row) : null;
}

export async function updateMe(
  userId: string,
  patch: UpdateMeInput,
): Promise<MeProfile | null> {
  const [row] = await db
    .update(users)
    .set({ ...patch, updated_at: new Date() })
    .where(eq(users.id, userId))
    .returning();
  return row ? toProfile(row) : null;
}
