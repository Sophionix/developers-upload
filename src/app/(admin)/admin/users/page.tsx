import { adminListUsers } from "@/server/actions/admin/users";
import { UsersView } from "./_components/users-view";

export default async function AdminUsersPage() {
  const users = await adminListUsers({ take: 50, sortBy: "createdAt", sortDir: "desc" });
  return <UsersView initialData={users} />;
}
