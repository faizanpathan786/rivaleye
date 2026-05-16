import { Elysia } from "elysia";
import { getMeHandler } from "./handlers/getMe";
import { updateMeHandler } from "./handlers/updateMe";

export const meController = new Elysia({
  prefix: "/me",
  tags: ["users"],
})
  .use(getMeHandler)
  .use(updateMeHandler);
