"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CardCountModal } from "@/components/features/billing";
import { Skeleton } from "@/components/ui/skeleton";
import { listJournalEntries } from "@/server/actions/journal";
import { listDecks, type DeckListDto } from "@/server/actions/content";
import type { JournalEntryListItemDto } from "@/lib/dto/journal";
import { ACCENT_COLORS } from "@/lib/ui/constants";
import {
  OracleDeckTileFace,
  splitDeckTitleLines,
} from "@/components/features/deck/oracle-deck-tile-face";

function DeckTileShell({ children, className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={`@container relative aspect-[399/358] w-full overflow-hidden rounded-[21px] border border-[rgba(255,255,255,0.28)] bg-[rgba(26,1,1,0.58)] shadow-[0px_4px_34px_0px_rgba(0,0,0,0.15)] ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

function InnerCardSlot({ children }: { children: React.ReactNode }) {
  /* The inner card is 197/295 portrait, centered inside the landscape shell.
     We constrain its height to ~85% of the shell and let width follow the aspect ratio. */
  return (
    <div className="absolute inset-0 flex items-center justify-center p-4">
      <div className="relative h-full max-h-[88%] w-auto">
        <div className="relative h-full aspect-[197/295]">
          {children}
        </div>
      </div>
    </div>
  );
}

function ComingSoonPanel() {
  return (
    <DeckTileShell role="img" aria-label="Deck coming soon">
      {/* Blurred deck art underneath */}
      <InnerCardSlot>
        <OracleDeckTileFace
          coverSrc="/card-bg.png"
          titleLine1="The Sophionix"
          titleLine2="Oracle Deck"
          footer="Author: Jennifer Rose"
          footerNote={"A 37 Card deck for\nHealing & Transformation"}
          density="hero"
        />
      </InnerCardSlot>
      {/* Frosted veil — Figma 0:1161 */}
      <div
        className="absolute inset-0 z-[2] rounded-[21px] bg-[rgba(26,1,1,0.58)] backdrop-blur-[7px]"
        aria-hidden
      />
      <div className="absolute inset-0 z-[3] flex flex-col items-center justify-center text-center">
        <p className="font-display text-[clamp(1.25rem,4cqw,2rem)] leading-tight text-[#ffa600]">Coming</p>
        <p className="font-display text-[clamp(1.25rem,4cqw,2rem)] leading-tight text-[#ffa600]">Soon</p>
      </div>
    </DeckTileShell>
  );
}

/** Figma node 0:1101 — Card Deck tile (outer shell + centered deck + type on art). */
function OracleDeckPanel({
  deck,
  loading,
  onOpen,
}: {
  deck: DeckListDto | null;
  loading: boolean;
  onOpen: () => void;
}) {
  if (loading) {
    return (
      <DeckTileShell aria-busy aria-label="Loading deck">
        <Skeleton className="absolute inset-0 rounded-[21px] bg-white/5" />
      </DeckTileShell>
    );
  }

  if (!deck) {
    return (
      <DeckTileShell className="flex items-center justify-center px-4 text-center">
        <p className="text-sm text-muted-foreground">No deck available yet.</p>
        <Link
          href="/cards"
          className="mt-3 text-sm font-medium text-view-all underline decoration-solid underline-offset-4"
        >
          Card Library
        </Link>
      </DeckTileShell>
    );
  }

  const coverSrc = deck.coverUrl ?? "/card-bg.png";
  const { first: titleLine1, second: titleLine2 } = splitDeckTitleLines(deck.title);
  const footer = deck.description?.trim() || null;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open oracle draw — ${deck.title}`}
      className="@container relative aspect-[399/358] w-full overflow-hidden rounded-[21px] border border-[rgba(255,255,255,0.28)] bg-[rgba(26,1,1,0.58)] shadow-[0px_4px_34px_0px_rgba(0,0,0,0.15)] cursor-pointer outline-none transition-opacity hover:opacity-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <InnerCardSlot>
        <OracleDeckTileFace
          coverSrc={coverSrc}
          titleLine1={titleLine1}
          titleLine2={titleLine2}
          footer={footer}
          density="hero"
        />
      </InnerCardSlot>
    </button>
  );
}

function NoteSkeleton() {
  return (
    <div className="flex min-h-[72px] animate-pulse overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.38)] bg-card shadow-elevated">
      <div className="w-[6px] shrink-0 rounded-bl-2xl rounded-tl-2xl bg-white/10 lg:w-[10px]" />
      <div className="flex min-w-0 flex-1 flex-col gap-2 px-3 py-3 lg:px-4 lg:py-4">
        <div className="h-5 w-32 rounded bg-white/10" />
        <div className="h-3 w-full rounded bg-white/10" />
        <div className="h-3 w-4/5 rounded bg-white/10" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [notes, setNotes] = React.useState<JournalEntryListItemDto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [featuredDeck, setFeaturedDeck] = React.useState<DeckListDto | null>(null);
  const [deckLoading, setDeckLoading] = React.useState(true);
  const [showPicker, setShowPicker] = React.useState(false);

  React.useEffect(() => {
    listJournalEntries({ take: 5 })
      .then((res) => {
        setNotes(res.items);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  React.useEffect(() => {
    listDecks({ take: 1 })
      .then((res) => {
        setFeaturedDeck(res.items[0] ?? null);
        setDeckLoading(false);
      })
      .catch(() => {
        setDeckLoading(false);
      });
  }, []);

  const handleSelectDrawCount = React.useCallback(
    (count: 1 | 2) => {
      if (!featuredDeck) return;
      setShowPicker(false);
      router.push(`/cards/draw?deck=${featuredDeck.id}&count=${count}`);
    },
    [featuredDeck, router],
  );

  const robotoUi = {
    fontFamily: "var(--font-roboto-ui), system-ui, sans-serif",
    fontVariationSettings: "'wdth' 100",
  } as const;

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:gap-10">
      {/* Card Deck — oracle tile Figma 0:1101; coming-soon Figma 0:1152 */}
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-display text-xl font-normal text-foreground lg:text-[1.75rem]">
            Card Deck
          </h2>
          <Link
            href="/cards"
            className="shrink-0 text-sm font-medium text-view-all underline decoration-solid underline-offset-4 transition-opacity hover:opacity-90 lg:text-base"
          >
            View All
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <OracleDeckPanel
            deck={featuredDeck}
            loading={deckLoading}
            onOpen={() => {
              if (featuredDeck) setShowPicker(true);
            }}
          />
          <ComingSoonPanel />
          <ComingSoonPanel />
          <ComingSoonPanel />
        </div>

        {showPicker && featuredDeck ? (
          <CardCountModal
            onClose={() => setShowPicker(false)}
            onSelect={handleSelectDrawCount}
          />
        ) : null}
      </div>

      {/* Journal Notes */}
      <div className="flex w-full shrink-0 flex-col gap-4 lg:w-[min(100%,480px)] xl:max-w-[480px]">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-display text-xl font-normal text-foreground lg:text-[1.75rem]">
            Journal Notes
          </h2>
          <Link
            href="/journal"
            className="shrink-0 text-sm font-medium text-view-all underline decoration-solid underline-offset-4 transition-opacity hover:opacity-90 lg:text-base"
          >
            View All
          </Link>
        </div>

        <div className="flex flex-col gap-3">
          {loading ? (
            <>
              <NoteSkeleton />
              <NoteSkeleton />
              <NoteSkeleton />
            </>
          ) : notes.length === 0 ? (
            <p
              className="rounded-[21px] border border-[rgba(255,255,255,0.38)] bg-card py-16 text-center text-lg text-muted-foreground shadow-elevated"
              style={robotoUi}
            >
              No journal entries yet.
            </p>
          ) : (
            notes.map((entry, i) => {
              const accent = ACCENT_COLORS[i % ACCENT_COLORS.length];
              return (
                <div
                  key={entry.id}
                  className="flex min-h-[72px] overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.38)] bg-card shadow-elevated"
                >
                  <div
                    className="w-[6px] shrink-0 rounded-bl-2xl rounded-tl-2xl lg:w-[10px]"
                    style={{ backgroundColor: accent }}
                  />
                  <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-3 py-3 lg:px-4 lg:py-4">
                    <span
                      className="text-sm font-bold leading-tight text-foreground lg:text-base"
                      style={robotoUi}
                    >
                      {entry.title ?? "Untitled"}
                    </span>
                    <span
                      className="line-clamp-2 text-xs font-light leading-snug text-foreground/70 lg:text-sm"
                      style={robotoUi}
                    >
                      {entry.snippet}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
