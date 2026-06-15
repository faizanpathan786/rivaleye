import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@/db/client";
import { credit_packs, user_credits, credit_transactions } from "@/db/schema/billing";
import { and, eq, desc, or, isNotNull, isNull, gte, sql } from "drizzle-orm";

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

async function fetchRazorpayPaymentStatus(paymentId: string): Promise<string | null> {
  const { keyId, keySecret } = getRazorpayKeys();
  const res = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}` },
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { status?: string };
  return body.status ?? null;
}

/**
 * Idempotently grant the credits for a paid order. The conditional UPDATE only
 * claims the row while razorpay_payment_id IS NULL, so the browser /verify path
 * and the Razorpay webhook can race freely and never double-credit. Returns
 * granted=false when the order was already credited (or is unknown).
 */
async function grantCreditsForOrder(
  razorpay_order_id: string,
  razorpay_payment_id: string,
): Promise<{ granted: boolean; userId: string | null }> {
  return db.transaction(async (trx) => {
    const claimed = await trx
      .update(credit_transactions)
      .set({ razorpay_payment_id })
      .where(
        and(
          eq(credit_transactions.razorpay_order_id, razorpay_order_id),
          isNull(credit_transactions.razorpay_payment_id),
        ),
      )
      .returning();

    if (claimed.length === 0) return { granted: false, userId: null };

    const tx = claimed[0]!;
    const existing = await trx
      .select()
      .from(user_credits)
      .where(eq(user_credits.user_id, tx.user_id))
      .limit(1);

    if (existing.length === 0) {
      await trx.insert(user_credits).values({
        user_id: tx.user_id,
        balance: tx.amount,
        free_scan_used: false,
        updated_at: new Date(),
      });
    } else {
      await trx
        .update(user_credits)
        .set({ balance: existing[0]!.balance + tx.amount, updated_at: new Date() })
        .where(eq(user_credits.user_id, tx.user_id));
    }
    return { granted: true, userId: tx.user_id };
  });
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

  // Confirm the payment was actually captured/authorized before crediting —
  // the signature only proves the order/payment pair, not that money moved.
  const paymentStatus = await fetchRazorpayPaymentStatus(razorpay_payment_id);
  if (paymentStatus !== "captured" && paymentStatus !== "authorized") {
    throw new Error("Payment not captured");
  }

  await grantCreditsForOrder(razorpay_order_id, razorpay_payment_id);
  const { balance } = await getBalance(userId);
  return { balance };
}

/**
 * Razorpay webhook — the authoritative credit grant. Verifies the
 * X-Razorpay-Signature HMAC over the raw body, then idempotently credits
 * captured payments. This covers the case where the browser drops between
 * capture and the /verify call.
 */
export async function handleRazorpayWebhook(rawBody: string, signature: string): Promise<{ ok: true }> {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) throw new Error("RAZORPAY_WEBHOOK_SECRET is not configured");

  const expected = createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    throw new Error("Invalid webhook signature");
  }

  const event = JSON.parse(rawBody) as {
    event?: string;
    payload?: { payment?: { entity?: { id?: string; order_id?: string } } };
  };

  if (event.event === "payment.captured" || event.event === "order.paid") {
    const payment = event.payload?.payment?.entity;
    if (payment?.order_id && payment.id) {
      await grantCreditsForOrder(payment.order_id, payment.id);
    }
  }
  return { ok: true };
}

// Called from reports.service.ts inside the caller's transaction. Uses atomic
// conditional UPDATEs so concurrent scans can never double-spend one credit or
// the single free scan.
export async function consumeCreditForScan(
  userId: string,
  competitorName: string,
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
) {
  // Ensure the row exists; no-op if another scan already created it.
  await tx
    .insert(user_credits)
    .values({ user_id: userId, balance: 0, free_scan_used: false, updated_at: new Date() })
    .onConflictDoNothing();

  // Claim the free scan atomically (only one writer can flip false -> true).
  const freeClaim = await tx
    .update(user_credits)
    .set({ free_scan_used: true, updated_at: new Date() })
    .where(and(eq(user_credits.user_id, userId), eq(user_credits.free_scan_used, false)))
    .returning({ user_id: user_credits.user_id });
  if (freeClaim.length > 0) return;

  // Otherwise debit one paid credit atomically (only if balance >= 1).
  const debit = await tx
    .update(user_credits)
    .set({ balance: sql`${user_credits.balance} - 1`, updated_at: new Date() })
    .where(and(eq(user_credits.user_id, userId), gte(user_credits.balance, 1)))
    .returning({ balance: user_credits.balance });
  if (debit.length === 0) throw new PaymentRequiredError();

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
