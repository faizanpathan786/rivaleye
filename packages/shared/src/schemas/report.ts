import { z } from "zod";

export const reportGoalSchema = z.enum([
  "validate_idea",
  "find_weaknesses",
  "improve_positioning",
  "decide_mvp_features",
  "find_user_pain",
  "compare_alternatives",
]);
export type ReportGoal = z.infer<typeof reportGoalSchema>;

export const platformIdSchema = z.enum([
  "reddit",
  "g2",
  "capterra",
  "twitter",
  "linkedin",
  "producthunt",
  "appstore",
  "playstore",
  "gmaps",
]);
export type PlatformId = z.infer<typeof platformIdSchema>;

export const createReportInputSchema = z.object({
  category: z.string().min(1),
  competitors: z.array(z.string().min(1)).min(1),
  audience: z.string().optional(),
  goal: reportGoalSchema,
  platforms: z.array(platformIdSchema).optional(),
});
export type CreateReportInput = z.infer<typeof createReportInputSchema>;
