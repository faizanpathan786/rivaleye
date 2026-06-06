import { Elysia } from "elysia";
import { authPlugin } from "@/plugins/auth";
import { getTransactions } from "@/services/billing.service";
import { okList } from "@/utils/response";

export const getTransactionsHandler = new Elysia()
  .use(authPlugin)
  .get("/transactions", async ({ user }) => {
    const rows = await getTransactions(user!.id);
    return okList(rows);
  }, { auth: {} });
