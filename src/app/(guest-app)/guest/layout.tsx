"use client";

import * as React from "react";
import { AppShell } from "@/components/layout/app-shell";
import { SidebarBrandMark } from "@/components/layout/sidebar-brand-mark";
import { AppProviders } from "@/components/providers/app-providers";
import { GUEST_APP_NAV } from "@/lib/nav";
import { Skeleton } from "@/components/ui/skeleton";

export default function GuestAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/guest/session", { method: "POST" }).catch(() => {}).finally(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <Skeleton className="h-8 w-32" />
      </div>
    );
  }

  return (
    <AppProviders>
      <AppShell
        isGuest
        guestAuthLinks
        guestNavActiveStyle="trailing-pill"
        items={GUEST_APP_NAV}
        sidebarBrandSlot={<SidebarBrandMark />}
      >
        {children}
      </AppShell>
    </AppProviders>
  );
}
