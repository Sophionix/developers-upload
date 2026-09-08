"use client";

import * as React from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toast";

/**
 * Client-side providers mounted once at the root.
 * - TooltipProvider: required by Radix Tooltip; delay tuned for calm UX.
 * - Toaster: sonner host, positioned top-right by default.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={200} skipDelayDuration={400}>
      {children}
      <Toaster position="top-right" richColors closeButton />
    </TooltipProvider>
  );
}
