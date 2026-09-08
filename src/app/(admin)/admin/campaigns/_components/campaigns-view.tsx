"use client";

import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Send, BarChart3, Calendar } from "@/lib/ui/icons";
import type { CampaignDto, CampaignStatsDto, TemplateDto } from "@/lib/dto/admin-campaigns";
import { adminCreateCampaign, adminScheduleCampaign, adminSendCampaignNow, adminGetCampaignStats, adminListCampaigns } from "@/server/actions/admin/campaigns";
import { adminCreateTemplate, adminUpdateTemplate, adminDeleteTemplate, adminListTemplates } from "@/server/actions/admin/templates";

type Paginated<T> = { items: T[]; nextCursor: string | null };
type CDialog = "create" | "schedule" | "send" | "stats" | null;
type TDialog = "create" | "edit" | "delete" | null;

const SV = { DRAFT: "muted", SCHEDULED: "warning", SENT: "success", FAILED: "destructive" } as const;
const TV = { PUSH: "accent", EMAIL: "secondary" } as const;
const BTN = "border border-border text-foreground rounded-md px-4 py-2 text-sm";
const BTN_P = "bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50";
const BTN_D = "bg-destructive text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50";
const ICON_BTN = "text-muted-foreground hover:text-foreground hover:bg-muted rounded-md p-1.5";
const fmtDate = (d: Date | null) => (d ? new Date(d).toLocaleDateString() : "\u2014");

interface Props { campaigns: Paginated<CampaignDto>; templates: Paginated<TemplateDto> }

export function CampaignsView({ campaigns: initC, templates: initT }: Props) {
  const [tab, setTab] = useState<"campaigns" | "templates">("campaigns");
  const [campaigns, setCampaigns] = useState(initC.items);
  const [templates, setTemplates] = useState(initT.items);
  const [loading, setLoading] = useState(false);
  const [cDlg, setCDlg] = useState<CDialog>(null);
  const [selC, setSelC] = useState<CampaignDto | null>(null);
  const [schedDate, setSchedDate] = useState("");
  const [stats, setStats] = useState<CampaignStatsDto | null>(null);
  const [cName, setCName] = useState("");
  const [cTplId, setCTplId] = useState("");
  const [cCh, setCCh] = useState<"PUSH" | "EMAIL">("PUSH");
  const [cSAt, setCSAt] = useState("");
  const [tDlg, setTDlg] = useState<TDialog>(null);
  const [selT, setSelT] = useState<TemplateDto | null>(null);
  const [tSlug, setTSlug] = useState("");
  const [tType, setTType] = useState<"PUSH" | "EMAIL">("PUSH");
  const [tSubj, setTSubj] = useState("");
  const [tTitle, setTTitle] = useState("");
  const [tBody, setTBody] = useState("");
  const [tVars, setTVars] = useState("");

  const refresh = async () => { const [c, t] = await Promise.all([adminListCampaigns({ take: 50 }), adminListTemplates({ take: 50 })]); setCampaigns(c.items); setTemplates(t.items); };
  const closeCDlg = () => { setCDlg(null); setSelC(null); setSchedDate(""); setStats(null); };
  const closeTDlg = () => { setTDlg(null); setSelT(null); setTSlug(""); setTType("PUSH"); setTSubj(""); setTTitle(""); setTBody(""); setTVars(""); };
  const resetCForm = () => { setCName(""); setCTplId(""); setCCh("PUSH"); setCSAt(""); };
  const parseVars = () => tVars ? tVars.split(",").map((v) => v.trim()).filter(Boolean) : [];

  const wrap = async (fn: () => Promise<void>) => { setLoading(true); try { await fn(); } finally { setLoading(false); } };

  const handleCreateCampaign = () => wrap(async () => {
    await adminCreateCampaign({ name: cName, templateId: cTplId, channel: cCh, segment: {}, ...(cSAt ? { scheduledAt: new Date(cSAt) } : {}) });
    await refresh(); resetCForm(); closeCDlg();
  });
  const handleSchedule = () => wrap(async () => { await adminScheduleCampaign({ id: selC!.id, scheduledAt: new Date(schedDate) }); await refresh(); closeCDlg(); });
  const handleSendNow = () => wrap(async () => { await adminSendCampaignNow({ id: selC!.id }); await refresh(); closeCDlg(); });
  const handleShowStats = async (c: CampaignDto) => { setSelC(c); setCDlg("stats"); setStats(await adminGetCampaignStats({ id: c.id })); };
  const handleCreateTpl = () => wrap(async () => { await adminCreateTemplate({ slug: tSlug, type: tType, subject: tSubj || undefined, title: tTitle || undefined, body: tBody, variables: parseVars() }); await refresh(); closeTDlg(); });
  const handleUpdateTpl = () => wrap(async () => { await adminUpdateTemplate({ id: selT!.id, slug: tSlug, type: tType, subject: tSubj || undefined, title: tTitle || undefined, body: tBody, variables: parseVars() }); await refresh(); closeTDlg(); });
  const handleDeleteTpl = () => wrap(async () => { await adminDeleteTemplate({ id: selT!.id }); await refresh(); closeTDlg(); });

  const openEditTpl = (t: TemplateDto) => {
    setSelT(t); setTSlug(t.slug); setTType(t.type as "PUSH" | "EMAIL");
    setTSubj(t.subject ?? ""); setTTitle(t.title ?? ""); setTBody(t.body); setTVars(t.variables.join(", ")); setTDlg("edit");
  };

  const campaignCols: ColumnDef<CampaignDto, unknown>[] = [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "type", header: "Type", cell: ({ row }) => <Badge variant={TV[row.original.type as keyof typeof TV] ?? "muted"}>{row.original.type}</Badge> },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <Badge variant={SV[row.original.status as keyof typeof SV] ?? "muted"}>{row.original.status}</Badge> },
    { accessorKey: "scheduledAt", header: "Scheduled", cell: ({ row }) => fmtDate(row.original.scheduledAt) },
    { accessorKey: "sentAt", header: "Sent", cell: ({ row }) => fmtDate(row.original.sentAt) },
    { id: "actions", enableSorting: false, cell: ({ row }) => {
      const c = row.original; const draft = c.status === "DRAFT";
      return (<div className="flex items-center gap-1">
        {draft && <button type="button" onClick={() => { setSelC(c); setCDlg("schedule"); }} className={ICON_BTN} aria-label="Schedule"><Calendar className="h-4 w-4" /></button>}
        {draft && <button type="button" onClick={() => { setSelC(c); setCDlg("send"); }} className={ICON_BTN} aria-label="Send Now"><Send className="h-4 w-4" /></button>}
        <button type="button" onClick={() => handleShowStats(c)} className={ICON_BTN} aria-label="Stats"><BarChart3 className="h-4 w-4" /></button>
      </div>);
    }},
  ];

  const templateCols: ColumnDef<TemplateDto, unknown>[] = [
    { accessorKey: "slug", header: "Slug" },
    { accessorKey: "type", header: "Type", cell: ({ row }) => <Badge variant={TV[row.original.type as keyof typeof TV] ?? "muted"}>{row.original.type}</Badge> },
    { accessorKey: "subject", header: "Subject", cell: ({ row }) => row.original.subject ?? "\u2014" },
    { accessorKey: "body", header: "Body", cell: ({ row }) => row.original.body.length > 60 ? `${row.original.body.slice(0, 60)}...` : row.original.body },
    { accessorKey: "variables", header: "Variables", cell: ({ row }) => row.original.variables.length > 0 ? row.original.variables.join(", ") : "\u2014" },
    { id: "actions", enableSorting: false, cell: ({ row }) => (<div className="flex items-center gap-1">
      <button type="button" onClick={() => openEditTpl(row.original)} className={ICON_BTN} aria-label="Edit"><Pencil className="h-4 w-4" /></button>
      <button type="button" onClick={() => { setSelT(row.original); setTDlg("delete"); }} className={ICON_BTN} aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
    </div>)},
  ];

  return (
    <div>
      <PageHeader title="Campaigns" description="Manage notification campaigns and templates."
        crumbs={[{ href: "/admin", label: "Admin" }, { label: "Campaigns" }]}
        actions={<button type="button" onClick={() => { if (tab === "campaigns") { resetCForm(); setCDlg("create"); } else { closeTDlg(); setTDlg("create"); } }} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"><Plus className="size-4" />{tab === "campaigns" ? "Create Campaign" : "Create Template"}</button>} />
      <Tabs value={tab} onValueChange={(v) => setTab(v as "campaigns" | "templates")}>
        <TabsList><TabsTrigger value="campaigns">Campaigns</TabsTrigger><TabsTrigger value="templates">Templates</TabsTrigger></TabsList>
        <TabsContent value="campaigns"><DataTable columns={campaignCols} data={campaigns} searchKey="name" searchPlaceholder="Search campaigns..." /></TabsContent>
        <TabsContent value="templates"><DataTable columns={templateCols} data={templates} searchKey="slug" searchPlaceholder="Search templates..." /></TabsContent>
      </Tabs>

      {/* Create Campaign */}
      <Dialog open={cDlg === "create"} onOpenChange={() => closeCDlg()}><DialogContent>
        <DialogHeader><DialogTitle>Create Campaign</DialogTitle><DialogDescription>Set up a new notification campaign.</DialogDescription></DialogHeader>
        <div className="space-y-3 py-2">
          <Input placeholder="Campaign name" value={cName} onChange={(e) => setCName(e.target.value)} />
          <Select value={cTplId} onValueChange={setCTplId}><SelectTrigger><SelectValue placeholder="Select template" /></SelectTrigger><SelectContent>{templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.slug}</SelectItem>)}</SelectContent></Select>
          <Select value={cCh} onValueChange={(v) => setCCh(v as "PUSH" | "EMAIL")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PUSH">Push</SelectItem><SelectItem value="EMAIL">Email</SelectItem></SelectContent></Select>
          <Input type="datetime-local" value={cSAt} onChange={(e) => setCSAt(e.target.value)} />
        </div>
        <DialogFooter><button type="button" onClick={closeCDlg} className={BTN}>Cancel</button><button type="button" onClick={handleCreateCampaign} disabled={loading || !cName || !cTplId} className={BTN_P}>{loading ? "Creating..." : "Create"}</button></DialogFooter>
      </DialogContent></Dialog>

      {/* Schedule */}
      <Dialog open={cDlg === "schedule"} onOpenChange={() => closeCDlg()}><DialogContent>
        <DialogHeader><DialogTitle>Schedule Campaign</DialogTitle><DialogDescription>Pick a date and time to send &ldquo;{selC?.name}&rdquo;.</DialogDescription></DialogHeader>
        <div className="py-2"><Input type="datetime-local" value={schedDate} onChange={(e) => setSchedDate(e.target.value)} /></div>
        <DialogFooter><button type="button" onClick={closeCDlg} className={BTN}>Cancel</button><button type="button" onClick={handleSchedule} disabled={loading || !schedDate} className={BTN_P}>{loading ? "Scheduling..." : "Schedule"}</button></DialogFooter>
      </DialogContent></Dialog>

      {/* Send Now */}
      <Dialog open={cDlg === "send"} onOpenChange={() => closeCDlg()}><DialogContent>
        <DialogHeader><DialogTitle>Send Now</DialogTitle><DialogDescription>Send &ldquo;{selC?.name}&rdquo; immediately? This cannot be undone.</DialogDescription></DialogHeader>
        <DialogFooter><button type="button" onClick={closeCDlg} className={BTN}>Cancel</button><button type="button" onClick={handleSendNow} disabled={loading} className={BTN_P}>{loading ? "Sending..." : "Send Now"}</button></DialogFooter>
      </DialogContent></Dialog>

      {/* Stats */}
      <Dialog open={cDlg === "stats"} onOpenChange={() => closeCDlg()}><DialogContent>
        <DialogHeader><DialogTitle>Campaign Stats</DialogTitle><DialogDescription>{selC?.name}</DialogDescription></DialogHeader>
        {stats ? (<div className="space-y-2 py-2 text-sm">
          <p><span className="text-muted-foreground">Total sent:</span> {stats.total}</p>
          {Object.entries(stats.byStatus).map(([k, v]) => <p key={k}><span className="text-muted-foreground">{k}:</span> {v}</p>)}
        </div>) : <p className="py-4 text-center text-sm text-muted-foreground">Loading...</p>}
        <DialogFooter><button type="button" onClick={closeCDlg} className={BTN}>Close</button></DialogFooter>
      </DialogContent></Dialog>

      {/* Create / Edit Template */}
      <Dialog open={tDlg === "create" || tDlg === "edit"} onOpenChange={() => closeTDlg()}><DialogContent>
        <DialogHeader><DialogTitle>{tDlg === "edit" ? "Edit Template" : "Create Template"}</DialogTitle><DialogDescription>{tDlg === "edit" ? "Update the template details." : "Define a new notification template."}</DialogDescription></DialogHeader>
        <div className="space-y-3 py-2">
          <Input placeholder="Slug" value={tSlug} onChange={(e) => setTSlug(e.target.value)} />
          <Select value={tType} onValueChange={(v) => setTType(v as "PUSH" | "EMAIL")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PUSH">Push</SelectItem><SelectItem value="EMAIL">Email</SelectItem></SelectContent></Select>
          <Input placeholder="Subject (optional)" value={tSubj} onChange={(e) => setTSubj(e.target.value)} />
          <Input placeholder="Title (optional)" value={tTitle} onChange={(e) => setTTitle(e.target.value)} />
          <textarea placeholder="Body" value={tBody} onChange={(e) => setTBody(e.target.value)} rows={4} className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          <Input placeholder="Variables (comma-separated)" value={tVars} onChange={(e) => setTVars(e.target.value)} />
        </div>
        <DialogFooter><button type="button" onClick={closeTDlg} className={BTN}>Cancel</button><button type="button" onClick={tDlg === "edit" ? handleUpdateTpl : handleCreateTpl} disabled={loading || !tSlug || !tBody} className={BTN_P}>{loading ? "Saving..." : tDlg === "edit" ? "Update" : "Create"}</button></DialogFooter>
      </DialogContent></Dialog>

      {/* Delete Template */}
      <Dialog open={tDlg === "delete"} onOpenChange={() => closeTDlg()}><DialogContent>
        <DialogHeader><DialogTitle>Delete Template</DialogTitle><DialogDescription>Are you sure you want to delete &ldquo;{selT?.slug}&rdquo;? This cannot be undone.</DialogDescription></DialogHeader>
        <DialogFooter><button type="button" onClick={closeTDlg} className={BTN}>Cancel</button><button type="button" onClick={handleDeleteTpl} disabled={loading} className={BTN_D}>{loading ? "Deleting..." : "Delete"}</button></DialogFooter>
      </DialogContent></Dialog>
    </div>
  );
}
