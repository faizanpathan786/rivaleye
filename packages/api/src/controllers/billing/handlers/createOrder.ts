import { Elysia, t } from "elysia";
import { authPlugin } from "@/plugins/auth";
import { createOrder } from "@/services/billing.service";
import { ok } from "@/utils/response";

export const createOrderHandler = new Elysia()
  .use(authPlugin)
  .post(
    "/orders",
    async ({ user, body, status }) => {
      try {
        const order = await createOrder(user!.id, body.pack_id);
        return ok(order);
      } catch (e) {
        return status(400, {
          message: e instanceof Error ? e.message : "Failed to create order",
          error: "ORDER_FAILED",
        });
      }
    },
    {
      auth: {},
      body: t.Object({ pack_id: t.String({ minLength: 1 }) }),
    },
  );
