import type { ReportGoal } from "@rivaleye/shared";

export const GOAL_LABELS: Record<ReportGoal, string> = {
  validate_idea: "Validate a SaaS idea",
  find_user_pain: "Find user pain before launching",
  improve_positioning: "Improve landing page positioning",
  decide_mvp_features: "Decide MVP features",
  compare_alternatives: "Compare alternatives in a market",
  find_weaknesses: "Find competitor weaknesses",
};

export const GOAL_OPTIONS: { value: ReportGoal; label: string }[] = [
  { value: "find_user_pain", label: GOAL_LABELS.find_user_pain },
  { value: "validate_idea", label: GOAL_LABELS.validate_idea },
  { value: "find_weaknesses", label: GOAL_LABELS.find_weaknesses },
  { value: "improve_positioning", label: GOAL_LABELS.improve_positioning },
  { value: "decide_mvp_features", label: GOAL_LABELS.decide_mvp_features },
  { value: "compare_alternatives", label: GOAL_LABELS.compare_alternatives },
];
