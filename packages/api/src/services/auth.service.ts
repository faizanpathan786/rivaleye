import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, users, workspaces, workspaceMembers } from "@rivaleye/db";

const SALT_ROUNDS = 12;

export async function createUser(email: string, password: string, name: string) {
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) {
    throw new Error("EMAIL_TAKEN");
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const [user] = await db.insert(users).values({ email, passwordHash, name }).returning();
  if (!user) throw new Error("Failed to create user");

  // Auto-create a default workspace for new users
  const [workspace] = await db
    .insert(workspaces)
    .values({ name: `${name}'s Workspace`, ownerId: user.id })
    .returning();
  if (!workspace) throw new Error("Failed to create workspace");

  await db.insert(workspaceMembers).values({
    workspaceId: workspace.id,
    userId: user.id,
    role: "owner",
  });

  return { user, workspace };
}

export async function verifyCredentials(email: string, password: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) throw new Error("INVALID_CREDENTIALS");

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new Error("INVALID_CREDENTIALS");

  return user;
}

export async function getUserWorkspace(userId: string) {
  const [member] = await db
    .select({ workspace: workspaces })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(eq(workspaceMembers.userId, userId))
    .limit(1);

  return member?.workspace ?? null;
}
