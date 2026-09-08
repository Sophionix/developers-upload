import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/ui/cn";
import type { LucideIcon } from "@/lib/ui/icons";

type AuthChoiceCardProps = {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  onClick?: () => void;
  className?: string;
};

/**
 * Rich CTA card used on the Welcome / Entry-choice surface (Figma 1908:6869).
 * Icon tile (burnt-orange square) + title + subtitle, rendered as a full-width
 * link with a dark semi-transparent background that brightens on hover.
 */
export function AuthChoiceCard({
  href,
  title,
  description,
  icon: Icon,
  onClick,
  className,
}: AuthChoiceCardProps) {
  return (
    <Link
      href={href}
      {...(onClick ? { onClick } : {})}
      className={cn(
        "group flex items-center gap-4 rounded-lg border border-border/60 bg-card/70 p-3",
        "shadow-elevated backdrop-blur-sm transition-colors duration-(--duration-micro) ease-brand",
        "hover:border-primary/60 hover:bg-card focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
    >
      <span
        aria-hidden
        className="grid size-12 shrink-0 place-items-center rounded-md bg-brand-grad text-primary-foreground shadow-glow-brand"
      >
        <Icon className="size-6" />
      </span>
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="font-display text-lg leading-none text-foreground">{title}</span>
        <span className="text-sm text-muted-foreground">{description}</span>
      </span>
    </Link>
  );
}
