import * as React from "react";
import { tv, type VariantProps } from "@/lib/ui/variants";
import { cn } from "@/lib/ui/cn";

const badge = tv({
  base: "inline-flex items-center gap-1 rounded-pill border px-2.5 py-0.5 text-xs font-medium transition-colors",
  variants: {
    variant: {
      default: "border-transparent bg-primary text-primary-foreground",
      secondary: "border-transparent bg-secondary text-secondary-foreground",
      accent: "border-transparent bg-accent text-accent-foreground",
      outline: "border-border text-foreground",
      muted: "border-transparent bg-muted text-muted-foreground",
      destructive: "border-transparent bg-destructive text-destructive-foreground",
      success: "border-transparent bg-success text-background",
      warning: "border-transparent bg-warning text-background",
    },
  },
  defaultVariants: { variant: "default" },
});

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badge({ variant }), className)} {...props} />;
}

export { badge as badgeVariants };
