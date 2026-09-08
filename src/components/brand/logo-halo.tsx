import Image from "next/image";
import { cn } from "@/lib/ui/cn";

/**
 * Sophionix brand mark rendered inside a glowing burnt-orange halo.
 * Signature hero treatment used on the auth splash + welcome surfaces
 * (Figma 2037:10922, 1908:7180, 1908:6869).
 */
export function LogoHalo({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative grid size-28 place-items-center rounded-full sm:size-52 lg:size-80",
        className,
      )}
    >
      <div
        aria-hidden
        className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,var(--brand-500)_0%,var(--brand-700)_45%,transparent_72%)] blur-xl opacity-80"
      />
      <div
        aria-hidden
        className="absolute inset-6 rounded-full bg-[radial-gradient(circle_at_center,var(--brand-500)_0%,var(--brand-900)_70%)] shadow-glow-brand"
      />
      <div className="relative grid size-[58%] place-items-center rounded-full bg-background/90 ring-1 ring-white/10">
        <Image
          src="/logo.svg"
          alt=""
          width={220}
          height={220}
          priority
          className="size-[72%] object-contain"
          aria-hidden
        />
      </div>
    </div>
  );
}
