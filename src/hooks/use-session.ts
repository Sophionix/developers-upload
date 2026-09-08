"use client";

import { useContext } from "react";
import {
  SessionContext,
  type SessionContextValue,
} from "@/components/providers/session-provider";

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within SessionProvider");
  }
  return context;
}
