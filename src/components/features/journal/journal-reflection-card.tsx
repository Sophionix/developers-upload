import Image from "next/image";
import { Sparkles } from "@/lib/ui/icons";
import type { CardDetailDto } from "@/lib/dto/card";

/**
 * The card a journal entry was written about, saved together with the note.
 * Shown at the top of the note editor (so the reader can see the card while
 * they write) and on the entry view (so the saved card stays with the entry).
 */
export function JournalReflectionCard({ card }: { card: CardDetailDto }) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-white/15 bg-surface p-4">
      <div className="flex gap-4">
        <div className="relative aspect-[226/317] w-24 shrink-0 overflow-hidden rounded-xl border border-white/20 bg-[#1a0101]">
          {card.imageUrl ? (
            <Image
              src={card.imageUrl}
              alt={card.title}
              fill
              className="object-cover"
              sizes="96px"
            />
          ) : (
            <div className="flex size-full items-center justify-center bg-brand-grad">
              <Sparkles className="size-8 text-white/60" />
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-col justify-center gap-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            Sophionix Key
          </p>
          <h2 className="font-display text-lg font-medium leading-tight text-foreground">
            {card.title}
          </h2>
        </div>
      </div>

      <div className="max-h-40 overflow-y-auto overscroll-contain whitespace-pre-line border-t border-white/10 pt-4 text-sm leading-relaxed text-muted-foreground">
        {card.message.trim()}
      </div>

      {card.prompt ? (
        <div className="border-t border-white/10 pt-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#f5e6a3]">
            Reflection
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-foreground">
            {card.prompt}
          </p>
        </div>
      ) : null}
    </div>
  );
}
