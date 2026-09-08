"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Eye, MoreHorizontal, Shield, Trash2 } from "@/lib/ui/icons";
import type { ColumnDef } from "@tanstack/react-table";
import type { AdminUserListDto } from "@/lib/dto/admin-user";
import {
  adminAssignRole,
  adminDeactivateUser,
  adminReactivateUser,
  adminSoftDeleteUser,
  adminListUsers,
} from "@/server/actions/admin/users";

type UserRow = AdminUserListDto;

const ROLE_BADGE_VARIANT = {
  SUPER_ADMIN: "destructive",
  CONTENT_MANAGER: "accent",
  USER: "muted",
} as const;

const STATUS_BADGE_VARIANT = {
  ACTIVE: "success",
  DEACTIVATED: "warning",
  PENDING_DELETION: "destructive",
} as const;

type DialogType = "role" | "deactivate" | "delete" | null;

interface UsersViewProps {
  initialData: { items: UserRow[]; nextCursor: string | null };
}

export function UsersView({ initialData }: UsersViewProps) {
  const router = useRouter();
  const [users, setUsers] = useState(initialData.items);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [dialogType, setDialogType] = useState<DialogType>(null);
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>("");

  function openDialog(user: UserRow, type: DialogType) {
    setSelectedUser(user);
    setDialogType(type);
    if (type === "role") setSelectedRole(user.role);
  }

  function closeDialog() {
    setSelectedUser(null);
    setDialogType(null);
    setSelectedRole("");
  }

  async function refreshUsers() {
    const data = await adminListUsers({ take: 50, sortBy: "createdAt", sortDir: "desc" });
    setUsers(data.items);
  }

  async function handleAssignRole() {
    if (!selectedUser || !selectedRole) return;
    setLoading(true);
    try {
      await adminAssignRole({ id: selectedUser.id, role: selectedRole as "USER" | "CONTENT_MANAGER" | "SUPER_ADMIN" });
      await refreshUsers();
      closeDialog();
    } finally {
      setLoading(false);
    }
  }

  async function handleDeactivate() {
    if (!selectedUser) return;
    setLoading(true);
    try {
      if (selectedUser.status === "DEACTIVATED") {
        await adminReactivateUser({ id: selectedUser.id });
      } else {
        await adminDeactivateUser({ id: selectedUser.id });
      }
      await refreshUsers();
      closeDialog();
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!selectedUser) return;
    setLoading(true);
    try {
      await adminSoftDeleteUser({ id: selectedUser.id });
      await refreshUsers();
      closeDialog();
    } finally {
      setLoading(false);
    }
  }

  const columns: ColumnDef<UserRow, unknown>[] = [
    {
      accessorKey: "fullName",
      header: "Name",
      enableSorting: true,
      cell: ({ row }) => row.original.fullName || row.original.email,
    },
    {
      accessorKey: "email",
      header: "Email",
    },
    {
      accessorKey: "role",
      header: "Role",
      cell: ({ row }) => {
        const role = row.original.role;
        return (
          <Badge variant={ROLE_BADGE_VARIANT[role] ?? "muted"}>
            {role.replace(/_/g, " ")}
          </Badge>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.original.status;
        return (
          <Badge variant={STATUS_BADGE_VARIANT[status] ?? "muted"}>
            {status.replace(/_/g, " ")}
          </Badge>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
    },
    {
      accessorKey: "lastLoginAt",
      header: "Last Login",
      cell: ({ row }) =>
        row.original.lastLoginAt
          ? new Date(row.original.lastLoginAt).toLocaleDateString()
          : "Never",
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => {
        const user = row.original;
        const isDeactivated = user.status === "DEACTIVATED";
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-md p-1.5"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => router.push(`/admin/users/${user.id}`)}>
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openDialog(user, "role")}>
                <Shield className="mr-2 h-4 w-4" />
                Assign Role
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openDialog(user, "deactivate")}>
                {isDeactivated ? "Reactivate" : "Deactivate"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => openDialog(user, "delete")}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="Users"
        description="Manage user accounts, roles, and access."
        crumbs={[
          { href: "/admin", label: "Admin" },
          { label: "Users" },
        ]}
      />

      <DataTable
        columns={columns}
        data={users}
        searchKey="email"
        searchPlaceholder="Search by email..."
        pageSize={10}
      />

      {/* Role Assignment Dialog */}
      <Dialog open={dialogType === "role"} onOpenChange={() => closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Role</DialogTitle>
            <DialogDescription>
              Change role for {selectedUser?.fullName || selectedUser?.email}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USER">User</SelectItem>
                <SelectItem value="CONTENT_MANAGER">Content Manager</SelectItem>
                <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={closeDialog}
              className="border border-border text-foreground rounded-md px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAssignRole}
              disabled={loading || selectedRole === selectedUser?.role}
              className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {loading ? "Saving..." : "Confirm"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate / Reactivate Dialog */}
      <Dialog open={dialogType === "deactivate"} onOpenChange={() => closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedUser?.status === "DEACTIVATED" ? "Reactivate" : "Deactivate"} User
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to{" "}
              {selectedUser?.status === "DEACTIVATED" ? "reactivate" : "deactivate"}{" "}
              {selectedUser?.fullName || selectedUser?.email}?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              onClick={closeDialog}
              className="border border-border text-foreground rounded-md px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeactivate}
              disabled={loading}
              className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {loading ? "Processing..." : "Confirm"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={dialogType === "delete"} onOpenChange={() => closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              This will soft-delete {selectedUser?.fullName || selectedUser?.email}.
              This action can be reversed by a database administrator.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              onClick={closeDialog}
              className="border border-border text-foreground rounded-md px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading}
              className="bg-destructive text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {loading ? "Deleting..." : "Delete"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
