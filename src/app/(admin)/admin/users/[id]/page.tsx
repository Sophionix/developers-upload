import { adminGetUser, adminGetUserStats } from "@/server/actions/admin/users";
import { UserDetailView } from "./_components/user-detail-view";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [user, stats] = await Promise.all([
    adminGetUser({ id }),
    adminGetUserStats({ id }),
  ]);

  return <UserDetailView user={user} stats={stats} />;
}
