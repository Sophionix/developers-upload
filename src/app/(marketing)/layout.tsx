import * as React from "react";
import { LogoHalo } from "@/components/brand";

/** Persistent marketing shell — pixel-identical to (auth)/layout.tsx. */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative grid h-dvh grid-cols-1 grid-rows-[auto_1fr] gap-3 overflow-hidden bg-background bg-[url('/opace_bg.png')] bg-cover bg-center p-3 sm:gap-4 sm:p-4 lg:grid-cols-2 lg:grid-rows-none lg:gap-10 lg:p-6">

      <section className="relative flex aspect-[8/3] w-full items-center justify-center self-start overflow-hidden rounded-2xl shadow-elevated sm:aspect-[8/4] lg:aspect-[8/9] lg:max-h-[calc(100dvh-3rem)] lg:max-w-[calc((100dvh-3rem)*8/9)]">
        <div
          aria-hidden
          className="absolute inset-0 bg-lava-texture bg-cover saturate-[1.25] contrast-[1.05]"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(200,122,2,0.28)_0%,transparent_55%)]"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-linear-to-br from-brand-900/40 via-transparent to-black/35"
        />
        <div className="relative">
          <LogoHalo />
        </div>
      </section>

      <section className="relative flex min-h-0 flex-col overflow-hidden">{children}</section>
    </div>
  );
}
