"use client";

import { signOut } from "next-auth/react";
import {
  SessionProvider,
  type SessionContextUser,
} from "@/components/providers/session-provider";
import { AppShell } from "@/components/layout/app-shell";
import { SidebarBrandMark } from "@/components/layout/sidebar-brand-mark";

type UserShellProps = {
  user?: SessionContextUser | undefined;
  children: React.ReactNode;
};

export function UserShell({ user, children }: UserShellProps) {
  const appShellUser = user
    ? {
        name: user.name ?? user.email,
        email: user.email,
        ...(user.image ? { avatarUrl: user.image } : {}),
      }
    : undefined;

  function handleLogout() {
    void signOut({ callbackUrl: "/login" });
  }

  const isGuest = !user;

  return (
    <SessionProvider user={user}>
      <AppShell
        {...(appShellUser ? { user: appShellUser } : {})}
        isGuest={isGuest}
        {...(user ? { sidebarBrandSlot: <SidebarBrandMark /> } : {})}
        {...(isGuest ? {} : { onLogout: handleLogout })}
      >
        {children}
      </AppShell>
    </SessionProvider>
  );
}
