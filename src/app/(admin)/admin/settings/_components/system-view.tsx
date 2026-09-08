"use client";

import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil } from "@/lib/ui/icons";
import { cn } from "@/lib/ui/cn";
import { adminUpdateSetting } from "@/server/actions/admin/settings";
import { adminUpsertFeatureFlag } from "@/server/actions/admin/flags";
import { adminCreateAdmin } from "@/server/actions/admin/admins";
import type { SettingDto, FeatureFlagDto, AdminListDto } from "@/lib/dto/admin-system";

const INPUT_CLS = "mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary";
const BTN_CANCEL = "rounded-md border border-border px-4 py-2 text-sm text-foreground";
const BTN_PRIMARY = "rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50";

type Props = {
  settings: SettingDto[];
  flags: { items: FeatureFlagDto[]; nextCursor: string | null };
  admins: { items: AdminListDto[]; nextCursor: string | null };
};

type TabKey = "settings" | "flags" | "admins";
type DialogState =
  | null
  | { kind: "edit-setting"; setting: SettingDto }
  | { kind: "flag"; flag: FeatureFlagDto | null }
  | { kind: "create-admin" };

const ROLE_BADGE: Record<string, "destructive" | "accent"> = {
  SUPER_ADMIN: "destructive",
  CONTENT_MANAGER: "accent",
};

export function SystemView({ settings: initSettings, flags, admins }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>("settings");
  const [dialog, setDialog] = useState<DialogState>(null);
  const [loading, setLoading] = useState(false);

  // --- Settings state ---
  const [settingItems, setSettingItems] = useState(initSettings);
  const [jsonValue, setJsonValue] = useState("");

  const [flagItems, setFlagItems] = useState(flags.items);
  const [flagKey, setFlagKey] = useState("");
  const [flagEnabled, setFlagEnabled] = useState(true);
  const [flagPct, setFlagPct] = useState(100);

  const [adminItems, setAdminItems] = useState(admins.items);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminRole, setAdminRole] = useState<"SUPER_ADMIN" | "CONTENT_MANAGER">("CONTENT_MANAGER");

  function closeDialog() { setDialog(null); }

  function openEditSetting(s: SettingDto) {
    setJsonValue(JSON.stringify(s.value, null, 2));
    setDialog({ kind: "edit-setting", setting: s });
  }
  async function saveSetting() {
    if (dialog?.kind !== "edit-setting") return;
    setLoading(true);
    try {
      const parsed: unknown = JSON.parse(jsonValue);
      const updated = await adminUpdateSetting({ key: dialog.setting.key, value: parsed });
      setSettingItems((prev) => prev.map((s) => (s.key === updated.key ? updated : s)));
      closeDialog();
    } finally { setLoading(false); }
  }

  function openCreateFlag() {
    setFlagKey(""); setFlagEnabled(true); setFlagPct(100);
    setDialog({ kind: "flag", flag: null });
  }
  function openEditFlag(f: FeatureFlagDto) {
    setFlagKey(f.key); setFlagEnabled(f.isEnabled); setFlagPct(f.rolloutPercentage);
    setDialog({ kind: "flag", flag: f });
  }
  async function toggleFlag(f: FeatureFlagDto) {
    const updated = await adminUpsertFeatureFlag({ key: f.key, isEnabled: !f.isEnabled, rolloutPercentage: f.rolloutPercentage });
    setFlagItems((prev) => prev.map((x) => (x.key === updated.key ? updated : x)));
  }
  async function saveFlag() {
    if (!flagKey.trim()) return;
    setLoading(true);
    try {
      const updated = await adminUpsertFeatureFlag({ key: flagKey.trim(), isEnabled: flagEnabled, rolloutPercentage: flagPct });
      setFlagItems((prev) => {
        const exists = prev.find((x) => x.key === updated.key);
        return exists ? prev.map((x) => (x.key === updated.key ? updated : x)) : [...prev, updated];
      });
      closeDialog();
    } finally { setLoading(false); }
  }

  function openCreateAdmin() {
    setAdminEmail(""); setAdminName(""); setAdminRole("CONTENT_MANAGER");
    setDialog({ kind: "create-admin" });
  }
  async function createAdmin() {
    if (!adminEmail.trim() || !adminName.trim()) return;
    setLoading(true);
    try {
      const created = await adminCreateAdmin({ email: adminEmail.trim(), fullName: adminName.trim(), role: adminRole });
      setAdminItems((prev) => [created, ...prev]);
      closeDialog();
    } finally { setLoading(false); }
  }

  const flagColumns: ColumnDef<FeatureFlagDto, unknown>[] = [
    { accessorKey: "key", header: "Key", cell: ({ row }) => <span className="font-mono text-sm">{row.original.key}</span> },
    { accessorKey: "isEnabled", header: "Enabled", cell: ({ row }) => (
      <button type="button" onClick={() => toggleFlag(row.original)}>
        <Badge variant={row.original.isEnabled ? "success" : "muted"}>{row.original.isEnabled ? "ON" : "OFF"}</Badge>
      </button>
    )},
    { accessorKey: "rolloutPercentage", header: "Rollout", cell: ({ row }) => <span className="text-sm">{row.original.rolloutPercentage}%</span> },
    { accessorKey: "updatedAt", header: "Updated", cell: ({ row }) => new Date(row.original.updatedAt).toLocaleDateString() },
    { id: "actions", enableSorting: false, cell: ({ row }) => (
      <button type="button" onClick={() => openEditFlag(row.original)} className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Edit ${row.original.key}`}>
        <Pencil className="size-4" />
      </button>
    )},
  ];

  const adminColumns: ColumnDef<AdminListDto, unknown>[] = [
    { accessorKey: "fullName", header: "Name" },
    { accessorKey: "email", header: "Email" },
    { accessorKey: "role", header: "Role", cell: ({ row }) => <Badge variant={ROLE_BADGE[row.original.role] ?? "muted"}>{row.original.role.replace(/_/g, " ")}</Badge> },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <Badge variant={row.original.status === "ACTIVE" ? "success" : "muted"}>{row.original.status}</Badge> },
    { accessorKey: "totpEnabled", header: "2FA", cell: ({ row }) => <Badge variant={row.original.totpEnabled ? "success" : "muted"}>{row.original.totpEnabled ? "Yes" : "No"}</Badge> },
    { accessorKey: "lastLoginAt", header: "Last Login", cell: ({ row }) => row.original.lastLoginAt ? new Date(row.original.lastLoginAt).toLocaleDateString() : "Never" },
    { accessorKey: "createdAt", header: "Created", cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString() },
  ];

  const headerAction = activeTab === "flags" ? (
    <button type="button" onClick={openCreateFlag} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
      <Plus className="size-4" /> Create Flag
    </button>
  ) : activeTab === "admins" ? (
    <button type="button" onClick={openCreateAdmin} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
      <Plus className="size-4" /> Create Admin
    </button>
  ) : undefined;

  return (
    <div>
      <PageHeader title="System Settings" description="Manage settings, feature flags, and admin accounts." actions={headerAction} />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)}>
        <TabsList>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="flags">Feature Flags</TabsTrigger>
          <TabsTrigger value="admins">Admins</TabsTrigger>
        </TabsList>

        <TabsContent value="settings">
          <Card>
            <CardContent className="divide-y divide-border p-0">
              {settingItems.map((s) => (
                <div key={s.key} className="flex items-center justify-between gap-4 px-4 py-3">
                  <span className="font-mono text-sm text-foreground">{s.key}</span>
                  <div className="flex items-center gap-2">
                    <span className="max-w-xs truncate text-sm text-muted-foreground">{JSON.stringify(s.value)}</span>
                    <button type="button" onClick={() => openEditSetting(s)} className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Edit ${s.key}`}>
                      <Pencil className="size-4" />
                    </button>
                  </div>
                </div>
              ))}
              {settingItems.length === 0 && <p className="px-4 py-6 text-center text-sm text-muted-foreground">No settings found.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="flags">
          <DataTable columns={flagColumns} data={flagItems} searchKey="key" searchPlaceholder="Search flags..." />
        </TabsContent>

        <TabsContent value="admins">
          <DataTable columns={adminColumns} data={adminItems} searchKey="email" searchPlaceholder="Search by email..." />
        </TabsContent>
      </Tabs>

      <Dialog open={dialog?.kind === "edit-setting"} onOpenChange={closeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Setting</DialogTitle>
            <DialogDescription>Update the value for this setting key.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div><label className="text-xs text-muted-foreground">Key</label><p className="font-mono text-sm">{dialog?.kind === "edit-setting" ? dialog.setting.key : ""}</p></div>
            <div><label className="text-xs text-muted-foreground">Value (JSON)</label><textarea value={jsonValue} onChange={(e) => setJsonValue(e.target.value)} rows={6} className="mt-1 w-full rounded-md border border-border bg-card p-3 font-mono text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" /></div>
          </div>
          <DialogFooter>
            <button type="button" onClick={closeDialog} className={BTN_CANCEL}>Cancel</button>
            <button type="button" onClick={saveSetting} disabled={loading} className={BTN_PRIMARY}>{loading ? "Saving..." : "Save"}</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog?.kind === "flag"} onOpenChange={closeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog?.kind === "flag" && dialog.flag ? "Edit" : "Create"} Feature Flag</DialogTitle>
            <DialogDescription>{dialog?.kind === "flag" && dialog.flag ? `Update flag: ${dialog.flag.key}` : "Add a new feature flag."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div><label className="text-xs text-muted-foreground">Key</label><input value={flagKey} onChange={(e) => setFlagKey(e.target.value)} disabled={dialog?.kind === "flag" && !!dialog.flag} className={cn(INPUT_CLS, "disabled:opacity-50")} /></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={flagEnabled} onChange={(e) => setFlagEnabled(e.target.checked)} className="size-4 rounded border-border" />Enabled</label>
            <div><label className="text-xs text-muted-foreground">Rollout Percentage (0-100)</label><input type="number" min={0} max={100} value={flagPct} onChange={(e) => setFlagPct(Number(e.target.value))} className={INPUT_CLS} /></div>
          </div>
          <DialogFooter>
            <button type="button" onClick={closeDialog} className={BTN_CANCEL}>Cancel</button>
            <button type="button" onClick={saveFlag} disabled={loading} className={BTN_PRIMARY}>{loading ? "Saving..." : "Save"}</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog?.kind === "create-admin"} onOpenChange={closeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Admin</DialogTitle>
            <DialogDescription>Invite a new admin user. They will receive an email invite.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div><label className="text-xs text-muted-foreground">Email</label><input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} className={INPUT_CLS} /></div>
            <div><label className="text-xs text-muted-foreground">Full Name</label><input value={adminName} onChange={(e) => setAdminName(e.target.value)} className={INPUT_CLS} /></div>
            <div><label className="text-xs text-muted-foreground">Role</label><Select value={adminRole} onValueChange={(v) => setAdminRole(v as "SUPER_ADMIN" | "CONTENT_MANAGER")}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="SUPER_ADMIN">Super Admin</SelectItem><SelectItem value="CONTENT_MANAGER">Content Manager</SelectItem></SelectContent></Select></div>
          </div>
          <DialogFooter>
            <button type="button" onClick={closeDialog} className={BTN_CANCEL}>Cancel</button>
            <button type="button" onClick={createAdmin} disabled={loading} className={BTN_PRIMARY}>{loading ? "Creating..." : "Create"}</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
