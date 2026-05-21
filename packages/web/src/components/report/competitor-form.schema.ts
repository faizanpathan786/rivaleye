import { z } from "zod";
import { reportGoalSchema } from "@rivaleye/shared";

export const competitorFormSchema = z.object({
  competitor: z.string().min(1, "Competitor name is required"),
  category: z.string().min(1, "Category is required"),
  audience: z.string().optional(),
  goal: reportGoalSchema,
  website_url: z.string().url("Must be a valid URL (e.g. https://linear.app)").optional().or(z.literal("")),
});

export type CompetitorFormValues = z.infer<typeof competitorFormSchema>;
