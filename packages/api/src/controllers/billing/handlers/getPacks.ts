import { Elysia } from "elysia";
import { authPlugin } from "@/plugins/auth";
import { getActivePacks } from "@/services/billing.service";
import { okList } from "@/utils/response";

export const getPacksHandler = new Elysia()
  .use(authPlugin)
  .get("/packs", async () => {
    const packs = await getActivePacks();
    return okList(packs);
  }, { auth: {} });
