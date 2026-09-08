"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { tv, type VariantProps } from "@/lib/ui/variants";
import { cn } from "@/lib/ui/cn";

const button = tv({
  base: [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap select-none font-medium",
    "transition-[background-color,box-shadow,opacity,transform] duration-(--duration-micro) ease-(--ease-brand)",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:shrink-0 [&_svg]:size-4",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  ].join(" "),
  variants: {
    variant: {
      primary: "bg-primary text-primary-foreground hover:brightness-110 active:brightness-95",
      secondary: "bg-secondary text-secondary-foreground hover:brightness-110 active:brightness-95",
      brand: "bg-brand-grad text-primary-foreground shadow-glow-brand hover:brightness-110 active:brightness-95",
      accent: "bg-accent text-accent-foreground hover:brightness-95",
      destructive: "bg-destructive text-destructive-foreground hover:brightness-110",
      outline: "border border-border bg-transparent text-foreground hover:bg-muted",
      ghost: "bg-transparent text-foreground hover:bg-muted",
      link: "bg-transparent text-primary underline-offset-4 hover:underline h-auto px-0",
    },
    size: {
      sm: "h-8 px-3 text-sm rounded-pill",
      md: "h-10 px-5 text-base rounded-pill",
      lg: "h-12 px-7 text-lg rounded-pill",
      icon: "size-10 rounded-full",
      "icon-sm": "size-8 rounded-full",
    },
  },
  defaultVariants: { variant: "primary", size: "md" },
});

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof button> & {
    asChild?: boolean;
  };

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(button({ variant, size }), className)} {...props} />;
}

export { button as buttonVariants };
