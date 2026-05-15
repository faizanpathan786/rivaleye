import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        outline: "text-foreground",
        positive: "border-transparent bg-emerald-100 text-emerald-700",
        negative: "border-transparent bg-red-100 text-red-700",
        neutral: "border-transparent bg-slate-100 text-slate-600",
        mixed: "border-transparent bg-amber-100 text-amber-700",
        complaint: "border-transparent bg-red-50 text-red-600",
        praise: "border-transparent bg-green-50 text-green-700",
        comparison: "border-transparent bg-blue-50 text-blue-700",
        pricing: "border-transparent bg-purple-50 text-purple-700",
        feature_request: "border-transparent bg-indigo-50 text-indigo-700",
        ux: "border-transparent bg-pink-50 text-pink-700",
        performance: "border-transparent bg-orange-50 text-orange-700",
        support: "border-transparent bg-teal-50 text-teal-700",
        other: "border-transparent bg-gray-100 text-gray-600",
        rising: "border-transparent bg-emerald-100 text-emerald-700",
        falling: "border-transparent bg-red-100 text-red-700",
        stable: "border-transparent bg-slate-100 text-slate-600",
        active: "border-transparent bg-emerald-100 text-emerald-700",
        paused: "border-transparent bg-amber-100 text-amber-700",
        archived: "border-transparent bg-gray-100 text-gray-600",
        switch_intent: "border-transparent bg-orange-100 text-orange-700",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
