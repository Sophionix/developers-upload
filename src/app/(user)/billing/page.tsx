"use client";

import * as React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { getCurrentSubscription, getBillingHistory } from "@/server/actions/billing";
import type { BillingHistoryDto } from "@/server/actions/billing";
import type { CurrentSubscriptionDto } from "@/lib/dto/subscription";

function formatCents(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(d));
}

export default function BillingPage() {
  const [sub, setSub] = React.useState<CurrentSubscriptionDto | null>(null);
  const [history, setHistory] = React.useState<BillingHistoryDto[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    Promise.all([getCurrentSubscription(), getBillingHistory()])
      .then(([s, h]) => {
        setSub(s);
        setHistory(h.items);
      })
      .finally(() => setLoading(false));
  }, []);

  const planLabel = sub?.planName ?? (sub?.tier === "FREE" ? "Free" : "Premium");
  const priceLabel = sub?.priceCents
    ? `${formatCents(sub.priceCents, sub.currency ?? "USD")}/`
    : null;
  const intervalLabel =
    sub?.intervalMonths === 1
      ? "Monthly"
      : sub?.intervalMonths === 12
        ? "Yearly"
        : sub?.intervalMonths
          ? `${sub.intervalMonths}mo`
          : "";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Subscriptions" />

      {loading ? (
        <div className="h-40 w-full max-w-2xl animate-pulse rounded-2xl bg-surface" />
      ) : sub && sub.tier !== "FREE" ? (
        <div className="w-full max-w-2xl rounded-2xl border border-link/40 bg-link p-6">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-bold text-white">{planLabel}</h2>
            {priceLabel && (
              <div className="text-right">
                <span className="text-2xl font-bold text-white">{priceLabel}</span>
                <span className="text-sm font-normal text-white/90">{intervalLabel}</span>
              </div>
            )}
          </div>
          {sub.status !== "ACTIVE" && sub.status !== "TRIALING" && (
            <p className="mt-2 text-sm font-medium text-white/80">
              Status: {sub.status}
            </p>
          )}
        </div>
      ) : (
        <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-surface p-6">
          <h2 className="text-xl font-bold text-foreground">Free Plan</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Upgrade to Premium for unlimited access.
          </p>
          <Button asChild variant="brand" size="lg" className="mt-4">
            <Link href="/subscription">Upgrade to Premium</Link>
          </Button>
        </div>
      )}

      <div className="flex w-full flex-col gap-3">
        <h3 className="text-lg font-bold text-foreground">Billing History</h3>

        {history.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">No billing history yet.</p>
        ) : (
          <div className="w-full overflow-x-auto rounded-xl">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr className="bg-table-header text-left text-sm font-semibold text-white">
                  <th className="rounded-tl-xl px-5 py-3">Date</th>
                  <th className="px-5 py-3">Details</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="rounded-tr-xl px-5 py-3">Download</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-white/5 bg-[rgba(255,255,255,0.03)] text-sm text-foreground transition-colors hover:bg-surface"
                  >
                    <td className="px-5 py-3.5">{formatDate(row.date)}</td>
                    <td className="px-5 py-3.5">{row.description}</td>
                    <td className="px-5 py-3.5">{formatCents(row.amountCents, row.currency)}</td>
                    <td className="px-5 py-3.5">
                      {row.receiptUrl ? (
                        <a
                          href={row.receiptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-link underline underline-offset-2 transition-colors hover:text-link-hover"
                        >
                          Invoice
                        </a>
                      ) : (
                        <span className="text-muted-foreground">&mdash;</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
