import { EventSchemas, Inngest } from "inngest";
import type { RivalEyeEvents } from "@rivaleye/shared";

// inngest v3 uses EventSchemas().fromRecord<T>() — passing the event map as a
// generic to `new Inngest<T>()` directly is not supported in this SDK version.
export const inngest = new Inngest({
  id: "rivaleye-worker",
  eventKey: process.env.INNGEST_EVENT_KEY,
  schemas: new EventSchemas().fromRecord<RivalEyeEvents>(),
});
