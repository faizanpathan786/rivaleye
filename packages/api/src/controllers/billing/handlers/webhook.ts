import { Elysia } from "elysia";
import { loggerPlugin } from "@/config/logger";
import { handleRazorpayWebhook } from "@/services/billing.service";

function extractOrderEventMeta(rawBody: string): { event: string | null; order_id: string | null } {
  try {
    const parsed = JSON.parse(rawBody) as {
      event?: string;
      payload?: { payment?: { entity?: { order_id?: string } } };
    };
    return {
      event: parsed.event ?? null,
      order_id: parsed.payload?.payment?.entity?.order_id ?? null,
    };
  } catch {
    return { event: null, order_id: null };
  }
}

// Razorpay webhook. Unauthenticated by design — the X-Razorpay-Signature HMAC
// over the raw body is the authentication. The `parse` hook hands the handler
// the raw request text so the signature can be verified byte-for-byte.
//
// Every receipt is logged with its outcome (success/failure + reason) so a
// failed grant never disappears silently — never log the signature or raw
// payload, only event type / order id / outcome.
export const razorpayWebhookHandler = new Elysia()
  .use(loggerPlugin)
  .post(
    "/webhook",
    async ({ body, headers, status, log }) => {
      const rawBody = typeof body === "string" ? body : "";
      const signature = headers["x-razorpay-signature"];
      const meta = extractOrderEventMeta(rawBody);

      if (!signature) {
        log.warn({ ...meta, outcome: "rejected", reason: "missing_signature" }, "razorpay webhook");
        return status(400, { message: "Missing signature", error: "MISSING_SIGNATURE" });
      }
      try {
        await handleRazorpayWebhook(rawBody, signature);
        log.info({ ...meta, outcome: "handled" }, "razorpay webhook");
        return { ok: true };
      } catch (e) {
        log.error(
          { ...meta, outcome: "failed", reason: e instanceof Error ? e.message : String(e) },
          "razorpay webhook",
        );
        // Don't leak internals to an unauthenticated caller.
        return status(400, { message: "Webhook rejected", error: "WEBHOOK_REJECTED" });
      }
    },
    {
      parse: async ({ request }) => request.text(),
    },
  );
