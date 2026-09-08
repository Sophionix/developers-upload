"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import type { AuditLogDto } from "@/lib/dto/admin-system";

type AuditLogRow = AuditLogDto;

const ACTION_BADGE_VARIANT = {
  CREATE: "success",
  DELETE: "destructive",
  UPDATE: "warning",
  LOGIN: "accent",
} as const;

function actionBadgeVariant(action: string) {
  return (ACTION_BADGE_VARIANT as Record<string, string>)[action] ?? "muted";
}

const columns: ColumnDef<AuditLogRow, unknown>[] = [
  {
    accessorKey: "action",
    header: "Action",
    cell: ({ row }) => (
      <Badge variant={actionBadgeVariant(row.original.action) as "success" | "destructive" | "warning" | "accent" | "muted"}>
        {row.original.action}
      </Badge>
    ),
  },
  {
    accessorKey: "entity",
    header: "Entity",
  },
  {
    accessorKey: "entityId",
    header: "Entity ID",
    cell: ({ row }) => row.original.entityId ?? "\u2014",
  },
  {
    accessorKey: "actorId",
    header: "Actor",
  },
  {
    accessorKey: "ip",
    header: "IP",
    cell: ({ row }) => row.original.ip ?? "\u2014",
  },
  {
    accessorKey: "createdAt",
    header: "Date",
    cell: ({ row }) =>
      new Date(row.original.createdAt).toLocaleString(),
  },
];

interface AuditViewProps {
  initialData: { items: AuditLogRow[]; nextCursor: string | null };
}

export function AuditView({ initialData }: AuditViewProps) {
  return (
    <div>
      <PageHeader
        title="Audit Logs"
        description="Read-only activity log of admin actions."
        crumbs={[
          { href: "/admin", label: "Admin" },
          { label: "Audit Logs" },
        ]}
      />

      <DataTable
        columns={columns}
        data={initialData.items}
        searchKey="entity"
        searchPlaceholder="Search by entity..."
        pageSize={10}
        emptyMessage="No audit logs found."
      />
    </div>
  );
}
