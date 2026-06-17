import { Elysia } from "elysia";
import { listOutreachHandler } from "./handlers/listOutreach";
import { addOutreachHandler } from "./handlers/addOutreach";
import { deleteOutreachHandler } from "./handlers/deleteOutreach";

export const outreachController = new Elysia({
  prefix: "/outreach",
  tags: ["outreach"],
})
  .use(listOutreachHandler)
  .use(addOutreachHandler)
  .use(deleteOutreachHandler);
