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

export const createReportInputSchema = z.object({
  category: z.string().min(1),
  competitors: z.array(z.string().min(1)).min(1),
  audience: z.string().optional(),
  goal: reportGoalSchema,
});
export type CreateReportInput = z.infer<typeof createReportInputSchema>;
