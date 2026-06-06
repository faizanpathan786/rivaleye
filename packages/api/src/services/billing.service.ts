import { createHmac } from "node:crypto";
import { db } from "@/db/client";
import { credit_packs, user_credits, credit_transactions } from "@/db/schema/billing";
import { and, eq, desc, or, isNotNull } from "drizzle-orm";

const PACK_SEEDS = [
  { name: "Starter", credits: 10, price_paise: 99900 },
  { name: "Growth",  credits: 25, price_paise: 199900 },
  { name: "Scale",   credits: 100, price_paise: 499900 },
] as const;

function getRazorpayKeys() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
if (!keyId || !keySecret) throw new Error("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required");
  return { keyId, keySecret };
}

async function ensurePacksSeeded() {
  const existing = await db.select({ id: credit_packs.id }).from(credit_packs).limit(1);
  if (existing.length > 0) return;
  await db.insert(credit_packs).values(PACK_SEEDS.map((p) => ({ ...p, active: true })));
}

export async function getActivePacks() {
  await ensurePacksSeeded();
  return db.select().from(credit_packs).where(eq(credit_packs.active, true));
}

export async function getBalance(userId: string) {
  const rows = await db.select().from(user_credits).where(eq(user_credits.user_id, userId)).limit(1);
  if (rows.length === 0) return { balance: 0, free_scan_used: false };
  const row = rows[0]!;
  return { balance: row.balance, free_scan_used: row.free_scan_used };
}

export async function getTransactions(userId: string) {
  return db
    .select()
    .from(credit_transactions)
    .where(
      and(
        eq(credit_transactions.user_id, userId),
        or(
          eq(credit_transactions.type, "debit"),
          isNotNull(credit_transactions.razorpay_payment_id),
        ),
      ),
    )
    .orderBy(desc(credit_transactions.created_at))
    .limit(50);
}

export async function createOrder(userId: string, packId: string) {
  const { keyId, keySecret } = getRazorpayKeys();

  const pack = await db.select().from(credit_packs).where(eq(credit_packs.id, packId)).limit(1);
  if (!pack[0]) throw new Error("Pack not found");
  if (!pack[0].active) throw new Error("Pack is not available");

  const receipt = `${userId.slice(0, 18)}_${packId.slice(0, 18)}`;

  const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
    },
    body: JSON.stringify({ amount: pack[0].price_paise, currency: "INR", receipt }),
  });

  if (!rzpRes.ok) {
    const text = await rzpRes.text().catch(() => "");
    throw new Error(`Razorpay order creation failed: ${rzpRes.status} ${text}`);
  }

  const rzpOrder = (await rzpRes.json()) as { id: string };

  await db.insert(credit_transactions).values({
    user_id: userId,
    type: "purchase",
    amount: pack[0].credits,
    pack_id: packId,
    razorpay_order_id: rzpOrder.id,
    description: `Bought ${pack[0].name} pack (${pack[0].credits} credits)`,
  });

  return { razorpay_order_id: rzpOrder.id, amount: pack[0].price_paise, currency: "INR", key_id: keyId };
}

export async function verifyPayment(
  userId: string,
  razorpay_order_id: string,
  razorpay_payment_id: string,
  razorpay_signature: string,
) {
  const { keySecret } = getRazorpayKeys();

  const expected = createHmac("sha256", keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (expected !== razorpay_signature) throw new Error("Invalid payment signature");

  const txRows = await db
    .select()
    .from(credit_transactions)
    .where(eq(credit_transactions.razorpay_order_id, razorpay_order_id))
    .limit(1);

  const tx = txRows[0];
  if (!tx) throw new Error("Transaction not found");
  if (tx.user_id !== userId) throw new Error("Transaction does not belong to this user");
  if (tx.razorpay_payment_id) throw new Error("Payment already verified");

  const newBalance = await db.transaction(async (trx) => {
    await trx
      .update(credit_transactions)
      .set({ razorpay_payment_id })
      .where(eq(credit_transactions.razorpay_order_id, razorpay_order_id));

    const existing = await trx
      .select()
      .from(user_credits)
      .where(eq(user_credits.user_id, userId))
      .limit(1);

    if (existing.length === 0) {
      await trx.insert(user_credits).values({
        user_id: userId,
        balance: tx.amount,
        free_scan_used: false,
        updated_at: new Date(),
      });
      return tx.amount;
    } else {
      const updated = await trx
        .update(user_credits)
        .set({ balance: existing[0]!.balance + tx.amount, updated_at: new Date() })
        .where(eq(user_credits.user_id, userId))
        .returning({ balance: user_credits.balance });
      return updated[0]!.balance;
    }
  });

  return { balance: newBalance };
}

// Called from reports.service.ts — returns updated user_credits row
export async function consumeCreditForScan(
  userId: string,
  competitorName: string,
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
) {
  const rows = await tx.select().from(user_credits).where(eq(user_credits.user_id, userId)).limit(1);

  if (rows.length === 0) {
    // First ever scan — give free scan, create row
    await tx.insert(user_credits).values({
      user_id: userId,
      balance: 0,
      free_scan_used: true,
      updated_at: new Date(),
    });
    return;
  }

  const credits = rows[0]!;

  if (!credits.free_scan_used) {
    await tx
      .update(user_credits)
      .set({ free_scan_used: true, updated_at: new Date() })
      .where(eq(user_credits.user_id, userId));
    return;
  }

  if (credits.balance < 1) throw new PaymentRequiredError();

  await tx
    .update(user_credits)
    .set({ balance: credits.balance - 1, updated_at: new Date() })
    .where(eq(user_credits.user_id, userId));

  await tx.insert(credit_transactions).values({
    user_id: userId,
    type: "debit",
    amount: 1,
    description: `Scan: ${competitorName}`,
  });
}

export class PaymentRequiredError extends Error {
  readonly code = "PAYMENT_REQUIRED";
  constructor() {
    super("No credits remaining. Please purchase a credit pack to continue.");
  }
}
