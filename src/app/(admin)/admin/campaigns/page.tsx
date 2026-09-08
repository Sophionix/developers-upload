import { adminListCampaigns } from "@/server/actions/admin/campaigns";
import { adminListTemplates } from "@/server/actions/admin/templates";
import { CampaignsView } from "./_components/campaigns-view";

export default async function AdminCampaignsPage() {
  const [campaigns, templates] = await Promise.all([
    adminListCampaigns({ take: 50 }),
    adminListTemplates({ take: 50 }),
  ]);
  return <CampaignsView campaigns={campaigns} templates={templates} />;
}
