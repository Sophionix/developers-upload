import Image from "next/image";
import { cn } from "@/lib/ui/cn";

/**
 * Deck / oracle card face — aligned to Sophionix Final UI Figma `0:7221`.
 * Text scales via container query width units (cqw) so it looks identical
 * at any rendered size — small dashboard tile or full-screen hero.
 */

export function splitDeckTitleLines(title: string): {
  first: string;
  second: string | null;
} {
  const delims = ["\n", " — ", " – ", " - ", " | ", " · "] as const;
  for (const d of delims) {
    const i = title.indexOf(d);
    if (i > 0 && i < title.length - d.length) {
      const first = title.slice(0, i).trim();
      const second = title.slice(i + d.length).trim();
      if (first && second) return { first, second };
    }
  }
  return { first: title.trim(), second: null };
}

export type OracleDeckTileFaceProps = {
  coverSrc: string;
  titleLine1: string;
  titleLine2?: string | null;
  footer?: string | null;
  footerNote?: string | null;
  density?: "hero" | "compact";
  showMark?: boolean;
  monochromeArt?: boolean;
  alt?: string;
  className?: string;
};

export function OracleDeckTileFace({
  coverSrc,
  titleLine1,
  titleLine2,
  footer,
  footerNote,
  density = "hero",
  showMark = false,
  alt = "",
  className,
  monochromeArt = false,
}: OracleDeckTileFaceProps) {
  const compact = density === "compact";
  const radius = "rounded-[16px]";

  const footerNoteLines = footerNote
    ? footerNote.split(/\n+/).map((s) => s.trim()).filter(Boolean)
    : [];

  return (
    /* @container establishes the sizing context — all cqw units below reference this element's width */
    <div
      className={cn(
        "@container absolute inset-0 overflow-hidden border-[0.8px] border-[rgba(255,255,255,0.5)]",
        radius,
        className,
      )}
    >
      {/* Card art */}
      <Image
        src={coverSrc}
        alt={alt}
        fill
        className={cn(
          "object-cover",
          monochromeArt && "grayscale contrast-[1.08] brightness-[1.05]",
          compact ? "object-[center_6%]" : "object-[center_4.19%]",
        )}
        sizes="(max-width: 768px) 30vw, 200px"
      />

      {/* Top + bottom dark gradient vignette */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-b from-[rgba(0,0,0,0.6)] via-[rgba(0,0,0,0)] via-[62.5%] to-[rgba(0,0,0,0.6)]",
          radius,
        )}
        aria-hidden
      />

      {showMark && (
        <div className="pointer-events-none absolute left-[4cqw] top-[4cqw] z-[2] size-[12cqw] opacity-95 drop-shadow-md">
          <Image src="/logo.svg" alt="" width={28} height={28} className="size-full object-contain" aria-hidden />
        </div>
      )}

      {/* Title block — top of card */}
      <div className="pointer-events-none absolute inset-x-[4cqw] z-[1] text-center antialiased top-[8cqw]">
        <p className="line-clamp-2 break-words font-display font-normal leading-snug text-accent text-[11cqw]">
          {titleLine1}
        </p>
        {titleLine2 && (
          <p className="mt-[2cqw] line-clamp-2 break-words font-display font-normal leading-snug text-accent text-[9cqw]">
            {titleLine2}
          </p>
        )}
      </div>

      {/* Footer block — bottom of card */}
      {(footer || footerNote) && (
        <div className="pointer-events-none absolute inset-x-[4cqw] bottom-0 z-[1] pb-[6cqw] text-center antialiased">
          {footer && (
            <p
              className={cn(
                "line-clamp-3 break-words font-normal leading-normal text-white",
                footerNote ? "font-display text-[7.5cqw]" : "whitespace-pre-line font-sans text-[6.5cqw]",
              )}
            >
              {footer}
            </p>
          )}
          {footerNoteLines.length > 0 && (
            <div className={cn("font-sans font-normal leading-snug text-white text-[6cqw]", footer && "mt-[2cqw]")}>
              {footerNoteLines.map((line, i) => (
                <p key={i} className="leading-normal">{line}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
