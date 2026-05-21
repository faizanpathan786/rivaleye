import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { competitorFormSchema, type CompetitorFormValues } from "./competitor-form.schema";
import { useCreateReportMutation } from "@/hooks/queries/use-reports";
import { addReport } from "@/lib/local-history";
import { GOAL_OPTIONS } from "@/lib/goal-labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const m = (error as { message: unknown }).message;
    if (typeof m === "string") return m;
  }
  return "Something went wrong. Please try again.";
}

export function CompetitorForm() {
  const navigate = useNavigate();
  const { mutateAsync, isPending, error } = useCreateReportMutation();

  const form = useForm<CompetitorFormValues>({
    resolver: zodResolver(competitorFormSchema),
    defaultValues: {
      competitor: "",
      category: "",
      audience: "",
      goal: "find_user_pain",
      website_url: "",
    },
  });

  async function onSubmit(values: CompetitorFormValues) {
    const result = await mutateAsync({
      category: values.category,
      competitors: [values.competitor],
      target_audience: values.audience ?? values.category,
      founder_goal: values.goal,
      website_url: values.website_url || undefined,
    });
    addReport({
      id: result.id,
      competitor: values.competitor,
      goal: values.goal,
      createdAt: new Date().toISOString(),
    });
    void navigate(`/reports/${result.id}`);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage(error)}</AlertDescription>
          </Alert>
        ) : null}

        <FormField
          control={form.control}
          name="competitor"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Competitor name</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Notion, Linear, Typeform" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Product category</FormLabel>
              <FormControl>
                <Input placeholder="e.g. AI meeting notes, project management" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="goal"
          render={({ field }) => (
            <FormItem>
              <FormLabel>What are you trying to learn?</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your goal" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {GOAL_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <details className="group">
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
            Optional details
          </summary>
          <div className="mt-3 space-y-4">
            <FormField
              control={form.control}
              name="audience"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Target audience</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. sales teams, solo founders" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="website_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Competitor website URL{" "}
                    <span className="text-muted-foreground text-xs font-normal">(optional)</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://linear.app"
                      type="url"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </details>

        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating…
            </>
          ) : (
            "Generate a pain report"
          )}
        </Button>
      </form>
    </Form>
  );
}
