import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { UserShell } from "@/components/layout/user-shell";
import { AppProviders } from "@/components/providers/app-providers";
import type { SessionContextUser } from "@/components/providers/session-provider";

export default async function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const user: SessionContextUser = {
    id: session.user.id,
    email: session.user.email ?? "",
    role: session.user.role,
    status: session.user.status,
    hasCompletedOnboarding: session.user.hasCompletedOnboarding,
    mfaRequired: session.user.mfaRequired,
    name: session.user.name ?? null,
    image: session.user.image ?? null,
  };

  return (
    <AppProviders>
      <UserShell user={user}>
        {children}
      </UserShell>
    </AppProviders>
  );
}
