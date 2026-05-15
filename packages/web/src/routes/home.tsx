import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useState } from "react";

const schema = z.object({
  competitor: z.string().min(1, "Enter a competitor name"),
  category: z.string().min(1, "Select a category"),
  goal: z.enum([
    "validate_idea",
    "find_weaknesses",
    "improve_positioning",
    "decide_mvp_features",
    "find_user_pain",
    "compare_alternatives",
  ]),
});

type FormValues = z.infer<typeof schema>;

const CATEGORIES = [
  "productivity",
  "project management",
  "CRM",
  "analytics",
  "devtools",
  "marketing",
  "finance",
  "HR",
  "other",
];

const GOALS: Array<{ value: FormValues["goal"]; label: string }> = [
  { value: "find_user_pain", label: "Find what users hate" },
  { value: "find_weaknesses", label: "Find product weaknesses" },
  { value: "improve_positioning", label: "Improve positioning" },
  { value: "validate_idea", label: "Validate my idea" },
  { value: "decide_mvp_features", label: "Decide MVP features" },
  { value: "compare_alternatives", label: "Compare alternatives" },
];

export function HomePage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { goal: "find_user_pain" },
  });

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    setApiError(null);
    try {
      const { id } = await api.reports.create({
        category: values.category,
        competitors: [values.competitor],
        goal: values.goal,
        platforms: ["reddit"],
      });
      navigate(`/reports/${id}`);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-semibold tracking-tight">RivalEye</h1>
          <p className="text-muted-foreground">Find what your competitor's users hate.</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="competitor">
              Competitor name
            </label>
            <input
              id="competitor"
              {...register("competitor")}
              placeholder="e.g. Notion"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {errors.competitor && (
              <p className="text-xs text-destructive">{errors.competitor.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="category">
              Category
            </label>
            <select
              id="category"
              {...register("category")}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Select a category</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {errors.category && (
              <p className="text-xs text-destructive">{errors.category.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="goal">
              Goal
            </label>
            <select
              id="goal"
              {...register("goal")}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {GOALS.map((g) => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
          </div>

          {apiError && (
            <p className="text-sm text-destructive">{apiError}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting ? "Generating..." : "Generate Report"}
          </button>
        </form>
      </div>
    </main>
  );
}
