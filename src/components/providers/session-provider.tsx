"use client";

import { createContext, useMemo } from "react";
import type { UserRole, AccountStatus } from "@/generated/prisma/client";

export interface SessionContextUser {
  id: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
  hasCompletedOnboarding: boolean;
  mfaRequired: boolean;
  name?: string | null;
  image?: string | null;
}

export interface SessionContextValue {
  user: SessionContextUser | null;
  isGuest: boolean;
  guestId: string | null;
}

interface SessionProviderProps {
  user?: SessionContextUser | undefined;
  isGuest?: boolean | undefined;
  guestId?: string | null | undefined;
  children: React.ReactNode;
}

export const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({
  user,
  isGuest,
  guestId,
  children,
}: SessionProviderProps) {
  const value = useMemo<SessionContextValue>(
    () => ({
      user: user ?? null,
      isGuest: isGuest ?? !user,
      guestId: guestId ?? null,
    }),
    [user, isGuest, guestId],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}
