import { Elysia, t } from "elysia";
import { authPlugin } from "@/plugins/auth";
import { verifyPayment } from "@/services/billing.service";
import { ok } from "@/utils/response";

export const verifyPaymentHandler = new Elysia()
  .use(authPlugin)
  .post(
    "/verify",
    async ({ user, body, status }) => {
      try {
        const result = await verifyPayment(
          user!.id,
          body.razorpay_order_id,
          body.razorpay_payment_id,
          body.razorpay_signature,
        );
        return ok(result);
      } catch (e) {
        return status(400, {
          message: e instanceof Error ? e.message : "Payment verification failed",
          error: "VERIFY_FAILED",
        });
      }
    },
    {
      auth: {},
      body: t.Object({
        razorpay_order_id: t.String({ minLength: 1 }),
        razorpay_payment_id: t.String({ minLength: 1 }),
        razorpay_signature: t.String({ minLength: 1 }),
      }),
    },
  );
