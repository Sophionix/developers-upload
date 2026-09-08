"use client";

import * as React from "react";
import { PageHeader } from "@/components/layout";
import { listNotifications } from "@/server/actions/notifications";
import type { NotificationDto } from "@/server/actions/notifications";

function formatNotificationDate(d: Date): { date: string; time: string } {
  const now = new Date();
  const dt = new Date(d);
  const diffMs = now.getTime() - dt.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);

  const date =
    diffDays === 0
      ? "Today"
      : diffDays === 1
        ? "Yesterday"
        : dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const time = dt.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return { date, time };
}

export default function NotificationsPage() {
  const [items, setItems] = React.useState<NotificationDto[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    listNotifications({})
      .then((res) => setItems(res.items))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Notifications" backHref="/dashboard" className="pb-0" />

      <div className="flex flex-col gap-4">
        {loading ? (
          Array.from({ length: 3 }, (_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-border bg-card px-5 py-4"
            >
              <div className="h-4 w-32 rounded bg-white/10" />
              <div className="mt-3 h-3 w-full rounded bg-white/10" />
              <div className="mt-1 h-3 w-3/4 rounded bg-white/10" />
            </div>
          ))
        ) : items.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No notifications yet.
          </p>
        ) : (
          items.map((n) => {
            const { date, time } = formatNotificationDate(n.createdAt);
            return (
              <div
                key={n.id}
                className="rounded-xl border border-border bg-card px-5 py-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-sm font-bold text-foreground">{n.title}</h3>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {date} | {time}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {n.body}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
