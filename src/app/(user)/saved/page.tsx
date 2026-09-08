"use client";

import * as React from "react";
import Image from "next/image";
import { PageHeader } from "@/components/layout";
import { X } from "@/lib/ui/icons";
import { listSavedCards } from "@/server/actions/content";
import type { SavedCardDto } from "@/server/actions/content";

type SavedCard = {
  id: string;
  image: string;
  title: string;
  message: string;
  prompt: string | null;
};

type CardGroup = {
  id: string;
  cards: SavedCard[];
};

function toSavedCard(dto: SavedCardDto): SavedCard {
  return {
    id: dto.id,
    image: dto.imageUrl ?? "/card-bg.png",
    title: dto.title,
    message: dto.message,
    prompt: dto.prompt,
  };
}

/**
 * Group by the reading the cards were saved in (`savedGroupId`): a 2-card draw
 * saved together shows as one group of two, a single draw as one card. Legacy
 * rows have no group id, so each becomes its own single-card group. Input is
 * already ordered most-recent-first, and Map preserves insertion order.
 */
function groupByReading(cards: SavedCardDto[]): CardGroup[] {
  const map = new Map<string, SavedCard[]>();
  for (const c of cards) {
    const key = c.savedGroupId ?? `solo:${c.id}`;
    const group = map.get(key) ?? [];
    group.push(toSavedCard(c));
    map.set(key, group);
  }
  return Array.from(map.entries()).map(([id, grouped]) => ({
    id,
    cards: grouped,
  }));
}

/** Horizontal fan of the reading's cards, matching the Saved Cards design. */
function CardFan({ cards }: { cards: SavedCard[] }) {
  const cardW = 168;
  const cardH = 252;
  const overlap = 54;
  const stackW = cardW + (cards.length - 1) * overlap;

  return (
    <div className="relative" style={{ width: stackW, height: cardH }}>
      {cards.map((card, i) => (
        <div
          key={card.id}
          className="absolute overflow-hidden rounded-[16px] border-[0.8px] border-white/50 shadow-[0_10px_30px_rgba(0,0,0,0.5)]"
          style={{
            left: i * overlap,
            top: 0,
            zIndex: i,
            width: cardW,
            height: cardH,
          }}
        >
          <Image
            src={card.image}
            alt={card.title}
            width={cardW}
            height={cardH}
            className="size-full object-cover"
          />
        </div>
      ))}
    </div>
  );
}

function FlipCard({ card }: { card: SavedCard }) {
  const [flipped, setFlipped] = React.useState(false);

  return (
    <div
      className="mx-auto cursor-pointer select-none"
      style={{
        perspective: "1600px",
        width: "min(468px, 86vw, 58vh)",
        aspectRatio: "226 / 317",
      }}
      onClick={() => setFlipped((f) => !f)}
      role="button"
      aria-label={flipped ? "Show card art" : "Flip to reveal message"}
    >
      <div
        className="relative size-full transition-transform ease-(--ease-brand)"
        style={{
          transformStyle: "preserve-3d",
          transitionDuration: "var(--duration-card-flip)",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        {/* Front — card art */}
        <div
          className="absolute inset-0 overflow-hidden rounded-[21px] border border-white/30 bg-[#1a0101] shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
          style={{ backfaceVisibility: "hidden" }}
        >
          <Image
            src={card.image}
            alt={card.title}
            fill
            className="object-cover"
            sizes="(min-width: 768px) 468px, 86vw"
            priority
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/92 via-black/45 to-transparent px-5 pb-5 pt-10 text-center">
            <p className="font-display text-[1.5rem] font-medium leading-snug tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.85)] md:text-[1.75rem]">
              Sophionix Key: {card.title}
            </p>
            <p className="mt-2.5 text-[11px] font-medium uppercase tracking-[0.22em] text-white/70 md:text-xs">
              Tap to read the message
            </p>
          </div>
        </div>

        {/* Back — message & reflection */}
        <div
          className="absolute inset-0 flex flex-col rounded-[21px] border border-white/[0.18] bg-gradient-to-b from-[#231212] via-[#1a0a0a] to-[#120606] shadow-[0_24px_64px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.06)]"
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          <header className="shrink-0 border-b border-white/[0.08] px-6 pb-6 pt-6 text-center md:px-8 md:pb-7 md:pt-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-white/55 md:text-xs">
              Sophionix Key
            </p>
            <h3 className="mt-2.5 font-display text-[1.5625rem] font-medium leading-[1.18] tracking-tight text-white md:text-[1.875rem]">
              {card.title}
            </h3>
            <p className="mt-3.5 font-display text-base font-normal italic leading-snug text-[#c9b8a8] md:text-lg">
              Sending to Light
            </p>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-6 md:px-8 md:py-7">
            <div className="font-sans text-base leading-[1.78] text-[#e9e4df] md:text-[1.0625rem] md:leading-[1.8]">
              {card.message.split(/\n\n+/).filter(Boolean).length > 1 ? (
                card.message
                  .split(/\n\n+/)
                  .filter(Boolean)
                  .map((para, i) => (
                    <p key={i} className={i > 0 ? "mt-6" : undefined}>
                      {para.trim()}
                    </p>
                  ))
              ) : (
                <p className="whitespace-pre-line">{card.message.trim()}</p>
              )}
            </div>
            {card.prompt ? (
              <div className="mt-9 border-t border-white/[0.12] pt-7">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#f5e6a3] md:text-xs">
                  Reflection
                </p>
                <p className="mt-3 font-sans text-[1.0625rem] leading-[1.72] text-[#f4f0eb] md:text-lg md:leading-[1.75]">
                  {card.prompt}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function DeckOverlay({
  cards,
  onClose,
}: {
  cards: SavedCard[];
  onClose: () => void;
}) {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const raf = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-[12px] transition-colors duration-300"
      style={{ backgroundColor: open ? "rgba(27,0,0,0.55)" : "rgba(27,0,0,0)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[min(92vh,900px)] flex-wrap items-center justify-center gap-6 overflow-y-auto p-4"
        style={{
          opacity: open ? 1 : 0,
          transform: open ? "scale(1)" : "scale(0.55)",
          transition:
            "opacity 0.35s ease-out, transform 0.6s cubic-bezier(0.34,1.56,0.64,1)",
        }}
      >
        {cards.map((card) => (
          <FlipCard key={card.id} card={card} />
        ))}
      </div>

      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-[60] flex size-10 items-center justify-center text-white transition hover:opacity-80 md:right-12 md:top-14"
        aria-label="Close"
      >
        <X className="size-8" strokeWidth={2.5} />
      </button>
    </div>
  );
}

export default function SavedCardsPage() {
  const [groups, setGroups] = React.useState<CardGroup[]>([]);
  const [openGroup, setOpenGroup] = React.useState<CardGroup | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    listSavedCards({})
      .then((res) => setGroups(groupByReading(res.items)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Saved Cards" />

      {loading ? (
        <div className="flex flex-wrap gap-6">
          {Array.from({ length: 3 }, (_, i) => (
            <div
              key={i}
              className="h-[360px] w-full max-w-[400px] animate-pulse rounded-2xl border border-white/10 bg-surface"
            />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No saved cards yet.
        </p>
      ) : (
        <div className="flex flex-wrap gap-6">
          {groups.map((group) => (
            <button
              key={group.id}
              type="button"
              onClick={() => setOpenGroup(group)}
              aria-label={`Open saved reading of ${group.cards.length} card${group.cards.length > 1 ? "s" : ""}`}
              className="flex h-[358px] w-full max-w-[400px] cursor-pointer items-center justify-center overflow-hidden rounded-[21px] border border-white/[0.28] bg-[rgba(26,1,1,0.58)] p-6 shadow-[0px_4px_34px_0px_rgba(0,0,0,0.15)] transition-transform hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              <CardFan cards={group.cards} />
            </button>
          ))}
        </div>
      )}

      {openGroup ? (
        <DeckOverlay
          cards={openGroup.cards}
          onClose={() => setOpenGroup(null)}
        />
      ) : null}
    </div>
  );
}
