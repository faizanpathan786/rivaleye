import { Elysia } from "elysia";
import { addPlannedActionHandler } from "./handlers/addPlannedAction";
import { listPlannedActionsHandler } from "./handlers/listPlannedActions";
import { deletePlannedActionHandler } from "./handlers/deletePlannedAction";

export const plannedActionsController = new Elysia({
  prefix: "/planned-actions",
  tags: ["Planned Actions"],
})
  .use(addPlannedActionHandler)
  .use(listPlannedActionsHandler)
  .use(deletePlannedActionHandler);
