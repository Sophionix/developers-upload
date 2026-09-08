"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AppModal } from "@/components/ui/app-modal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Shuffle,
  Lock,
  Bookmark,
  Loader2,
  Search,
  SlidersHorizontal,
} from "@/lib/ui/icons";
import { cn } from "@/lib/ui/cn";
import {
  listDecks,
  listCards,
  drawRandomFromDeck,
  getCard,
} from "@/server/actions/content";
import type { DeckListDto } from "@/server/actions/content";
import type { CardListDto, CardDetailDto } from "@/lib/dto/card";
import {
  OracleDeckTileFace,
  splitDeckTitleLines,
} from "@/components/features/deck/oracle-deck-tile-face";
import { OracleDrawCardZoomOverlay } from "@/components/features/oracle-deck-draw/oracle-draw-card-reveal";
import type { DrawCard } from "@/components/features/oracle-deck-draw/oracle-deck-draw-types";

type ViewMode = "decks" | "cards";

function cardDetailToDrawCard(d: CardDetailDto): DrawCard {
  return {
    id: d.id,
    title: d.title,
    message: d.message,
    prompt: d.prompt,
    imageUrl: d.imageUrl,
  };
}

/**
 * Figma Card Library (0:7216) — frosted shell per tile; inner oracle card ~197×295 centered (~49% shell width).
 * @see https://www.figma.com/design/O2lZCGIrz2CTsN26QpkHDy/Sophionix-Final-UI?node-id=0-7216
 */
function LibraryOracleTileShell({
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"button">, "type"> & { children: React.ReactNode }) {
  return (
    <button
      type="button"
      className={cn(
        "group relative mx-auto block w-full overflow-hidden rounded-[21px]",
        "border border-[rgba(255,255,255,0.28)] bg-[rgba(26,1,1,0.58)] shadow-[0_4px_34px_0px_rgba(0,0,0,0.15)]",
        "aspect-[399.45/357.7] outline-none transition-opacity hover:opacity-95",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
      {...props}
    >
      <div className="absolute inset-0 flex items-center justify-center px-[5.5%] py-[7%]">
        {children}
      </div>
    </button>
  );
}

/* ─── Deck Card (library grid) ─── */
function DeckCard({
  deck,
  onClick,
}: {
  deck: DeckListDto;
  onClick: () => void;
}) {
  const coverSrc = deck.coverUrl ?? "/card-bg.png";
  const { first: titleLine1, second: titleLine2 } = splitDeckTitleLines(deck.title);
  const footer = deck.description?.trim() || null;

  return (
    <LibraryOracleTileShell onClick={onClick} aria-label={`Open deck — ${deck.title}`}>
      <div className="relative aspect-[197/295] w-[min(197px,49.27%)] min-h-0 max-w-full shrink-0">
        <OracleDeckTileFace
          coverSrc={coverSrc}
          titleLine1={titleLine1}
          titleLine2={titleLine2}
          footer={footer}
          density="hero"
        />
      </div>
    </LibraryOracleTileShell>
  );
}

/* ─── Card back (inside a deck) — Figma 0:5190 (~232×348, single stroke). https://www.figma.com/design/O2lZCGIrz2CTsN26QpkHDy/Sophionix-Final-UI?node-id=0-5190 ─── */
function CardBack({
  card,
  onClick,
}: {
  card: CardListDto;
  onClick: () => void;
}) {
  const coverSrc = card.imageUrl ?? "/card-bg.png";
  const { first: titleLine1, second: titleLine2 } = splitDeckTitleLines(card.title);
  const footer = card.accessType === "PREMIUM" ? "Premium" : null;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Open card — ${card.title}`}
      className={cn(
        "group relative mx-auto block w-full max-w-[232px] overflow-hidden rounded-[16.5px]",
        "border-[1.102px] border-[rgba(255,255,255,0.36)] bg-black outline-none",
        "aspect-[232/348] shadow-[0_8px_28px_rgba(0,0,0,0.35)]",
        "transition-opacity hover:opacity-95",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      )}
    >
      <OracleDeckTileFace
        coverSrc={coverSrc}
        titleLine1={titleLine1}
        titleLine2={titleLine2}
        footer={footer}
        density="hero"
        monochromeArt={!card.imageUrl}
        alt=""
        className="border-0"
      />
      {card.accessType === "PREMIUM" && (
        <div className="absolute right-2 top-2 z-[4] rounded-full bg-black/50 p-1">
          <Lock className="size-3.5 text-white/80" />
        </div>
      )}
    </button>
  );
}

/* ─── Search Filter Modal ─── */
type AccessFilter = "ALL" | "FREE" | "PREMIUM";

function SearchFilterModal({
  keyword,
  accessFilter,
  onApply,
  onClose,
}: {
  keyword: string;
  accessFilter: AccessFilter;
  onApply: (keyword: string, access: AccessFilter) => void;
  onClose: () => void;
}) {
  const [kw, setKw] = React.useState(keyword);
  const [recentView, setRecentView] = React.useState("");
  const [access, setAccess] = React.useState<AccessFilter>(accessFilter);

  return (
    <AppModal title="Search Filter" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <input
          type="text"
          value={kw}
          onChange={(e) => setKw(e.target.value)}
          placeholder="Enter Keyword"
          className="w-full rounded-lg border border-white/20 bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />

        <input
          type="text"
          value={recentView}
          onChange={(e) => setRecentView(e.target.value)}
          placeholder="Search by Recent View"
          className="w-full rounded-lg border border-white/20 bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />

        <div>
          <p className="mb-2 text-sm font-semibold text-foreground">Access Level</p>
          <div className="flex items-center gap-5">
            {(["ALL", "FREE", "PREMIUM"] as const).map((opt) => (
              <label key={opt} className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                <input
                  type="radio"
                  name="access"
                  checked={access === opt}
                  onChange={() => setAccess(opt)}
                  className="size-4 accent-primary"
                />
                {opt === "ALL" ? "All" : opt === "FREE" ? "Free" : "Premium"}
              </label>
            ))}
          </div>
        </div>

        <Button
          variant="brand"
          size="lg"
          className="w-full"
          onClick={() => onApply(kw, access)}
        >
          Apply
        </Button>
      </div>
    </AppModal>
  );
}

/* ─── Page ─── */
export default function CardLibraryPage() {
  const router = useRouter();
  const [viewMode, setViewMode] = React.useState<ViewMode>("decks");
  const [decks, setDecks] = React.useState<DeckListDto[]>([]);
  const [cards, setCards] = React.useState<CardListDto[]>([]);
  const [activeDeck, setActiveDeck] = React.useState<DeckListDto | null>(null);
  const [drawnCard, setDrawnCard] = React.useState<CardDetailDto | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [drawing, setDrawing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [loadingCard, setLoadingCard] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [accessFilter, setAccessFilter] = React.useState<AccessFilter>("ALL");
  const [showFilterModal, setShowFilterModal] = React.useState(false);

  React.useEffect(() => {
    listDecks({}).then((res) => {
      setDecks(res.items);
      setLoading(false);
    });
  }, []);

  const loadCards = React.useCallback(
    (deckId: string, access: AccessFilter) => {
      setLoading(true);
      setCards([]);
      const params: Parameters<typeof listCards>[0] = { deckId, take: 50 };
      if (access !== "ALL") params.accessType = access;
      listCards(params).then((res) => {
        setCards(res.items);
        setLoading(false);
      });
    },
    [],
  );

  const openDeck = React.useCallback(
    (deck: DeckListDto) => {
      setActiveDeck(deck);
      setViewMode("cards");
      setSearchQuery("");
      setAccessFilter("ALL");
      loadCards(deck.id, "ALL");
    },
    [loadCards],
  );

  const goBackToDecks = React.useCallback(() => {
    setViewMode("decks");
    setActiveDeck(null);
    setCards([]);
    setSearchQuery("");
    setAccessFilter("ALL");
  }, []);

  const handleCardClick = React.useCallback(async (card: CardListDto) => {
    if (card.accessType === "PREMIUM") return;
    setLoadingCard(true);
    try {
      const detail = await getCard({ id: card.id });
      setDrawnCard(detail);
    } catch {
      // entitlement or not found
    } finally {
      setLoadingCard(false);
    }
  }, []);

  const handleDrawRandom = React.useCallback(async () => {
    if (!activeDeck || drawing) return;
    setDrawing(true);
    try {
      const card = await drawRandomFromDeck({ deckId: activeDeck.id });
      setDrawnCard(card);
    } catch {
      // entitlement or rate limit
    } finally {
      setDrawing(false);
    }
  }, [activeDeck, drawing]);

  // Reading flows straight into the journal: instead of silently saving the
  // card, open the note editor with this card so the reader can write about it.
  // The card is saved together with the note when the entry is created.
  const handleSaveCard = React.useCallback(() => {
    if (!drawnCard || saving) return;
    setSaving(true);
    router.push(`/journal/create?cardId=${encodeURIComponent(drawnCard.id)}`);
  }, [drawnCard, saving, router]);

  const filteredCards = React.useMemo(() => {
    if (!searchQuery) return cards;
    const q = searchQuery.toLowerCase();
    return cards.filter((c) => c.title.toLowerCase().includes(q));
  }, [cards, searchQuery]);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      {viewMode === "decks" ? (
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
          Card Library
        </h1>
      ) : (
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={goBackToDecks}
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-white/10"
            aria-label="Back to decks"
          >
            <ArrowLeft className="size-5" />
          </button>
          <h1 className="flex-1 font-display text-3xl font-bold tracking-tight text-foreground">
            {activeDeck?.title ?? "Cards"}
          </h1>
          <Button
            variant="brand"
            size="sm"
            onClick={handleDrawRandom}
            disabled={drawing || loading}
            className="shrink-0 gap-2"
          >
            {drawing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Shuffle className="size-4" />
            )}
            Draw Random
          </Button>
        </div>
      )}

      {/* Search bar + filter for cards view */}
      {viewMode === "cards" && (
        <div className="flex max-w-[700px] items-center gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-11 w-full rounded-lg border border-border bg-surface pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowFilterModal(true)}
            className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-foreground transition-colors hover:bg-white/10"
            aria-label="Search filter"
          >
            <SlidersHorizontal className="size-5" />
          </button>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div
          className={cn(
            "grid gap-x-14 gap-y-10",
            viewMode === "decks"
              ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
              : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
          )}
        >
          {Array.from({ length: viewMode === "decks" ? 6 : 10 }, (_, i) => (
            <Skeleton
              key={i}
              className={cn(
                "mx-auto w-full",
                viewMode === "decks"
                  ? "aspect-[399.45/357.7] rounded-[21px]"
                  : "aspect-[232/348] max-w-[232px] rounded-[16.5px]",
              )}
            />
          ))}
        </div>
      ) : viewMode === "decks" ? (
        decks.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No decks available yet. Check back soon.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-x-11 gap-y-11 md:grid-cols-2 xl:grid-cols-3">
            {decks.map((deck) => (
              <DeckCard
                key={deck.id}
                deck={deck}
                onClick={() => openDeck(deck)}
              />
            ))}
          </div>
        )
      ) : filteredCards.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {searchQuery ? "No cards match your search." : "This deck has no cards yet."}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-x-14 gap-y-10 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filteredCards.map((card) => (
            <CardBack
              key={card.id}
              card={card}
              onClick={() => handleCardClick(card)}
            />
          ))}
        </div>
      )}

      {/* Loading overlay for card fetch */}
      {loadingCard && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      )}

      {/* Search Filter Modal */}
      {showFilterModal && (
        <SearchFilterModal
          keyword={searchQuery}
          accessFilter={accessFilter}
          onClose={() => setShowFilterModal(false)}
          onApply={(kw, access) => {
            setSearchQuery(kw);
            setAccessFilter(access);
            setShowFilterModal(false);
            if (activeDeck && access !== accessFilter) {
              loadCards(activeDeck.id, access);
            }
          }}
        />
      )}

      {/* Drawn card — same centered flip + backdrop as dashboard pick/zoom */}
      {drawnCard && (
        <OracleDrawCardZoomOverlay
          key={drawnCard.id}
          card={cardDetailToDrawCard(drawnCard)}
          onClose={() => setDrawnCard(null)}
          footer={
            <Button
              variant="outline"
              size="sm"
              className="border-white/40 bg-black/40 text-white hover:bg-white/10 hover:text-white"
              onClick={(e) => {
                e.stopPropagation();
                void handleSaveCard();
              }}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Bookmark className="size-4" />
              )}
              Save
            </Button>
          }
        />
      )}
    </div>
  );
}
