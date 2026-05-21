import { z } from "zod";
import { reportGoalSchema } from "@rivaleye/shared";

export const PLATFORM_IDS = [
  "reddit",
  "appstore",
  "playstore",
  "hackernews",
  "producthunt",
  "devto",
  "website",
] as const;

export type PlatformId = (typeof PLATFORM_IDS)[number];

export const PLATFORM_LABELS: Record<PlatformId, string> = {
  reddit: "Reddit",
  appstore: "App Store",
  playstore: "Play Store",
  hackernews: "Hacker News",
  producthunt: "Product Hunt",
  devto: "Dev.to",
  website: "Website",
};

export const competitorFormSchema = z
  .object({
    competitor: z.string().min(1, "Competitor name is required"),
    category: z.string().min(1, "Category is required"),
    audience: z.string().optional(),
    goal: reportGoalSchema,
    selected_platforms: z
      .array(z.enum(PLATFORM_IDS))
      .min(1, "Select at least one platform"),
    website_url: z
      .string()
      .url("Must be a valid URL (e.g. https://linear.app)")
      .optional()
      .or(z.literal("")),
  })
  .refine(
    (data) => {
      if (data.selected_platforms.includes("website") && !data.website_url) {
        return false;
      }
      return true;
    },
    {
      message: "Website URL is required when Website platform is selected",
      path: ["website_url"],
    },
  );

export type CompetitorFormValues = z.infer<typeof competitorFormSchema>;
