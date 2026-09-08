import { adminGetSettings } from "@/server/actions/admin/settings";
import { adminListFeatureFlags } from "@/server/actions/admin/flags";
import { adminListAdmins } from "@/server/actions/admin/admins";
import { SystemView } from "./_components/system-view";

export default async function AdminSettingsPage() {
  const [settings, flags, admins] = await Promise.all([
    adminGetSettings(),
    adminListFeatureFlags({ take: 50 }),
    adminListAdmins({ take: 50 }),
  ]);
  return <SystemView settings={settings} flags={flags} admins={admins} />;
}
