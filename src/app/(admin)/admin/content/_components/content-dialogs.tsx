"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { Loader2, Plus, Pencil, Trash2, ChevronUp, ChevronDown } from "@/lib/ui/icons";
import { ImageUploader } from "@/components/ui/image-uploader";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/multi-select";

import {
  adminCreateDeck,
  adminUpdateDeck,
  adminDeleteDeck,
} from "@/server/actions/admin/decks";
import {
  adminCreateCard,
  adminUpdateCard,
  adminDeleteCard,
  adminGetCard,
} from "@/server/actions/admin/cards";
import {
  adminCreateJourney,
  adminUpdateJourney,
  adminDeleteJourney,
  adminListJourneyDays,
  adminUpsertJourneyDay,
  adminDeleteJourneyDay,
  adminReorderJourneyDays,
} from "@/server/actions/admin/journeys";
import { adminListCards } from "@/server/actions/admin/cards";
import {
  adminCreatePrompt,
  adminUpdatePrompt,
  adminDeletePrompt,
} from "@/server/actions/admin/prompts";
import {
  adminCreateCategory,
  adminUpdateCategory,
  adminDeleteCategory,
  adminListCategories,
} from "@/server/actions/admin/categories";
import {
  adminCreateTag,
  adminUpdateTag,
  adminDeleteTag,
  adminListTags,
} from "@/server/actions/admin/tags";
import {
  adminCreateTheme,
  adminUpdateTheme,
  adminDeleteTheme,
  adminListThemes,
} from "@/server/actions/admin/themes";

import type {
  AdminCardListDto,
  AdminDeckDto,
  AdminJourneyDayDto,
  AdminJourneyListDto,
  AdminPromptDto,
  AdminTaxonomyDto,
} from "@/lib/dto/admin-content";

// ---------------------------------------------------------------------------
// Shared form field components
// ---------------------------------------------------------------------------

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}

const inputCx =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/40";
const selectCx = `${inputCx} appearance-none`;
const textareaCx = `${inputCx} resize-none`;

// ---------------------------------------------------------------------------
// Delete confirmation dialog (shared by all entity types)
// ---------------------------------------------------------------------------

export function DeleteDialog({
  open,
  onOpenChange,
  entityType,
  entityName,
  entityId,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  entityType: string;
  entityName: string;
  entityId: string;
  onDeleted: () => void;
}) {
  const [pending, startTransition] = useTransition();

  const deleteFns: Record<string, (input: { id: string }) => Promise<unknown>> =
    {
      cards: adminDeleteCard,
      decks: adminDeleteDeck,
      journeys: adminDeleteJourney,
      prompts: adminDeletePrompt,
      categories: adminDeleteCategory,
      tags: adminDeleteTag,
      themes: adminDeleteTheme,
    };

  const handleDelete = () => {
    const fn = deleteFns[entityType];
    if (!fn) return;
    startTransition(async () => {
      try {
        await fn({ id: entityId });
        toast.success(`${entityName} deleted.`);
        onOpenChange(false);
        onDeleted();
      } catch {
        toast.error(`Failed to delete ${entityName}.`);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {entityName}?</DialogTitle>
          <DialogDescription>
            This action cannot be undone. Are you sure you want to delete &quot;{entityName}&quot;?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={pending}
          >
            {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Taxonomy dialog (categories, tags, themes — same form)
// ---------------------------------------------------------------------------

export function TaxonomyDialog({
  open,
  onOpenChange,
  entityType,
  existing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  entityType: "categories" | "tags" | "themes";
  existing: AdminTaxonomyDto | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? "");
  const [slug, setSlug] = useState(existing?.slug ?? "");
  const [pending, startTransition] = useTransition();

  const isEdit = !!existing;
  const label =
    entityType === "categories"
      ? "Category"
      : entityType === "tags"
        ? "Tag"
        : "Theme";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name is required.");
      return;
    }
    startTransition(async () => {
      try {
        if (isEdit) {
          const updateFn =
            entityType === "categories"
              ? adminUpdateCategory
              : entityType === "tags"
                ? adminUpdateTag
                : adminUpdateTheme;
          await updateFn({
            id: existing.id,
            name: name.trim(),
            ...(slug.trim() ? { slug: slug.trim() } : {}),
          });
        } else {
          const createFn =
            entityType === "categories"
              ? adminCreateCategory
              : entityType === "tags"
                ? adminCreateTag
                : adminCreateTheme;
          await createFn({
            name: name.trim(),
            ...(slug.trim() ? { slug: slug.trim() } : {}),
          });
        }
        toast.success(`${label} ${isEdit ? "updated" : "created"}.`);
        onOpenChange(false);
        onSaved();
      } catch {
        toast.error(`Failed to ${isEdit ? "update" : "create"} ${label.toLowerCase()}.`);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit" : "Create"} {label}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Name">
            <input
              className={inputCx}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`${label} name`}
              required
            />
          </Field>
          <Field label="Slug (optional)">
            <input
              className={inputCx}
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="auto-generated if empty"
            />
          </Field>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              {isEdit ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Deck dialog
// ---------------------------------------------------------------------------

export function DeckDialog({
  open,
  onOpenChange,
  existing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existing: AdminDeckDto | null;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [coverUrl, setCoverUrl] = useState<string | null>(existing?.coverUrl ?? null);
  const [sortOrder, setSortOrder] = useState(existing?.sortOrder ?? 0);
  const [isActive, setIsActive] = useState(existing?.isActive ?? true);
  const [pending, startTransition] = useTransition();

  const isEdit = !!existing;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Title is required.");
      return;
    }
    startTransition(async () => {
      try {
        if (isEdit) {
          await adminUpdateDeck({
            id: existing.id,
            title: title.trim(),
            description: description.trim() || null,
            coverUrl,
            sortOrder,
            isActive,
          });
        } else {
          await adminCreateDeck({
            title: title.trim(),
            ...(description.trim() ? { description: description.trim() } : {}),
            ...(coverUrl ? { coverUrl } : {}),
            sortOrder,
            isActive,
          });
        }
        toast.success(`Deck ${isEdit ? "updated" : "created"}.`);
        onOpenChange(false);
        onSaved();
      } catch {
        toast.error(`Failed to ${isEdit ? "update" : "create"} deck.`);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit" : "Create"} Deck</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Title">
            <input
              className={inputCx}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Deck title"
              required
            />
          </Field>
          <Field label="Description">
            <textarea
              className={textareaCx}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
            />
          </Field>
          <Field label="Cover Image">
            <ImageUploader value={coverUrl} onChange={setCoverUrl} kind="deck" disabled={pending} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Sort Order">
              <input
                className={inputCx}
                type="number"
                min={0}
                max={10000}
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
              />
            </Field>
            <Field label="Status">
              <select
                className={selectCx}
                value={isActive ? "true" : "false"}
                onChange={(e) => setIsActive(e.target.value === "true")}
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </Field>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              {isEdit ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Card dialog
// ---------------------------------------------------------------------------

export function CardDialog({
  open,
  onOpenChange,
  existing,
  decks,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existing: AdminCardListDto | null;
  decks: AdminDeckDto[];
  onSaved: () => void;
}) {
  const [deckId, setDeckId] = useState(existing?.deckId ?? (decks[0]?.id ?? ""));
  const [title, setTitle] = useState(existing?.title ?? "");
  const [message, setMessage] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(existing?.imageUrl ?? null);
  const [accessType, setAccessType] = useState(existing?.accessType ?? "FREE");
  const [guestPreview, setGuestPreview] = useState(
    existing?.guestPreview ?? false,
  );
  const [isActive, setIsActive] = useState(existing?.isActive ?? true);
  const [sortOrder, setSortOrder] = useState(existing?.sortOrder ?? 0);
  const [themeIds, setThemeIds] = useState<string[]>([]);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [themeOptions, setThemeOptions] = useState<MultiSelectOption[]>([]);
  const [tagOptions, setTagOptions] = useState<MultiSelectOption[]>([]);
  const [pending, startTransition] = useTransition();

  const isEdit = !!existing;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [themes, tags] = await Promise.all([
        adminListThemes({ take: 100 }),
        adminListTags({ take: 100 }),
      ]);
      if (cancelled) return;
      setThemeOptions(themes.items.map((t) => ({ value: t.id, label: t.name })));
      setTagOptions(tags.items.map((t) => ({ value: t.id, label: t.name })));
    }
    if (open) void load();
    return () => { cancelled = true; };
  }, [open]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    let cancelled = false;
    async function loadDetail() {
      if (!existing) return;
      try {
        const detail = await adminGetCard(existing.id);
        if (cancelled) return;
        setThemeIds(detail.themeIds);
        setTagIds(detail.tagIds);
      } catch { /* card detail fetch failed — leave empty */ }
    }
    if (open && isEdit) void loadDetail();
    if (!isEdit) {
      setThemeIds([]);
      setTagIds([]);
    }
    return () => { cancelled = true; };
  }, [open, existing, isEdit]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Title is required.");
      return;
    }
    if (!isEdit && !message.trim()) {
      toast.error("Message is required.");
      return;
    }
    startTransition(async () => {
      try {
        if (isEdit) {
          await adminUpdateCard({
            id: existing.id,
            deckId,
            title: title.trim(),
            ...(message.trim() ? { message: message.trim() } : {}),
            imageUrl,
            accessType: accessType as "FREE" | "PREMIUM",
            guestPreview,
            isActive,
            sortOrder,
            themeIds,
            tagIds,
          });
        } else {
          await adminCreateCard({
            deckId,
            title: title.trim(),
            message: message.trim(),
            ...(imageUrl ? { imageUrl } : {}),
            accessType: accessType as "FREE" | "PREMIUM",
            guestPreview,
            isActive,
            sortOrder,
            themeIds,
            tagIds,
          });
        }
        toast.success(`Card ${isEdit ? "updated" : "created"}.`);
        onOpenChange(false);
        onSaved();
      } catch {
        toast.error(`Failed to ${isEdit ? "update" : "create"} card.`);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit" : "Create"} Card</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Deck">
            <select
              className={selectCx}
              value={deckId}
              onChange={(e) => setDeckId(e.target.value)}
              required
            >
              {decks.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Title">
            <input
              className={inputCx}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Card title"
              required
            />
          </Field>
          <Field label="Message">
            <textarea
              className={textareaCx}
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={isEdit ? "(leave empty to keep current)" : "Card message"}
              required={!isEdit}
            />
          </Field>
          <Field label="Card Image">
            <ImageUploader value={imageUrl} onChange={setImageUrl} kind="card" disabled={pending} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Themes">
              <MultiSelect
                options={themeOptions}
                selected={themeIds}
                onSelectedChange={setThemeIds}
                placeholder="Select themes..."
                searchPlaceholder="Search themes..."
                disabled={pending}
              />
            </Field>
            <Field label="Tags">
              <MultiSelect
                options={tagOptions}
                selected={tagIds}
                onSelectedChange={setTagIds}
                placeholder="Select tags..."
                searchPlaceholder="Search tags..."
                disabled={pending}
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Access">
              <select
                className={selectCx}
                value={accessType}
                onChange={(e) => setAccessType(e.target.value as "FREE" | "PREMIUM")}
              >
                <option value="FREE">Free</option>
                <option value="PREMIUM">Premium</option>
              </select>
            </Field>
            <Field label="Status">
              <select
                className={selectCx}
                value={isActive ? "true" : "false"}
                onChange={(e) => setIsActive(e.target.value === "true")}
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Sort Order">
              <input
                className={inputCx}
                type="number"
                min={0}
                max={10000}
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
              />
            </Field>
            <Field label="Guest Preview">
              <select
                className={selectCx}
                value={guestPreview ? "true" : "false"}
                onChange={(e) => setGuestPreview(e.target.value === "true")}
              >
                <option value="false">No</option>
                <option value="true">Yes</option>
              </select>
            </Field>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              {isEdit ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Journey dialog
// ---------------------------------------------------------------------------

export function JourneyDialog({
  open,
  onOpenChange,
  existing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existing: AdminJourneyListDto | null;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(existing?.thumbnailUrl ?? null);
  const [durationDays, setDurationDays] = useState(
    existing?.durationDays ?? 7,
  );
  const [accessType, setAccessType] = useState(
    existing?.accessType ?? "FREE",
  );
  const [isActive, setIsActive] = useState(existing?.isActive ?? true);
  const [pending, startTransition] = useTransition();

  const isEdit = !!existing;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      toast.error("Title and description are required.");
      return;
    }
    startTransition(async () => {
      try {
        if (isEdit) {
          await adminUpdateJourney({
            id: existing.id,
            title: title.trim(),
            description: description.trim(),
            thumbnailUrl,
            durationDays,
            accessType: accessType as "FREE" | "PREMIUM",
            isActive,
          });
        } else {
          await adminCreateJourney({
            title: title.trim(),
            description: description.trim(),
            ...(thumbnailUrl ? { thumbnailUrl } : {}),
            durationDays,
            accessType: accessType as "FREE" | "PREMIUM",
            isActive,
          });
        }
        toast.success(`Journey ${isEdit ? "updated" : "created"}.`);
        onOpenChange(false);
        onSaved();
      } catch {
        toast.error(`Failed to ${isEdit ? "update" : "create"} journey.`);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit" : "Create"} Journey</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Title">
            <input
              className={inputCx}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Journey title"
              required
            />
          </Field>
          <Field label="Description">
            <textarea
              className={textareaCx}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Journey description"
              required
            />
          </Field>
          <Field label="Thumbnail">
            <ImageUploader value={thumbnailUrl} onChange={setThumbnailUrl} kind="journey" disabled={pending} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Duration (days)">
              <input
                className={inputCx}
                type="number"
                min={1}
                max={365}
                value={durationDays}
                onChange={(e) => setDurationDays(Number(e.target.value))}
              />
            </Field>
            <Field label="Access">
              <select
                className={selectCx}
                value={accessType}
                onChange={(e) => setAccessType(e.target.value as "FREE" | "PREMIUM")}
              >
                <option value="FREE">Free</option>
                <option value="PREMIUM">Premium</option>
              </select>
            </Field>
            <Field label="Status">
              <select
                className={selectCx}
                value={isActive ? "true" : "false"}
                onChange={(e) => setIsActive(e.target.value === "true")}
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </Field>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              {isEdit ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Prompt dialog
// ---------------------------------------------------------------------------

export function PromptDialog({
  open,
  onOpenChange,
  existing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existing: AdminPromptDto | null;
  onSaved: () => void;
}) {
  const [text, setText] = useState(existing?.text ?? "");
  const [type, setType] = useState(existing?.type ?? "REFLECTION");
  const [isActive, setIsActive] = useState(existing?.isActive ?? true);
  const [categoryIds, setCategoryIds] = useState<string[]>(existing?.categoryIds ?? []);
  const [themeIds, setThemeIds] = useState<string[]>(existing?.themeIds ?? []);
  const [categoryOptions, setCategoryOptions] = useState<MultiSelectOption[]>([]);
  const [themeOptions, setThemeOptions] = useState<MultiSelectOption[]>([]);
  const [pending, startTransition] = useTransition();

  const isEdit = !!existing;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [categories, themes] = await Promise.all([
        adminListCategories({ take: 100 }),
        adminListThemes({ take: 100 }),
      ]);
      if (cancelled) return;
      setCategoryOptions(categories.items.map((c) => ({ value: c.id, label: c.name })));
      setThemeOptions(themes.items.map((t) => ({ value: t.id, label: t.name })));
    }
    if (open) void load();
    return () => { cancelled = true; };
  }, [open]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setCategoryIds(existing?.categoryIds ?? []);
    setThemeIds(existing?.themeIds ?? []);
  }, [existing]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) {
      toast.error("Prompt text is required.");
      return;
    }
    if (categoryIds.length === 0 && themeIds.length === 0) {
      toast.error("Select at least one category or theme.");
      return;
    }
    startTransition(async () => {
      try {
        if (isEdit) {
          await adminUpdatePrompt({
            id: existing.id,
            text: text.trim(),
            type: type as "REFLECTION" | "GRATITUDE" | "AFFIRMATION" | "QUESTION",
            isActive,
            categoryIds,
            themeIds,
          });
        } else {
          await adminCreatePrompt({
            text: text.trim(),
            type: type as "REFLECTION" | "GRATITUDE" | "AFFIRMATION" | "QUESTION",
            isActive,
            categoryIds,
            themeIds,
          });
        }
        toast.success(`Prompt ${isEdit ? "updated" : "created"}.`);
        onOpenChange(false);
        onSaved();
      } catch {
        toast.error(`Failed to ${isEdit ? "update" : "create"} prompt.`);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit" : "Create"} Prompt</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Text">
            <textarea
              className={textareaCx}
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Prompt text"
              required
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Categories">
              <MultiSelect
                options={categoryOptions}
                selected={categoryIds}
                onSelectedChange={setCategoryIds}
                placeholder="Select categories..."
                searchPlaceholder="Search categories..."
                disabled={pending}
              />
            </Field>
            <Field label="Themes">
              <MultiSelect
                options={themeOptions}
                selected={themeIds}
                onSelectedChange={setThemeIds}
                placeholder="Select themes..."
                searchPlaceholder="Search themes..."
                disabled={pending}
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Type">
              <select
                className={selectCx}
                value={type}
                onChange={(e) => setType(e.target.value as "REFLECTION" | "GRATITUDE" | "AFFIRMATION" | "QUESTION")}
              >
                <option value="REFLECTION">Reflection</option>
                <option value="GRATITUDE">Gratitude</option>
                <option value="AFFIRMATION">Affirmation</option>
                <option value="QUESTION">Question</option>
              </select>
            </Field>
            <Field label="Status">
              <select
                className={selectCx}
                value={isActive ? "true" : "false"}
                onChange={(e) => setIsActive(e.target.value === "true")}
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </Field>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              {isEdit ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Journey day form dialog (nested — used inside JourneyDaysDialog)
// ---------------------------------------------------------------------------

function JourneyDayFormDialog({
  open,
  onOpenChange,
  journeyId,
  existing,
  nextDayIndex,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  journeyId: string;
  existing: AdminJourneyDayDto | null;
  nextDayIndex: number;
  onSaved: () => void;
}) {
  const [dayIndex, setDayIndex] = useState(existing?.dayIndex ?? nextDayIndex);
  const [cardId, setCardId] = useState(existing?.cardId ?? "");
  const [promptText, setPromptText] = useState(existing?.promptText ?? "");
  const [quote, setQuote] = useState(existing?.quote ?? "");
  const [audioUrl, setAudioUrl] = useState(existing?.audioUrl ?? "");
  const [pending, startTransition] = useTransition();

  const [cards, setCards] = useState<AdminCardListDto[]>([]);
  const [cardsLoading, setCardsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setCardsLoading(true); // eslint-disable-line react-hooks/set-state-in-effect
    adminListCards({ take: 50 })
      .then((res) => { if (!cancelled) setCards(res.items); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setCardsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const isEdit = !!existing;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        await adminUpsertJourneyDay({
          journeyId,
          dayIndex,
          cardId: cardId || null,
          promptText: promptText.trim() || null,
          quote: quote.trim() || null,
          audioUrl: audioUrl.trim() || null,
        });
        toast.success(`Day ${dayIndex} ${isEdit ? "updated" : "added"}.`);
        onOpenChange(false);
        onSaved();
      } catch {
        toast.error(`Failed to ${isEdit ? "update" : "add"} day.`);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit" : "Add"} Journey Day</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Day Number">
            <input
              className={inputCx}
              type="number"
              min={1}
              max={365}
              value={dayIndex}
              onChange={(e) => setDayIndex(Number(e.target.value))}
              disabled={isEdit}
              required
            />
          </Field>
          <Field label="Card (optional)">
            <select
              className={selectCx}
              value={cardId}
              onChange={(e) => setCardId(e.target.value)}
              disabled={cardsLoading}
            >
              <option value="">{cardsLoading ? "Loading cards..." : "No card"}</option>
              {cards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Prompt Text (optional)">
            <textarea
              className={textareaCx}
              rows={3}
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="Reflection prompt for this day..."
              maxLength={10000}
            />
          </Field>
          <Field label="Quote (optional)">
            <textarea
              className={textareaCx}
              rows={2}
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
              placeholder="Inspirational quote..."
              maxLength={2000}
            />
          </Field>
          <Field label="Audio URL (optional)">
            <input
              className={inputCx}
              type="url"
              value={audioUrl}
              onChange={(e) => setAudioUrl(e.target.value)}
              placeholder="https://..."
            />
          </Field>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              {isEdit ? "Save" : "Add Day"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Journey days management dialog
// ---------------------------------------------------------------------------

export function JourneyDaysDialog({
  open,
  onOpenChange,
  journey,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  journey: AdminJourneyListDto;
  onSaved: () => void;
}) {
  const [days, setDays] = useState<AdminJourneyDayDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [reordering, startReorder] = useTransition();
  const [deleting, startDelete] = useTransition();

  const [dayForm, setDayForm] = useState<
    | { open: false }
    | { open: true; existing: AdminJourneyDayDto | null }
  >({ open: false });

  const loadDays = useCallback(() => {
    setLoading(true);
    adminListJourneyDays({ journeyId: journey.id })
      .then((res) => setDays(res.items))
      .catch(() => toast.error("Failed to load journey days."))
      .finally(() => setLoading(false));
  }, [journey.id]);

  useEffect(() => {
    if (open) loadDays(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [open, loadDays]);

  const handleDelete = (day: AdminJourneyDayDto) => {
    startDelete(async () => {
      try {
        await adminDeleteJourneyDay({ id: day.id });
        toast.success(`Day ${day.dayIndex} deleted.`);
        loadDays();
        onSaved();
      } catch {
        toast.error("Failed to delete day.");
      }
    });
  };

  const handleMove = (index: number, direction: "up" | "down") => {
    const swapIdx = direction === "up" ? index - 1 : index + 1;
    if (swapIdx < 0 || swapIdx >= days.length) return;
    const reordered = [...days];
    [reordered[index], reordered[swapIdx]] = [reordered[swapIdx]!, reordered[index]!];
    const orderedIds = reordered.map((d) => d.id);

    startReorder(async () => {
      try {
        await adminReorderJourneyDays({ journeyId: journey.id, orderedIds });
        setDays(reordered.map((d, i) => ({ ...d, dayIndex: i + 1 })));
        onSaved();
      } catch {
        toast.error("Failed to reorder days.");
        loadDays();
      }
    });
  };

  const handleDaySaved = () => {
    loadDays();
    onSaved();
  };

  const nextDayIndex = days.length > 0 ? Math.max(...days.map((d) => d.dayIndex)) + 1 : 1;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage Days &mdash; {journey.title}</DialogTitle>
            <DialogDescription>
              {journey.durationDays}-day journey &middot; {days.length} day{days.length !== 1 ? "s" : ""} configured
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                onClick={() => setDayForm({ open: true, existing: null })}
              >
                <Plus className="mr-1.5 size-4" />
                Add Day
              </Button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : days.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No days configured yet. Click &ldquo;Add Day&rdquo; to get started.
              </p>
            ) : (
              <div className="max-h-[400px] overflow-auto rounded-md border border-border">
                <table className="w-full min-w-[420px] text-sm">
                  <thead className="sticky top-0 bg-surface">
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Day</th>
                      <th className="px-3 py-2 font-medium">Content</th>
                      <th className="px-3 py-2 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {days.map((day, idx) => (
                      <tr
                        key={day.id}
                        className="border-b border-border/50 last:border-b-0"
                      >
                        <td className="px-3 py-2 font-medium tabular-nums">
                          {day.dayIndex}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {[
                            day.cardId ? "Card" : null,
                            day.promptText ? "Prompt" : null,
                            day.quote ? "Quote" : null,
                            day.audioUrl ? "Audio" : null,
                          ]
                            .filter(Boolean)
                            .join(" + ") || "Empty"}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-end gap-0.5">
                            <button
                              type="button"
                              onClick={() => handleMove(idx, "up")}
                              disabled={idx === 0 || reordering}
                              className="inline-flex size-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
                              aria-label="Move up"
                            >
                              <ChevronUp className="size-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMove(idx, "down")}
                              disabled={idx === days.length - 1 || reordering}
                              className="inline-flex size-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
                              aria-label="Move down"
                            >
                              <ChevronDown className="size-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDayForm({ open: true, existing: day })}
                              className="inline-flex size-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                              aria-label="Edit day"
                            >
                              <Pencil className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(day)}
                              disabled={deleting}
                              className="inline-flex size-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                              aria-label="Delete day"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {dayForm.open ? (
        <JourneyDayFormDialog
          open
          onOpenChange={(v) => { if (!v) setDayForm({ open: false }); }}
          journeyId={journey.id}
          existing={dayForm.existing}
          nextDayIndex={nextDayIndex}
          onSaved={handleDaySaved}
        />
      ) : null}
    </>
  );
}