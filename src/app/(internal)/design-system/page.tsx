import { notFound } from "next/navigation";
import { LavaBackground, BrandGradient, Logo } from "@/components/brand";
import { cn } from "@/lib/ui/cn";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Design System",
  robots: { index: false, follow: false },
};

type Swatch = { name: string; className: string; cssVar: string; note?: string };

const semanticSwatches: Swatch[] = [
  { name: "background", className: "bg-background", cssVar: "--color-background", note: "Base canvas (black)" },
  { name: "foreground", className: "bg-foreground text-background", cssVar: "--color-foreground", note: "Body text" },
  { name: "card", className: "bg-card", cssVar: "--color-card", note: "Raised translucent panels" },
  { name: "popover", className: "bg-popover", cssVar: "--color-popover", note: "Menus, tooltips, popovers" },
  { name: "primary", className: "bg-primary", cssVar: "--color-primary", note: "Brand burnt-orange" },
  { name: "secondary", className: "bg-secondary", cssVar: "--color-secondary" },
  { name: "muted", className: "bg-muted", cssVar: "--color-muted", note: "Disabled, skeleton" },
  { name: "accent", className: "bg-accent text-accent-foreground", cssVar: "--color-accent", note: "Gold highlights" },
  { name: "destructive", className: "bg-destructive", cssVar: "--color-destructive" },
  { name: "success", className: "bg-success", cssVar: "--color-success" },
  { name: "warning", className: "bg-warning text-background", cssVar: "--color-warning" },
  { name: "info", className: "bg-info", cssVar: "--color-info" },
];

const brandSwatches: Swatch[] = [
  { name: "brand-50", className: "bg-brand-50 text-background", cssVar: "--color-brand-50" },
  { name: "brand-100", className: "bg-brand-100 text-background", cssVar: "--color-brand-100" },
  { name: "brand-300", className: "bg-brand-300 text-background", cssVar: "--color-brand-300" },
  { name: "brand-500", className: "bg-brand-500", cssVar: "--color-brand-500" },
  { name: "brand-700", className: "bg-brand-700", cssVar: "--color-brand-700" },
  { name: "brand-900", className: "bg-brand-900", cssVar: "--color-brand-900" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="font-display text-2xl text-foreground">{title}</h2>
      {children}
    </section>
  );
}

function SwatchTile({ swatch }: { swatch: Swatch }) {
  return (
    <div className="rounded-md border border-border overflow-hidden">
      <div className={cn("h-20 w-full", swatch.className)} />
      <div className="p-3 text-xs space-y-1 bg-card">
        <div className="font-mono text-foreground">{swatch.name}</div>
        <div className="font-mono text-muted-foreground">{swatch.cssVar}</div>
        {swatch.note && <div className="text-muted-foreground">{swatch.note}</div>}
      </div>
    </div>
  );
}

export default function DesignSystemPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div className="relative min-h-dvh">
      <LavaBackground />
      <div className="mx-auto max-w-6xl px-6 py-12 space-y-12">
        <header className="space-y-4">
          <Logo size="lg" />
          <h1 className="font-display text-4xl text-foreground">Design System</h1>
          <p className="text-muted-foreground max-w-2xl">
            Wave 1 foundations. Tokens live in <code className="font-mono">src/app/globals.css</code>
            {" "}(Tailwind v4 <code className="font-mono">@theme</code>). This route is dev-only.
          </p>
        </header>

        <Section title="Semantic colors">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {semanticSwatches.map((s) => (
              <SwatchTile key={s.name} swatch={s} />
            ))}
          </div>
        </Section>

        <Section title="Brand scale">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {brandSwatches.map((s) => (
              <SwatchTile key={s.name} swatch={s} />
            ))}
          </div>
        </Section>

        <Section title="Typography">
          <div className="space-y-3 rounded-md border border-border bg-card p-6">
            <p className="font-display text-5xl">Display — Jomolhari</p>
            <p className="font-sans text-2xl">Sans — Geist</p>
            <p className="font-mono text-base">Mono — Geist Mono</p>
            <p className="text-sm text-muted-foreground">
              Use <code className="font-mono">font-display</code> for headings/brand,{" "}
              <code className="font-mono">font-sans</code> for body and UI,{" "}
              <code className="font-mono">font-mono</code> for code/token values.
            </p>
          </div>
        </Section>

        <Section title="Radii">
          <div className="flex flex-wrap gap-3">
            {[
              ["rounded-sm", "sm — 8px"],
              ["rounded-md", "md — 16px"],
              ["rounded-lg", "lg — 21px"],
              ["rounded-pill", "pill — 30px"],
              ["rounded-nav", "nav — 50px"],
            ].map(([cls, label]) => (
              <div
                key={cls}
                className={cn(
                  "size-24 bg-card border border-border grid place-items-center text-xs text-muted-foreground font-mono",
                  cls,
                )}
              >
                {label}
              </div>
            ))}
          </div>
        </Section>

        <Section title="Shadows">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-md bg-card p-6 shadow-elevated">
              <div className="font-mono text-xs">shadow-elevated</div>
            </div>
            <div className="rounded-md bg-card p-6 shadow-glow-brand">
              <div className="font-mono text-xs">shadow-glow-brand</div>
            </div>
            <div className="rounded-md bg-card p-6 shadow-glow-accent">
              <div className="font-mono text-xs">shadow-glow-accent</div>
            </div>
          </div>
        </Section>

        <Section title="Signature utilities">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-md overflow-hidden">
              <BrandGradient className="h-40 grid place-items-center">
                <span className="font-display text-accent text-2xl">bg-brand-grad</span>
              </BrandGradient>
            </div>
            <div className="rounded-md overflow-hidden border border-border relative h-40 bg-background">
              <div className="absolute inset-0 bg-lava-texture opacity-40" />
              <div className="relative grid place-items-center h-full font-mono text-xs">
                bg-lava-texture (shown at 40% for clarity)
              </div>
            </div>
          </div>
        </Section>

        <Section title="Brand atoms">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-md border border-border bg-card p-6 flex items-center justify-center">
              <Logo size="sm" />
            </div>
            <div className="rounded-md border border-border bg-card p-6 flex items-center justify-center">
              <Logo size="md" />
            </div>
            <div className="rounded-md border border-border bg-card p-6 flex items-center justify-center">
              <Logo size="lg" />
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
