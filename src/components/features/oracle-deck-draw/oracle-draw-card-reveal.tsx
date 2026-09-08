"use client";

import * as React from "react";
import Image from "next/image";
import { Sparkles, X } from "@/lib/ui/icons";
import type { DrawCard } from "@/components/features/oracle-deck-draw/oracle-deck-draw-types";

export function OracleDrawFlipCard({ card }: { card: DrawCard }) {
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
        <div
          className="absolute inset-0 overflow-hidden rounded-[21px] border border-white/30 bg-[#1a0101] shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
          style={{ backfaceVisibility: "hidden" }}
        >
          {card.imageUrl ? (
            <Image
              src={card.imageUrl}
              alt={card.title}
              fill
              className="object-cover"
              sizes="(min-width: 768px) 468px, 86vw"
              priority
            />
          ) : (
            <div className="flex size-full items-center justify-center bg-brand-grad">
              <Sparkles className="size-16 text-white/60" />
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/92 via-black/45 to-transparent px-5 pb-5 pt-10 text-center">
            <p className="font-display text-[1.5rem] font-medium leading-snug tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.85)] md:text-[1.75rem]">
              Sophionix Key: {card.title}
            </p>
            <p className="mt-2.5 text-[11px] font-medium uppercase tracking-[0.22em] text-white/70 md:text-xs">
              Tap to read the message
            </p>
          </div>
        </div>

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

export interface OracleDrawCardZoomOverlayProps {
  card: DrawCard;
  onClose: () => void;
  /** Rendered below the flip card (e.g. Save); clicks do not close the overlay. */
  footer?: React.ReactNode;
}

export function OracleDrawCardZoomOverlay({
  card,
  onClose,
  footer,
}: OracleDrawCardZoomOverlayProps) {
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
      aria-label="Card detail"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[min(92vh,900px)] flex-col items-center gap-5"
        style={{
          opacity: open ? 1 : 0,
          transform: open ? "scale(1)" : "scale(0.55)",
          transition:
            "opacity 0.35s ease-out, transform 0.6s cubic-bezier(0.34,1.56,0.64,1)",
        }}
      >
        <OracleDrawFlipCard key={card.id} card={card} />
        {footer ? <div className="flex shrink-0 flex-wrap items-center justify-center gap-3">{footer}</div> : null}
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
