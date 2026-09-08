"use client";

import * as React from "react";
import Image from "next/image";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { Bookmark, Check, Loader2, Shuffle, X } from "@/lib/ui/icons";
import { cn } from "@/lib/ui/cn";
import type { DrawCard } from "./oracle-deck-draw-types";
import { OracleDrawCardZoomOverlay } from "./oracle-draw-card-reveal";

export type { DrawCard } from "./oracle-deck-draw-types";

/* ── Demo fallback cards (guest API locked / network errors) ─── */
const FALLBACK_POOL: DrawCard[] = [
  {
    id: "f-halo",
    title: "Inner Light",
    message:
      "Your inner light is unmistakable today. The world doesn't need a brighter version of you — it needs the one already shining. Let it lead.",
    prompt: "What does your light feel like when it isn't trying to convince anyone?",
    imageUrl: "/cards/05-halo.png",
  },
  {
    id: "f-doorway",
    title: "Sacred Doorway",
    message:
      "A threshold is opening. You don't have to know what waits on the other side — only that you are ready to walk through.",
    prompt: "Which doorway have you been circling without stepping through?",
    imageUrl: "/cards/17-doorway.png",
  },
  {
    id: "f-third-eye",
    title: "Third Eye",
    message:
      "Trust the quiet knowing underneath the noise. Your intuition has been speaking — this is the moment to listen with your whole body.",
    prompt: "What truth have you been pretending not to know?",
    imageUrl: "/cards/22-third-eye.png",
  },
  {
    id: "f-bear-hug",
    title: "Bear Hug",
    message:
      "Soften. The healing you are looking for begins with being held — by yourself, by another, by the earth that has never stopped holding you.",
    prompt: "Where in your life is tenderness the bravest choice?",
    imageUrl: "/cards/16-bear-hug.png",
  },
  {
    id: "f-stairway",
    title: "Stairway",
    message:
      "You don't have to leap. The path rises one step at a time, and every step counts — even the ones no one else can see.",
    prompt: "What is the next single step that you can actually take?",
    imageUrl: "/cards/21-stairway.png",
  },
  {
    id: "f-hourglass",
    title: "Hourglass",
    message:
      "Time is a teacher, not a thief. What you are waiting for is also ripening — and so are you.",
    prompt: "What might be quietly working in your favour while you wait?",
    imageUrl: "/cards/25-hourglass.png",
  },
  {
    id: "f-readiness",
    title: "Readiness",
    message:
      "You are more prepared than you feel. The doubt is not a stop sign — it is the last layer dissolving before you say yes.",
    prompt: "What are you ready for, even one percent more than yesterday?",
    imageUrl: "/cards/06-readiness.png",
  },
  {
    id: "f-unity",
    title: "Unity",
    message:
      "Separation was the illusion. You belong — to yourself, to those you love, to something far older than your name. Come home.",
    prompt: "Where can you choose connection over comparison today?",
    imageUrl: "/cards/29-unity.png",
  },
];

function pickFallbacks(count: number): DrawCard[] {
  const shuffled = [...FALLBACK_POOL]
    .map((c) => ({ c, k: Math.random() }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.c);
  return shuffled.slice(0, count);
}

interface CardPos {
  x: number;
  y: number;
  rotate: number;
}

type Phase = "loading" | "scatter" | "shuffling" | "arc" | "reveal";

const SPREAD_TOTAL = 37;
const STAGGER_MS = 22;
const FAN_DELAY_MS = 220;
const SHUFFLE_COLLAPSE_MS = 700;
const SELECT_TO_REVEAL_MS = 950;

function makeRng(seed: number) {
  let s = seed % 233280;
  if (s <= 0) s += 233280;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function generateScatter(total: number, seed: number): CardPos[] {
  const rng = makeRng(seed);
  const cols = 6;
  const rows = Math.ceil(total / cols);
  const xMin = 6;
  const xMax = 94;
  const yMin = 14;
  const yMax = 86;
  const cellW = (xMax - xMin) / cols;
  const cellH = (yMax - yMin) / rows;
  const positions: CardPos[] = [];
  for (let i = 0; i < total; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const baseX = xMin + (col + 0.5) * cellW;
    const baseY = yMin + (row + 0.5) * cellH;
    const jx = (rng() - 0.5) * cellW * 0.7;
    const jy = (rng() - 0.5) * cellH * 0.7;
    const rotate = (rng() - 0.5) * 30;
    positions.push({ x: baseX + jx, y: baseY + jy, rotate });
  }
  return positions;
}

function generateStack(total: number, seed: number): CardPos[] {
  const rng = makeRng(seed);
  return Array.from({ length: total }, () => ({
    x: 50 + (rng() - 0.5) * 5,
    y: 52 + (rng() - 0.5) * 4,
    rotate: (rng() - 0.5) * 50,
  }));
}

function generateArc(total: number): CardPos[] {
  const cx = 50;
  const cy = 88;
  const rx = 44;
  const ry = 70;
  const span = 180;
  const positions: CardPos[] = [];
  for (let i = 0; i < total; i++) {
    const t = total > 1 ? i / (total - 1) : 0.5;
    const angleDeg = -span / 2 + t * span;
    const angleRad = (angleDeg * Math.PI) / 180;
    positions.push({
      x: cx + Math.sin(angleRad) * rx,
      y: cy - Math.cos(angleRad) * ry,
      rotate: angleDeg,
    });
  }
  return positions;
}

function getSlotPositions(count: 1 | 2): CardPos[] {
  if (count === 1) return [{ x: 50, y: 76, rotate: 0 }];
  return [
    { x: 46, y: 76, rotate: 0 },
    { x: 54, y: 76, rotate: 0 },
  ];
}

function SpreadCard({
  index,
  position,
  isSelected,
  isDisabled,
  onClick,
}: {
  index: number;
  position: CardPos;
  isSelected: boolean;
  isDisabled: boolean;
  onClick: () => void;
}) {
  const [arrived, setArrived] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(
      () => setArrived(true),
      FAN_DELAY_MS + index * STAGGER_MS,
    );
    return () => clearTimeout(t);
  }, [index]);

  const finalTransform = `translate(-50%, -50%) rotate(${position.rotate}deg) scale(${isSelected ? 1.05 : 1})`;
  const initTransform = "translate(-50%, -50%) rotate(0deg) scale(0.22)";
  const transDelay = `${index * STAGGER_MS}ms`;

  return (
    <button
      type="button"
      onClick={isDisabled ? undefined : onClick}
      disabled={isDisabled}
      className={cn(
        "absolute aspect-[143/215] w-[clamp(64px,8vw,143px)] overflow-hidden rounded-[16px] border shadow-[0_8px_30px_rgba(0,0,0,0.5)] will-change-transform",
        isSelected
          ? "z-30 border-primary ring-2 ring-primary/60 shadow-[0_0_24px_rgba(217,119,6,0.6)]"
          : "border-white/50",
        !isDisabled && !isSelected && "hover:z-20 hover:brightness-110",
        isDisabled && !isSelected && "cursor-default",
      )}
      style={{
        left: arrived ? `${position.x}%` : "50%",
        top: arrived ? `${position.y}%` : "55%",
        transform: arrived ? finalTransform : initTransform,
        opacity: arrived ? 1 : 0,
        transition: `left 0.6s cubic-bezier(0.34,1.56,0.64,1) ${transDelay}, top 0.6s cubic-bezier(0.34,1.56,0.64,1) ${transDelay}, transform 0.6s cubic-bezier(0.34,1.56,0.64,1) ${transDelay}, opacity 0.3s ease ${transDelay}`,
        zIndex: isSelected ? 30 : index + 1,
      }}
    >
      <Image src="/card-bg.png" alt="Card" fill className="object-cover" sizes="143px" />
    </button>
  );
}

function RevealBigCard({
  card,
  index,
  count,
  visible,
  onClick,
}: {
  card: DrawCard;
  index: number;
  count: 1 | 2;
  visible: boolean;
  onClick: () => void;
}) {
  const [settled, setSettled] = React.useState(false);
  const enterDelay = index * 160;

  React.useEffect(() => {
    if (!visible) {
      setSettled(false); // eslint-disable-line react-hooks/set-state-in-effect
      return;
    }
    const t = setTimeout(() => setSettled(true), enterDelay + 720);
    return () => clearTimeout(t);
  }, [visible, enterDelay]);

  const startRotate = index === 0 ? -14 : 14;
  const entranceTransition = `opacity 0.7s ease-out ${enterDelay}ms, transform 0.85s cubic-bezier(0.34,1.56,0.64,1) ${enterDelay}ms`;
  const hoverTransition = "transform 0.25s ease-out, box-shadow 0.25s ease-out";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Open card ${index + 1}: ${card.title}`}
      className={cn(
        "group relative aspect-[197/295] overflow-hidden rounded-2xl border-[0.8px] border-white/50 shadow-[0_18px_44px_rgba(0,0,0,0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        count === 1
          ? "w-[clamp(260px,34vw,380px)]"
          : "w-[clamp(120px,35vw,320px)]",
        settled && "hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(217,119,6,0.45)]",
      )}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible
          ? "translateY(0) scale(1) rotate(0deg)"
          : `translateY(20px) scale(0.45) rotate(${startRotate}deg)`,
        transition: settled ? hoverTransition : entranceTransition,
      }}
    >
      {card.imageUrl ? (
        <Image
          src={card.imageUrl}
          alt={card.title}
          fill
          className="object-cover"
          sizes="(min-width: 768px) 300px, 220px"
          priority
        />
      ) : (
        <div className="absolute inset-0 bg-brand-grad" />
      )}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/30 from-0% via-transparent via-[62%] to-black/50 to-100%"
        aria-hidden
      />
      <div className="absolute inset-x-0 bottom-0 px-3 pb-4 text-center">
        <p className="font-display text-base font-medium leading-snug text-white drop-shadow-[0_1px_6px_rgba(0,0,0,0.9)]">
          {card.title}
        </p>
        <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.18em] text-white/70">
          Tap to read
        </p>
      </div>
    </button>
  );
}

export interface OracleDeckDrawExperienceProps {
  deckId: string;
  count: 1 | 2;
  /** Return at least `count` cards for the reveal; on failure the UI uses fallbacks. */
  onDraw: (deckId: string, count: 1 | 2) => Promise<DrawCard[]>;
  /**
   * Persist the revealed cards. Provided only for signed-in users — when
   * omitted (e.g. guests), the Save button is hidden entirely.
   */
  onSaveCards?: (cards: DrawCard[]) => Promise<void>;
  onExit: () => void;
}

export function OracleDeckDrawExperience({
  deckId,
  count,
  onDraw,
  onSaveCards,
  onExit,
}: OracleDeckDrawExperienceProps) {
  const [drawnCards, setDrawnCards] = React.useState<DrawCard[]>([]);
  const [phase, setPhase] = React.useState<Phase>("loading");
  const [selectedIndices, setSelectedIndices] = React.useState<number[]>([]);
  const [shuffleSeed, setShuffleSeed] = React.useState(1);
  const [expandedCardIndex, setExpandedCardIndex] = React.useState<number | null>(null);
  const [revealVisible, setRevealVisible] = React.useState(false);
  const [question, setQuestion] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  const scatterPositions = React.useMemo(
    () => generateScatter(SPREAD_TOTAL, shuffleSeed * 7919 + 1),
    [shuffleSeed],
  );
  const stackPositions = React.useMemo(
    () => generateStack(SPREAD_TOTAL, shuffleSeed * 3571 + 17),
    [shuffleSeed],
  );
  // Cards already sitting in a slot are kept out of the spread, so the arc is
  // rebuilt from just the remaining (non-selected) cards — no gap, no reshuffle
  // of a card the user has already committed to.
  const visibleArcCount = SPREAD_TOTAL - selectedIndices.length;
  const arcPositions = React.useMemo(
    () => generateArc(visibleArcCount),
    [visibleArcCount],
  );
  const arcSlotByCard = React.useMemo(() => {
    const map = new Map<number, number>();
    let slot = 0;
    for (let i = 0; i < SPREAD_TOTAL; i++) {
      if (selectedIndices.includes(i)) continue;
      map.set(i, slot++);
    }
    return map;
  }, [selectedIndices]);
  const slotPositions = React.useMemo(() => getSlotPositions(count), [count]);

  const initialized = React.useRef(false);
  React.useEffect(() => {
    if (!deckId || initialized.current) return;
    initialized.current = true;
    setPhase("scatter");
    void onDraw(deckId, count)
      .then((cards) => {
        if (cards && cards.length >= count) {
          setDrawnCards(cards.slice(0, count));
          return;
        }
        setDrawnCards(pickFallbacks(count));
      })
      .catch(() => setDrawnCards(pickFallbacks(count)));
  }, [deckId, count, onDraw]);

  // Reshuffle only the cards still in the deck — anything already dropped into a
  // slot stays put and rides through the shuffle untouched.
  const handleShuffle = React.useCallback(() => {
    setShuffleSeed((s) => s + 1);
    setPhase("shuffling");
    setTimeout(() => setPhase("arc"), SHUFFLE_COLLAPSE_MS);
  }, []);

  // Restart (from the reveal screen) clears every pick, draws a fresh set of
  // cards, and shuffles the full deck — so the same card(s) don't just reappear.
  const handleRestart = React.useCallback(() => {
    setSelectedIndices([]);
    setExpandedCardIndex(null);
    setSaved(false);
    void onDraw(deckId, count)
      .then((cards) => {
        if (cards && cards.length >= count) {
          setDrawnCards(cards.slice(0, count));
          return;
        }
        setDrawnCards(pickFallbacks(count));
      })
      .catch(() => setDrawnCards(pickFallbacks(count)));
    handleShuffle();
  }, [onDraw, deckId, count, handleShuffle]);

  // Reading flows into the journal: onSaveCards hands the reader off to the
  // note editor (where the card is saved together with what they write), so we
  // don't show a "saved" toast here. Guard against a double-tap during handoff.
  const handleSaveCards = React.useCallback(async () => {
    if (!onSaveCards || saving || saved) return;
    const toSave = drawnCards.slice(0, count);
    if (toSave.length === 0) return;
    setSaving(true);
    try {
      await onSaveCards(toSave);
      setSaved(true);
    } catch {
      toast.error("We couldn't open your journal. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [onSaveCards, saving, saved, drawnCards, count]);

  const handleCloseReveal = onExit;

  React.useEffect(() => {
    if (phase !== "reveal" || expandedCardIndex !== null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleCloseReveal();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, expandedCardIndex, handleCloseReveal]);

  const handleCardSelect = React.useCallback(
    (cardIndex: number) => {
      if (phase !== "arc") return;
      if (selectedIndices.includes(cardIndex) || selectedIndices.length >= count) return;
      const newSelected = [...selectedIndices, cardIndex];
      setSelectedIndices(newSelected);
      if (newSelected.length === count) {
        setTimeout(() => {
          setRevealVisible(false);
          setPhase("reveal");
          setTimeout(() => setRevealVisible(true), 80);
        }, SELECT_TO_REVEAL_MS);
      }
    },
    [phase, selectedIndices, count],
  );

  const getTargetPosition = React.useCallback(
    (cardIndex: number): CardPos => {
      const selectedIdx = selectedIndices.indexOf(cardIndex);
      if (selectedIdx !== -1) return slotPositions[selectedIdx]!;
      if (phase === "shuffling") return stackPositions[cardIndex]!;
      if (phase === "arc" || phase === "reveal") {
        const arcSlot = arcSlotByCard.get(cardIndex) ?? cardIndex;
        return arcPositions[arcSlot]!;
      }
      return scatterPositions[cardIndex]!;
    },
    [phase, selectedIndices, scatterPositions, stackPositions, arcPositions, arcSlotByCard, slotPositions],
  );

  if (phase === "loading" || !deckId) {
    return (
      <div className="flex flex-col items-center gap-8 py-12">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-3 md:grid-cols-6">
          {Array.from({ length: 12 }, (_, i) => (
            <Skeleton key={i} className="aspect-[3/4] w-20 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (phase === "scatter" || phase === "shuffling" || phase === "arc") {
    const showQuestion = phase === "scatter";
    const showSlots = phase === "arc";
    const interactive = phase === "arc";
    const allPicked = selectedIndices.length >= count;

    const pickerHint =
      phase === "scatter"
        ? "Enter your question, then press Shuffle Card"
        : phase === "shuffling"
          ? "Shuffling…"
          : count === 2 && selectedIndices.length === 0
            ? "Choose your first card"
            : count === 2 && selectedIndices.length === 1
              ? "Choose your second card"
              : count === 1 && selectedIndices.length === 0
                ? "Tap any card to reveal"
                : "Revealing your cards…";

    return (
      <div
        className="fixed inset-0 z-40 flex flex-col bg-[rgba(40,0,0,0.55)] backdrop-blur-[12px]"
        role="dialog"
        aria-label="Card spread"
      >
        {showQuestion ? (
          <div className="z-30 flex shrink-0 items-center justify-center px-4 pt-2 md:pt-3">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Enter Your Question or Subject Here (Optional)"
              aria-label="Question or subject"
              className="h-10 w-full max-w-[360px] rounded-[30px] border border-white/60 bg-white/15 px-4 text-sm text-white placeholder:text-white/80 placeholder:opacity-80 focus:border-white/80 focus:outline-none focus:ring-1 focus:ring-white/30"
            />
          </div>
        ) : (
          <div className="z-30 shrink-0 pt-2 md:pt-3" aria-hidden />
        )}

        <div className="z-30 flex shrink-0 items-center justify-center pt-3 pb-6 md:pb-10">
          <p className="text-sm text-white/80 drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)]">
            {pickerHint}
          </p>
        </div>

        <div className="relative min-h-0 flex-1">
          {showSlots &&
            slotPositions.map((slot, i) => (
              <div
                key={`slot-${i}`}
                aria-hidden
                className="pointer-events-none absolute aspect-[143/215] w-[clamp(64px,8vw,143px)] rounded-[16px] border-[1.5px] border-white/40"
                style={{
                  left: `${slot.x}%`,
                  top: `${slot.y}%`,
                  transform: "translate(-50%, -50%)",
                }}
              />
            ))}

          {Array.from({ length: SPREAD_TOTAL }, (_, i) => (
            <SpreadCard
              key={i}
              index={i}
              position={getTargetPosition(i)}
              isSelected={selectedIndices.includes(i)}
              isDisabled={!interactive || (allPicked && !selectedIndices.includes(i))}
              onClick={() => handleCardSelect(i)}
            />
          ))}
        </div>

        <div className="z-30 flex shrink-0 items-center justify-center px-4 pb-6 md:pb-8">
          <button
            type="button"
            onClick={handleShuffle}
            disabled={phase === "shuffling" || allPicked}
            className="relative flex h-[60px] w-full max-w-[392px] items-center justify-center gap-2 overflow-hidden rounded-[30px] bg-[#690f04] bg-btn-brand text-xl font-bold capitalize text-white transition hover:brightness-110 active:brightness-95 disabled:opacity-60"
          >
            <Shuffle className="size-5" />
            Shuffle Card
          </button>
        </div>
      </div>
    );
  }

  if (phase === "reveal") {
    const revealCards = drawnCards.slice(0, count);

    return (
      <>
        <div
          className="fixed inset-0 z-40 flex flex-col bg-[rgba(40,0,0,0.55)] backdrop-blur-[12px]"
          role="dialog"
          aria-label="Your cards"
          onClick={handleCloseReveal}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleCloseReveal();
            }}
            className="absolute right-4 top-4 z-40 flex size-10 items-center justify-center text-white transition hover:opacity-80 md:right-8 md:top-8"
            aria-label="Close"
          >
            <X className="size-6" strokeWidth={2.5} />
          </button>

          <div
            className="z-30 flex shrink-0 flex-col items-center px-4 pt-8 text-center md:pt-12"
            style={{
              opacity: revealVisible ? 1 : 0,
              transform: revealVisible ? "translateY(0)" : "translateY(8px)",
              transition: "opacity 0.5s ease-out, transform 0.5s ease-out",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h1 className="font-display text-3xl text-white md:text-[35px]">
              Card Desk
            </h1>
            <p className="mt-2 text-sm text-white/75">
              {revealCards.length > 1
                ? "Tap a card to reveal its art, then tap again to read its message."
                : "Tap your card to reveal its art, then tap again to read its message."}
            </p>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center px-4">
            <div
              className="flex items-center justify-center gap-3 sm:gap-8 md:gap-16"
              onClick={(e) => e.stopPropagation()}
            >
              {revealCards.map((card, i) => (
                <RevealBigCard
                  key={card.id}
                  card={card}
                  index={i}
                  count={count}
                  visible={revealVisible}
                  onClick={() => setExpandedCardIndex(i)}
                />
              ))}
            </div>
          </div>

          <div
            className="relative z-30 flex shrink-0 items-center justify-center px-6 pb-6 md:pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            {onSaveCards ? (
              <button
                type="button"
                onClick={handleSaveCards}
                disabled={saving || saved}
                className="flex h-11 items-center justify-center gap-2 rounded-pill bg-btn-brand px-6 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(0,0,0,0.35)] transition hover:brightness-110 active:brightness-95 disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : saved ? (
                  <Check className="size-4" />
                ) : (
                  <Bookmark className="size-4" />
                )}
                {saved ? "Saved" : "Save Cards"}
              </button>
            ) : null}

            {onSaveCards ? (
              <button
                type="button"
                onClick={handleRestart}
                className="absolute right-6 flex h-10 items-center justify-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 text-xs font-semibold uppercase tracking-wide text-white/85 backdrop-blur-sm transition hover:bg-white/15 md:right-8"
                aria-label="Restart and draw again"
              >
                <Shuffle className="size-3.5" />
                Restart
              </button>
            ) : null}
          </div>
        </div>

        {expandedCardIndex !== null && drawnCards[expandedCardIndex] && (
          <OracleDrawCardZoomOverlay
            card={drawnCards[expandedCardIndex]}
            onClose={() => setExpandedCardIndex(null)}
          />
        )}
      </>
    );
  }

  return null;
}
