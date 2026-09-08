import * as React from "react";
import { cn } from "@/lib/ui/cn";

type BrandGradientProps = React.HTMLAttributes<HTMLDivElement>;

/**
 * Burnt-orange → maroon signature gradient panel. Use for the main sidebar,
 * primary-CTA hero tiles, and deliberate brand moments only. Not a default
 * container — use <Card/> for standard surfaces.
 */
export function BrandGradient({
  className,
  children,
  ...rest
}: BrandGradientProps) {
  return (
    <div className={cn("bg-brand-grad", className)} {...rest}>
      {children}
    </div>
  );
}
