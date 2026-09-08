import { adminGetOverview } from "@/server/actions/admin/dashboard";
import { adminGetSubscriptionSummary } from "@/server/actions/admin/dashboard";
import { adminGetActivityFeed } from "@/server/actions/admin/dashboard";
import { DashboardView } from "./_components/dashboard-view";

export default async function AdminDashboardPage() {
  const [overview, subscriptionSummary, activityFeed] = await Promise.all([
    adminGetOverview(),
    adminGetSubscriptionSummary(),
    adminGetActivityFeed({ take: 20 }),
  ]);

  return (
    <DashboardView
      overview={overview}
      subscriptionSummary={subscriptionSummary}
      activityFeed={activityFeed}
    />
  );
}
