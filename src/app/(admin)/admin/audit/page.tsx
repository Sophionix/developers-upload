import { adminListAuditLogs } from "@/server/actions/admin/audit";
import { AuditView } from "./_components/audit-view";

export default async function AdminAuditPage() {
  const logs = await adminListAuditLogs({ take: 50 });
  return <AuditView initialData={logs} />;
}
