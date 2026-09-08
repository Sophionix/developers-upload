import { adminGetDauWauMau, adminGetMoodTrends, adminGetCardUsage, adminGetChurnIndicators } from "@/server/actions/admin/dashboard";
import { AnalyticsView } from "./_components/analytics-view";

export default async function AdminAnalyticsPage() {
  const [dauWauMau, moodTrends, cardUsage, churnIndicators] = await Promise.all([
    adminGetDauWauMau({ rangeDays: 30 }),
    adminGetMoodTrends({ rangeDays: 30 }),
    adminGetCardUsage({ rangeDays: 30, top: 10 }),
    adminGetChurnIndicators({ rangeDays: 30 }),
  ]);
  return (
    <AnalyticsView
      dauWauMau={dauWauMau}
      moodTrends={moodTrends}
      cardUsage={cardUsage}
      churnIndicators={churnIndicators}
    />
  );
}
