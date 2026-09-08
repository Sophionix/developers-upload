import * as React from "react";
import { Loader2 } from "@/lib/ui/icons";
import { cn } from "@/lib/ui/cn";

type SpinnerProps = React.SVGAttributes<SVGSVGElement> & {
  size?: "sm" | "md" | "lg";
  label?: string;
};

const sizeMap = { sm: "size-4", md: "size-6", lg: "size-8" } as const;

export function Spinner({
  className,
  size = "md",
  label = "Loading",
  ...props
}: SpinnerProps) {
  return (
    <Loader2
      role="status"
      aria-label={label}
      className={cn("animate-spin text-muted-foreground", sizeMap[size], className)}
      {...props}
    />
  );
}
