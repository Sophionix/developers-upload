"use client";

import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreditCard, Receipt, Pencil, Trash2 } from "@/lib/ui/icons";
import { adminRefundPayment } from "@/server/actions/admin/billing-ops";
import type { BillingOverviewDto, PaymentDto } from "@/lib/dto/admin-billing-ops";
import type { PlanDto } from "@/lib/dto/billing";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Paginated<T> = { items: T[]; nextCursor: string | null };

type Props = {
  overview: BillingOverviewDto;
  payments: Paginated<PaymentDto>;
  plans: Paginated<PlanDto>;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function centsToUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

const STATUS_VARIANT: Record<string, "success" | "destructive" | "warning" | "muted"> = {
  SUCCEEDED: "success",
  FAILED: "destructive",
  PENDING: "warning",
  REFUNDED: "muted",
};

function StatusBadge({ status }: { status: string }) {
  return <Badge variant={STATUS_VARIANT[status] ?? "secondary"}>{status}</Badge>;
}

function ActiveBadge({ active }: { active: boolean }) {
  return <Badge variant={active ? "success" : "muted"}>{active ? "Active" : "Inactive"}</Badge>;
}

function IntervalLabel({ months }: { months: number }) {
  if (months === 1) return "Monthly";
  if (months === 12) return "Yearly";
  return `${months}mo`;
}

// ---------------------------------------------------------------------------
// Stat cards
// ---------------------------------------------------------------------------

const STATS = [
  { label: "Active Subscriptions", key: "activeSubscriptions" as const, Icon: CreditCard },
  { label: "30-day MRR", key: "mrrCents" as const, Icon: Receipt },
  { label: "Refunds (30d)", key: "refundsLast30dCents" as const, Icon: Receipt },
] as const;

function OverviewStats({ overview }: { overview: BillingOverviewDto }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {STATS.map(({ label, key, Icon }) => {
        const raw = overview[key];
        const value = key === "activeSubscriptions" ? raw.toLocaleString() : centsToUsd(raw);
        return (
          <Card key={key}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{label}</span>
                <Icon className="size-4 text-muted-foreground" />
              </div>
              <p className="mt-2 font-display text-3xl text-foreground">{value}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Columns
// ---------------------------------------------------------------------------

function buildPaymentColumns(onRefund: (p: PaymentDto) => void): ColumnDef<PaymentDto, unknown>[] {
  return [
    { accessorKey: "userId", header: "User" },
    {
      accessorKey: "amountCents",
      header: "Amount",
      cell: ({ row }) => centsToUsd(row.original.amountCents),
    },
    { accessorKey: "currency", header: "Currency" },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: "provider",
      header: "Provider",
      cell: ({ row }) => (row.original.stripePaymentIntentId ? "Stripe" : "Manual"),
    },
    {
      accessorKey: "createdAt",
      header: "Date",
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
    },
    {
      id: "actions",
      enableSorting: false,
      cell: ({ row }) =>
        row.original.status === "SUCCEEDED" ? (
          <button
            type="button"
            onClick={() => onRefund(row.original)}
            className="bg-destructive text-white rounded-md px-4 py-2 text-sm font-medium"
          >
            Refund
          </button>
        ) : null,
    },
  ];
}

const planColumns: ColumnDef<PlanDto, unknown>[] = [
  { accessorKey: "name", header: "Name" },
  {
    accessorKey: "priceCents",
    header: "Price",
    cell: ({ row }) => centsToUsd(row.original.priceCents),
  },
  {
    accessorKey: "intervalMonths",
    header: "Interval",
    cell: ({ row }) => <IntervalLabel months={row.original.intervalMonths} />,
  },
  {
    accessorKey: "isActive",
    header: "Status",
    cell: ({ row }) => <ActiveBadge active={row.original.isActive} />,
  },
  {
    id: "actions",
    enableSorting: false,
    cell: ({ row }) => (
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => console.log("TODO: edit plan", row.original.id)}
          className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-md p-1.5"
          aria-label={`Edit ${row.original.name}`}
        >
          <Pencil className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => console.log("TODO: delete plan", row.original.id)}
          className="text-muted-foreground hover:text-destructive hover:bg-muted rounded-md p-1.5"
          aria-label={`Delete ${row.original.name}`}
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    ),
  },
];

// ---------------------------------------------------------------------------
// Refund dialog
// ---------------------------------------------------------------------------

const REFUND_REASONS = ["requested_by_customer", "duplicate", "fraudulent"] as const;
type RefundReason = (typeof REFUND_REASONS)[number];

const REASON_LABELS: Record<RefundReason, string> = {
  requested_by_customer: "Requested by customer",
  duplicate: "Duplicate",
  fraudulent: "Fraudulent",
};

function RefundDialog({
  payment,
  open,
  onOpenChange,
}: {
  payment: PaymentDto | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState<RefundReason>("requested_by_customer");
  const [loading, setLoading] = useState(false);

  async function handleRefund() {
    if (!payment) return;
    setLoading(true);
    try {
      const amountCents = amount ? Math.round(parseFloat(amount) * 100) : undefined;
      await adminRefundPayment({ paymentId: payment.id, reason, amountCents });
      onOpenChange(false);
    } catch {
      // Error is handled by server action toast / error boundary
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Refund Payment</DialogTitle>
          <DialogDescription>
            Original amount: {payment ? centsToUsd(payment.amountCents) : "--"}. Leave blank for
            full refund.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="refund-reason">Reason</Label>
            <select
              id="refund-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value as RefundReason)}
              className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground"
            >
              {REFUND_REASONS.map((r) => (
                <option key={r} value={r}>{REASON_LABELS[r]}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="refund-amount">Partial amount ($)</Label>
            <Input
              id="refund-amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="Full refund"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="border border-border text-foreground rounded-md px-4 py-2 text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={handleRefund}
            className="bg-destructive text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {loading ? "Processing..." : "Confirm Refund"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function BillingView({ overview, payments, plans }: Props) {
  const [refundTarget, setRefundTarget] = useState<PaymentDto | null>(null);
  const paymentColumns = buildPaymentColumns(setRefundTarget);

  return (
    <div className="space-y-6">
      <PageHeader title="Billing" description="Subscriptions, payments, and pricing plans." />

      <OverviewStats overview={overview} />

      <Tabs defaultValue="payments">
        <TabsList>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="plans">Plans</TabsTrigger>
        </TabsList>

        <TabsContent value="payments">
          <DataTable
            columns={paymentColumns}
            data={payments.items}
            searchKey="userId"
            searchPlaceholder="Search by user ID..."
          />
        </TabsContent>

        <TabsContent value="plans">
          <DataTable
            columns={planColumns}
            data={plans.items}
            searchKey="name"
            searchPlaceholder="Search plans..."
          />
        </TabsContent>
      </Tabs>

      <RefundDialog
        payment={refundTarget}
        open={refundTarget !== null}
        onOpenChange={(v) => !v && setRefundTarget(null)}
      />
    </div>
  );
}
