import * as React from "react";
import { LogoHalo } from "@/components/brand";

/**
 * Persistent auth shell. Locked to 100dvh with no page-level scroll — the
 * left brand panel is capped by viewport height (aspect 8/9 preserved via
 * both max-h and max-w) and the right column scrolls internally only if
 * content genuinely overflows.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative grid h-dvh grid-cols-1 overflow-hidden bg-background bg-[url('/opace_bg.png')] bg-cover bg-center lg:grid-cols-2 lg:gap-6 lg:p-6">

      <section className="relative hidden items-center justify-center overflow-hidden rounded-2xl shadow-elevated lg:flex lg:max-h-[calc(100dvh-3rem)] lg:max-w-[calc((100dvh-3rem)*8/9)]">
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

      <section className="relative flex min-h-0 flex-col overflow-hidden lg:my-6">{children}</section>
    </div>
  );
}
