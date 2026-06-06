import { Elysia } from "elysia";
import { authPlugin } from "@/plugins/auth";
import { getBalance } from "@/services/billing.service";
import { ok } from "@/utils/response";

export const getBalanceHandler = new Elysia()
  .use(authPlugin)
  .get("/balance", async ({ user }) => {
    const data = await getBalance(user!.id);
    return ok(data);
  }, { auth: {} });
