"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Layers } from "@/lib/ui/icons";
import type {
  AdminCardListDto,
  AdminDeckDto,
  AdminJourneyListDto,
  AdminPromptDto,
  AdminTaxonomyDto,
} from "@/lib/dto/admin-content";
import {
  DeleteDialog,
  TaxonomyDialog,
  DeckDialog,
  CardDialog,
  JourneyDialog,
  JourneyDaysDialog,
  PromptDialog,
} from "./content-dialogs";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

type Paginated<T> = { items: T[]; nextCursor: string | null };

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <Badge variant={active ? "success" : "muted"}>
      {active ? "Active" : "Inactive"}
    </Badge>
  );
}

function AccessBadge({ type }: { type: string }) {
  return (
    <Badge variant={type === "FREE" ? "success" : "accent"}>
      {type}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Tabs config
// ---------------------------------------------------------------------------

const TABS = [
  "cards",
  "decks",
  "journeys",
  "prompts",
  "categories",
  "tags",
  "themes",
] as const;

type TabKey = (typeof TABS)[number];

const TAB_LABELS: Record<TabKey, string> = {
  cards: "Cards",
  decks: "Decks",
  journeys: "Journeys",
  prompts: "Prompts",
  categories: "Categories",
  tags: "Tags",
  themes: "Themes",
};

const TAB_SINGULAR: Record<TabKey, string> = {
  cards: "Card",
  decks: "Deck",
  journeys: "Journey",
  prompts: "Prompt",
  categories: "Category",
  tags: "Tag",
  themes: "Theme",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type ContentViewProps = {
  cards: Paginated<AdminCardListDto>;
  decks: Paginated<AdminDeckDto>;
  journeys: Paginated<AdminJourneyListDto>;
  prompts: Paginated<AdminPromptDto>;
  categories: Paginated<AdminTaxonomyDto>;
  tags: Paginated<AdminTaxonomyDto>;
  themes: Paginated<AdminTaxonomyDto>;
};

type DialogState =
  | { type: "none" }
  | { type: "delete"; entityType: TabKey; entityId: string; entityName: string }
  | { type: "taxonomy"; entityType: "categories" | "tags" | "themes"; existing: AdminTaxonomyDto | null }
  | { type: "deck"; existing: AdminDeckDto | null }
  | { type: "card"; existing: AdminCardListDto | null }
  | { type: "journey"; existing: AdminJourneyListDto | null }
  | { type: "journey-days"; journey: AdminJourneyListDto }
  | { type: "prompt"; existing: AdminPromptDto | null };

export function ContentView({
  cards,
  decks,
  journeys,
  prompts,
  categories,
  tags,
  themes,
}: ContentViewProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("cards");
  const [dialog, setDialog] = useState<DialogState>({ type: "none" });

  const closeDialog = useCallback(() => setDialog({ type: "none" }), []);
  const refresh = useCallback(() => router.refresh(), [router]);

  const handleSaved = useCallback(() => {
    closeDialog();
    refresh();
  }, [closeDialog, refresh]);

  const handleCreate = () => {
    if (activeTab === "categories" || activeTab === "tags" || activeTab === "themes") {
      setDialog({ type: "taxonomy", entityType: activeTab, existing: null });
    } else if (activeTab === "decks") {
      setDialog({ type: "deck", existing: null });
    } else if (activeTab === "cards") {
      setDialog({ type: "card", existing: null });
    } else if (activeTab === "journeys") {
      setDialog({ type: "journey", existing: null });
    } else if (activeTab === "prompts") {
      setDialog({ type: "prompt", existing: null });
    }
  };

  // Action cell builders with dialog callbacks
  function makeActionCell<T extends { id: string }>(
    entityType: TabKey,
    getName: (row: T) => string,
  ) {
    return function ActionCell({ row }: { row: { original: T } }) {
      return (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              const item = row.original;
              if (entityType === "categories" || entityType === "tags" || entityType === "themes") {
                setDialog({ type: "taxonomy", entityType, existing: item as unknown as AdminTaxonomyDto });
              } else if (entityType === "decks") {
                setDialog({ type: "deck", existing: item as unknown as AdminDeckDto });
              } else if (entityType === "cards") {
                setDialog({ type: "card", existing: item as unknown as AdminCardListDto });
              } else if (entityType === "journeys") {
                setDialog({ type: "journey", existing: item as unknown as AdminJourneyListDto });
              } else if (entityType === "prompts") {
                setDialog({ type: "prompt", existing: item as unknown as AdminPromptDto });
              }
            }}
            className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={`Edit ${getName(row.original)}`}
          >
            <Pencil className="size-4" />
          </button>
          <button
            type="button"
            onClick={() =>
              setDialog({
                type: "delete",
                entityType,
                entityId: row.original.id,
                entityName: getName(row.original),
              })
            }
            className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
            aria-label={`Delete ${getName(row.original)}`}
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      );
    };
  }

  // Column definitions
  const cardColumns: ColumnDef<AdminCardListDto, unknown>[] = [
    { accessorKey: "title", header: "Title" },
    {
      accessorKey: "accessType",
      header: "Access",
      cell: ({ row }) => <AccessBadge type={row.original.accessType} />,
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => <ActiveBadge active={row.original.isActive} />,
    },
    { accessorKey: "sortOrder", header: "Order", enableSorting: false },
    {
      id: "actions",
      enableSorting: false,
      cell: makeActionCell<AdminCardListDto>("cards", (r) => r.title),
    },
  ];

  const deckColumns: ColumnDef<AdminDeckDto, unknown>[] = [
    { accessorKey: "title", header: "Title" },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => <ActiveBadge active={row.original.isActive} />,
    },
    { accessorKey: "sortOrder", header: "Order", enableSorting: false },
    {
      id: "actions",
      enableSorting: false,
      cell: makeActionCell<AdminDeckDto>("decks", (r) => r.title),
    },
  ];

  const journeyColumns: ColumnDef<AdminJourneyListDto, unknown>[] = [
    { accessorKey: "title", header: "Title" },
    { accessorKey: "durationDays", header: "Days", enableSorting: false },
    {
      accessorKey: "accessType",
      header: "Access",
      cell: ({ row }) => <AccessBadge type={row.original.accessType} />,
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => <ActiveBadge active={row.original.isActive} />,
    },
    {
      id: "actions",
      enableSorting: false,
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setDialog({ type: "journey-days", journey: item })}
              className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={`Manage days for ${item.title}`}
            >
              <Layers className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setDialog({ type: "journey", existing: item })}
              className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={`Edit ${item.title}`}
            >
              <Pencil className="size-4" />
            </button>
            <button
              type="button"
              onClick={() =>
                setDialog({
                  type: "delete",
                  entityType: "journeys",
                  entityId: item.id,
                  entityName: item.title,
                })
              }
              className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
              aria-label={`Delete ${item.title}`}
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        );
      },
    },
  ];

  const promptColumns: ColumnDef<AdminPromptDto, unknown>[] = [
    {
      accessorKey: "text",
      header: "Text",
      cell: ({ row }) => {
        const text = row.original.text;
        return text.length > 60 ? `${text.slice(0, 60)}...` : text;
      },
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => <Badge variant="secondary">{row.original.type}</Badge>,
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => <ActiveBadge active={row.original.isActive} />,
    },
    {
      id: "actions",
      enableSorting: false,
      cell: makeActionCell<AdminPromptDto>("prompts", () => "prompt"),
    },
  ];

  function buildTaxonomyColumns(entity: TabKey): ColumnDef<AdminTaxonomyDto, unknown>[] {
    return [
      { accessorKey: "name", header: "Name" },
      { accessorKey: "slug", header: "Slug", enableSorting: false },
      {
        id: "actions",
        enableSorting: false,
        cell: makeActionCell<AdminTaxonomyDto>(entity, (r) => r.name),
      },
    ];
  }

  const categoryColumns = buildTaxonomyColumns("categories");
  const tagColumns = buildTaxonomyColumns("tags");
  const themeColumns = buildTaxonomyColumns("themes");

  return (
    <div>
      <PageHeader
        title="Content Management"
        description="Manage cards, decks, journeys, and taxonomies."
        actions={
          <button
            type="button"
            onClick={handleCreate}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="size-4" />
            Create {TAB_SINGULAR[activeTab]}
          </button>
        }
      />

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as TabKey)}
      >
        <TabsList>
          {TABS.map((tab) => (
            <TabsTrigger key={tab} value={tab}>
              {TAB_LABELS[tab]}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="cards">
          <DataTable columns={cardColumns} data={cards.items} searchKey="title" searchPlaceholder="Search cards..." />
        </TabsContent>

        <TabsContent value="decks">
          <DataTable columns={deckColumns} data={decks.items} searchKey="title" searchPlaceholder="Search decks..." />
        </TabsContent>

        <TabsContent value="journeys">
          <DataTable columns={journeyColumns} data={journeys.items} searchKey="title" searchPlaceholder="Search journeys..." />
        </TabsContent>

        <TabsContent value="prompts">
          <DataTable columns={promptColumns} data={prompts.items} searchKey="text" searchPlaceholder="Search prompts..." />
        </TabsContent>

        <TabsContent value="categories">
          <DataTable columns={categoryColumns} data={categories.items} searchKey="name" searchPlaceholder="Search categories..." />
        </TabsContent>

        <TabsContent value="tags">
          <DataTable columns={tagColumns} data={tags.items} searchKey="name" searchPlaceholder="Search tags..." />
        </TabsContent>

        <TabsContent value="themes">
          <DataTable columns={themeColumns} data={themes.items} searchKey="name" searchPlaceholder="Search themes..." />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      {dialog.type === "delete" ? (
        <DeleteDialog
          open
          onOpenChange={(v) => { if (!v) closeDialog(); }}
          entityType={dialog.entityType}
          entityName={dialog.entityName}
          entityId={dialog.entityId}
          onDeleted={handleSaved}
        />
      ) : null}

      {dialog.type === "taxonomy" ? (
        <TaxonomyDialog
          open
          onOpenChange={(v) => { if (!v) closeDialog(); }}
          entityType={dialog.entityType}
          existing={dialog.existing}
          onSaved={handleSaved}
        />
      ) : null}

      {dialog.type === "deck" ? (
        <DeckDialog
          open
          onOpenChange={(v) => { if (!v) closeDialog(); }}
          existing={dialog.existing}
          onSaved={handleSaved}
        />
      ) : null}

      {dialog.type === "card" ? (
        <CardDialog
          open
          onOpenChange={(v) => { if (!v) closeDialog(); }}
          existing={dialog.existing}
          decks={decks.items}
          onSaved={handleSaved}
        />
      ) : null}

      {dialog.type === "journey" ? (
        <JourneyDialog
          open
          onOpenChange={(v) => { if (!v) closeDialog(); }}
          existing={dialog.existing}
          onSaved={handleSaved}
        />
      ) : null}

      {dialog.type === "journey-days" ? (
        <JourneyDaysDialog
          open
          onOpenChange={(v) => { if (!v) closeDialog(); }}
          journey={dialog.journey}
          onSaved={refresh}
        />
      ) : null}

      {dialog.type === "prompt" ? (
        <PromptDialog
          open
          onOpenChange={(v) => { if (!v) closeDialog(); }}
          existing={dialog.existing}
          onSaved={handleSaved}
        />
      ) : null}
    </div>
  );
}
