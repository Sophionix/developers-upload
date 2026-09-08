import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight } from "@/lib/ui/icons";
import { cn } from "@/lib/ui/cn";

export type Crumb = { href?: string; label: string };

type PageHeaderProps = {
  title: string;
  description?: React.ReactNode;
  crumbs?: Crumb[];
  /** Back-navigation link. Renders a circular arrow-left button before the title. */
  backHref?: string;
  /** Right-aligned action slot (buttons). */
  actions?: React.ReactNode;
  className?: string;
};

export function PageHeader({
  title,
  description,
  crumbs,
  backHref,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-3 pb-6", className)}>
      {crumbs && crumbs.length > 0 && (
        <Breadcrumbs crumbs={crumbs} />
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {backHref && (
            <Link
              href={backHref}
              className="flex size-10 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-white/10"
              aria-label="Go back"
            >
              <ArrowLeft className="size-5" />
            </Link>
          )}
          <div className="min-w-0 space-y-1">
            <h1 className="font-display text-2xl leading-tight tracking-tight text-foreground sm:text-3xl">
              {title}
            </h1>
            {description && (
              <p className="max-w-prose text-sm text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={`${c.label}-${i}`} className="flex items-center gap-1.5">
              {c.href && !last ? (
                <Link href={c.href} className="transition-colors hover:text-foreground">
                  {c.label}
                </Link>
              ) : (
                <span className={cn(last && "text-foreground")}>{c.label}</span>
              )}
              {!last && <ChevronRight className="size-3.5 opacity-50" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
