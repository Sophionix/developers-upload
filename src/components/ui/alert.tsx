import * as React from "react";
import { tv, type VariantProps } from "@/lib/ui/variants";
import { cn } from "@/lib/ui/cn";

const alert = tv({
  base: "relative w-full rounded-md border px-4 py-3 text-sm [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:size-4 [&>svg+div]:translate-y-[-2px] [&:has(svg)]:pl-11",
  variants: {
    variant: {
      default: "border-border bg-card text-foreground [&>svg]:text-foreground",
      info: "border-info/50 bg-info/10 text-info [&>svg]:text-info",
      success: "border-success/50 bg-success/10 text-success [&>svg]:text-success",
      warning: "border-warning/50 bg-warning/10 text-warning [&>svg]:text-warning",
      destructive:
        "border-destructive/50 bg-destructive/10 text-destructive [&>svg]:text-destructive",
    },
  },
  defaultVariants: { variant: "default" },
});

type AlertProps = React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alert>;

export function Alert({ className, variant, ...props }: AlertProps) {
  return <div role="alert" className={cn(alert({ variant }), className)} {...props} />;
}

export function AlertTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h5
      className={cn("mb-1 font-medium leading-none tracking-tight", className)}
      {...props}
    />
  );
}

export function AlertDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <div className={cn("text-sm [&_p]:leading-relaxed", className)} {...props} />
  );
}
