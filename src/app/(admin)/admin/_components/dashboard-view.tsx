"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import { User, CreditCard, Sparkles, Receipt, Layers, BookOpen } from "@/lib/ui/icons";
import type {
  AdminOverviewDto,
  SubscriptionSummaryDto,
  ActivityFeedDto,
} from "@/lib/dto/admin-analytics";

type Props = {
  overview: AdminOverviewDto;
  subscriptionSummary: SubscriptionSummaryDto;
  activityFeed: ActivityFeedDto;
};

function timeAgo(date: Date): string {
  const now = Date.now();
  const diff = now - new Date(date).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const STAT_CARDS = [
  { label: "Total Users", key: "totalUsers" as const, Icon: User },
  { label: "Active Subscriptions", key: "activeSubscriptions" as const, Icon: CreditCard },
  { label: "Premium Users", key: "premiumUsers" as const, Icon: Sparkles },
  { label: "MRR", key: "mrrCents" as const, Icon: Receipt },
  { label: "Daily Card Draws", key: "dailyCardDraws" as const, Icon: Layers },
  { label: "Total Journal Entries", key: "totalJournalEntries" as const, Icon: BookOpen },
] as const;

export function DashboardView({ overview, subscriptionSummary, activityFeed }: Props) {
  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Platform overview" />

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {STAT_CARDS.map(({ label, key, Icon }) => {
          const raw = overview[key];
          const value =
            key === "mrrCents"
              ? `$${(raw / 100).toLocaleString()}`
              : raw.toLocaleString();

          return (
            <Card key={key}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <Icon className="size-4 text-muted-foreground" />
                </div>
                <p className="mt-2 font-display text-3xl text-foreground">
                  {value}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Subscription distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Subscription Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {subscriptionSummary.distribution.length === 0 ? (
              <p className="text-sm text-muted-foreground">No subscriptions yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="pb-2 font-medium">Tier</th>
                      <th className="pb-2 font-medium">Status</th>
                      <th className="pb-2 text-right font-medium">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscriptionSummary.distribution.map((row) => (
                      <tr
                        key={`${row.tier}-${row.status}`}
                        className="border-b border-border/50 last:border-0"
                      >
                        <td className="py-2 text-foreground">{row.tier}</td>
                        <td className="py-2 text-foreground">{row.status}</td>
                        <td className="py-2 text-right text-foreground">
                          {row.count.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
              <span className="text-sm text-muted-foreground">
                30-day Churn Rate
              </span>
              <span className="font-display text-lg text-foreground">
                {(subscriptionSummary.churnRate30d * 100).toFixed(1)}%
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Activity feed */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {activityFeed.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent activity.</p>
            ) : (
              <ul className="space-y-3">
                {activityFeed.items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start gap-3 border-b border-border/50 pb-3 last:border-0 last:pb-0"
                  >
                    <Badge
                      variant={item.kind === "audit" ? "outline" : "secondary"}
                      className="mt-0.5 shrink-0"
                    >
                      {item.kind}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground">{item.summary}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {timeAgo(item.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
