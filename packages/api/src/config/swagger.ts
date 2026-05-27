import { swagger } from "@elysiajs/swagger";
import { Elysia } from "elysia";

import { Tags } from "@/types/swagger";

const enabled = process.env.SWAGGER_ENABLED !== "false";

export const swaggerPlugin = enabled
  ? swagger({
      path: "/v1/docs",
      exclude: ["/"],
      scalarConfig: {
        spec: { url: "/v1/docs/json" },
      },
      documentation: {
        info: {
          title: "RivalEye API Documentation",
          description:
            "API endpoints for authentication, competitors, reports, radar, and dashboard.",
          version: "1.0.0",
        },
        tags: [
          { name: Tags.AUTHENTICATION, description: "Authentication endpoints" },
          { name: Tags.USERS, description: "User profile endpoints" },
          { name: Tags.ME, description: "Current user endpoints" },
          { name: Tags.COMPETITORS, description: "Competitor CRUD endpoints" },
          { name: Tags.RADAR, description: "Radar events endpoints" },
          { name: Tags.REPORTS, description: "Pain report endpoints" },
          { name: Tags.DASHBOARD, description: "Aggregated dashboard endpoints" },
        ],
      },
    })
  : new Elysia();
