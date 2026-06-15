import { Elysia } from "elysia";
import { handleRazorpayWebhook } from "@/services/billing.service";

// Razorpay webhook. Unauthenticated by design — the X-Razorpay-Signature HMAC
// over the raw body is the authentication. The `parse` hook hands the handler
// the raw request text so the signature can be verified byte-for-byte.
export const razorpayWebhookHandler = new Elysia().post(
  "/webhook",
  async ({ body, headers, status }) => {
    const signature = headers["x-razorpay-signature"];
    if (!signature) {
      return status(400, { message: "Missing signature", error: "MISSING_SIGNATURE" });
    }
    try {
      await handleRazorpayWebhook(typeof body === "string" ? body : "", signature);
      return { ok: true };
    } catch {
      // Don't leak internals to an unauthenticated caller.
      return status(400, { message: "Webhook rejected", error: "WEBHOOK_REJECTED" });
    }
  },
  {
    parse: async ({ request }) => request.text(),
  },
);
