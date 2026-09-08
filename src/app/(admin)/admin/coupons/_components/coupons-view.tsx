"use client";

import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
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
import { Plus, Pencil, Trash2 } from "@/lib/ui/icons";
import { adminCreateCoupon } from "@/server/actions/admin/coupons";
import type { CouponDto } from "@/lib/dto/billing";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Paginated<T> = { items: T[]; nextCursor: string | null };
type Props = { coupons: Paginated<CouponDto> };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ActiveBadge({ active }: { active: boolean }) {
  return <Badge variant={active ? "success" : "muted"}>{active ? "Active" : "Inactive"}</Badge>;
}

function discountDisplay(coupon: CouponDto): string {
  if (coupon.type === "PERCENTAGE" && coupon.percentOff !== null) {
    return `${coupon.percentOff}%`;
  }
  if (coupon.type === "FLAT" && coupon.amountOffCents !== null) {
    return `$${(coupon.amountOffCents / 100).toFixed(2)}`;
  }
  return "--";
}

function redemptionDisplay(coupon: CouponDto): string {
  if (coupon.maxRedemptions === null) return `${coupon.redeemedCount}/\u221E`;
  return `${coupon.redeemedCount}/${coupon.maxRedemptions}`;
}

function formatDate(d: Date | null): string {
  if (!d) return "Never";
  return new Date(d).toLocaleDateString();
}

// ---------------------------------------------------------------------------
// Columns
// ---------------------------------------------------------------------------

function buildColumns(
  onEdit: (c: CouponDto) => void,
  onDelete: (c: CouponDto) => void,
): ColumnDef<CouponDto, unknown>[] {
  return [
    { accessorKey: "code", header: "Code", enableSorting: true },
    {
      id: "discount",
      header: "Discount",
      cell: ({ row }) => discountDisplay(row.original),
    },
    {
      id: "redemptions",
      header: "Redemptions",
      cell: ({ row }) => redemptionDisplay(row.original),
    },
    {
      accessorKey: "endsAt",
      header: "Expires",
      cell: ({ row }) => formatDate(row.original.endsAt),
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
            onClick={() => onEdit(row.original)}
            className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-md p-1.5"
            aria-label={`Edit ${row.original.code}`}
          >
            <Pencil className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(row.original)}
            className="text-muted-foreground hover:text-destructive hover:bg-muted rounded-md p-1.5"
            aria-label={`Delete ${row.original.code}`}
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      ),
    },
  ];
}

// ---------------------------------------------------------------------------
// Create coupon dialog
// ---------------------------------------------------------------------------

function CreateCouponDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"PERCENTAGE" | "FLAT">("PERCENTAGE");
  const [discountValue, setDiscountValue] = useState("");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [loading, setLoading] = useState(false);

  function reset() {
    setCode("");
    setDiscountType("PERCENTAGE");
    setDiscountValue("");
    setMaxRedemptions("");
    setExpiresAt("");
  }

  async function handleSubmit() {
    setLoading(true);
    try {
      const val = parseFloat(discountValue);
      await adminCreateCoupon({
        code: code.toUpperCase(),
        type: discountType,
        currency: "usd",
        isActive: true,
        ...(discountType === "PERCENTAGE"
          ? { percentOff: val }
          : { amountOffCents: Math.round(val * 100) }),
        ...(maxRedemptions ? { maxRedemptions: parseInt(maxRedemptions, 10) } : {}),
        ...(expiresAt ? { endsAt: new Date(expiresAt) } : {}),
      });
      reset();
      onOpenChange(false);
    } catch {
      // Error handled by server action
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Coupon</DialogTitle>
          <DialogDescription>Add a new discount coupon.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="coupon-code">Code</Label>
            <Input
              id="coupon-code"
              placeholder="SUMMER20"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="discount-type">Type</Label>
            <select
              id="discount-type"
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value as "PERCENTAGE" | "FLAT")}
              className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground"
            >
              <option value="PERCENTAGE">Percentage</option>
              <option value="FLAT">Fixed Amount</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="discount-value">
              {discountType === "PERCENTAGE" ? "Percent Off" : "Amount ($)"}
            </Label>
            <Input
              id="discount-value"
              type="number"
              step={discountType === "PERCENTAGE" ? "1" : "0.01"}
              min="0"
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="max-redemptions">Max Redemptions (optional)</Label>
            <Input
              id="max-redemptions"
              type="number"
              min="1"
              placeholder="Unlimited"
              value={maxRedemptions}
              onChange={(e) => setMaxRedemptions(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="expires-at">Expires At (optional)</Label>
            <Input
              id="expires-at"
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
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
            disabled={loading || !code || !discountValue}
            onClick={handleSubmit}
            className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CouponsView({ coupons }: Props) {
  const [createOpen, setCreateOpen] = useState(false);

  const columns = buildColumns(
    (c) => console.log("TODO: edit coupon", c.id),
    (c) => console.log("TODO: delete coupon", c.id),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Coupons"
        description="Manage discount coupons."
        actions={
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium"
          >
            <Plus className="size-4" />
            Create Coupon
          </button>
        }
      />

      <DataTable
        columns={columns}
        data={coupons.items}
        searchKey="code"
        searchPlaceholder="Search coupons..."
      />

      <CreateCouponDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
