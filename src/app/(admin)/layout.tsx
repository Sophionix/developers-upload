import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AdminShell } from "@/components/layout/admin-shell";
import { UserRole } from "@/generated/prisma/enums";

const ROLE_MAP: Partial<Record<UserRole, "super_admin" | "content_manager">> = {
  [UserRole.SUPER_ADMIN]: "super_admin",
  [UserRole.CONTENT_MANAGER]: "content_manager",
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const mappedRole = session?.user
    ? ROLE_MAP[session.user.role as UserRole]
    : undefined;

  if (!session?.user || !mappedRole) {
    redirect("/dashboard");
  }

  const admin: {
    name: string;
    email?: string;
    avatarUrl?: string;
    role: "super_admin" | "content_manager";
  } = {
    name: session.user.name ?? "Admin",
    role: mappedRole,
  };

  if (session.user.email) admin.email = session.user.email;
  if (session.user.image) admin.avatarUrl = session.user.image;

  return (
    <AdminShell admin={admin}>
      {children}
    </AdminShell>
  );
}
