import { cn } from "@/lib/ui/cn";

/**
 * Full-bleed signature background. Place at the root of authenticated shells to
 * get the Sophionix "lava" atmosphere: solid black base + faint crack texture.
 * Positions itself absolutely; the parent must be `relative`.
 */
export function LavaBackground({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 -z-10 bg-background",
        className,
      )}
    >
      <div className="absolute inset-0 bg-lava-texture opacity-20" />
    </div>
  );
}
