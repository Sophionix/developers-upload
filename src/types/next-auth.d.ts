import type { DefaultSession } from "next-auth";
import type {
  UserRole,
  AccountStatus,
  SubscriptionTier,
} from "@/generated/prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      status: AccountStatus;
      hasCompletedOnboarding: boolean;
      subscriptionTier: SubscriptionTier;
      mfaRequired: boolean;
      mfaVerified: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role: UserRole;
    status: AccountStatus;
    hasCompletedOnboarding: boolean;
    subscriptionTier: SubscriptionTier;
  }
}
