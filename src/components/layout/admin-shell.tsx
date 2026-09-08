"use client";

import * as React from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Topbar } from "@/components/layout/topbar";
import { UserMenu } from "@/components/layout/user-menu";
import { Badge } from "@/components/ui/badge";
import { Shield } from "@/lib/ui/icons";
import { ADMIN_NAV } from "@/lib/nav";

type AdminShellProps = {
  children: React.ReactNode;
  admin?: {
    name: string;
    email?: string;
    avatarUrl?: string;
    role?: "super_admin" | "content_manager";
  };
  onLogout?: () => void;
};

/**
 * Operator shell: brand-gradient sidebar (matches user shell), sticky Topbar with
 * role badge, no search field (admin uses in-page filters instead).
 */
export function AdminShell({ children, admin, onLogout }: AdminShellProps) {
  const displayAdmin = admin ?? { name: "Admin", role: "super_admin" as const };

  return (
    <div className="flex min-h-dvh bg-background">
      <div className="hidden md:block">
        <Sidebar items={ADMIN_NAV} tone="brand" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          leading={
            <>
              <MobileNav items={ADMIN_NAV} tone="brand" />
              <div className="hidden items-center gap-2 md:flex">
                <Shield className="size-4 text-primary" />
                <span className="font-display text-lg">Admin</span>
                {displayAdmin.role && (
                  <Badge variant="outline" className="font-mono uppercase">
                    {displayAdmin.role.replace("_", " ")}
                  </Badge>
                )}
              </div>
            </>
          }
          search={false}
          trailing={
            <UserMenu
              name={displayAdmin.name}
              {...(displayAdmin.email ? { email: displayAdmin.email } : {})}
              {...(displayAdmin.avatarUrl ? { avatarUrl: displayAdmin.avatarUrl } : {})}
              {...(onLogout ? { onLogout } : {})}
            />
          }
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
