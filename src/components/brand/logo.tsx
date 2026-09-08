import Image from "next/image";
import { cn } from "@/lib/ui/cn";
import { tv, type VariantProps } from "@/lib/ui/variants";

const logo = tv({
  slots: {
    root: "inline-flex items-center gap-2 font-display tracking-tight select-none",
    mark: "shrink-0",
    wordmark: "text-foreground leading-none",
  },
  variants: {
    size: {
      sm: { mark: "size-6", wordmark: "text-base" },
      md: { mark: "size-9", wordmark: "text-2xl" },
      lg: { mark: "size-14", wordmark: "text-4xl" },
    },
  },
  defaultVariants: { size: "md" },
});

type LogoProps = VariantProps<typeof logo> & {
  className?: string;
  showWordmark?: boolean;
  showMark?: boolean;
};

/**
 * Sophionix logo — brand mark (public/logo.svg) + wordmark.
 * next/image for idiomatic Next 16; `priority` since the logo is above-the-fold on every shell.
 */
export function Logo({
  className,
  size,
  showWordmark = true,
  showMark = true,
}: LogoProps) {
  const { root, mark, wordmark } = logo({ size });
  return (
    <span className={cn(root(), className)} aria-label="Sophionix">
      {showMark && (
        <Image
          src="/logo.svg"
          alt=""
          width={64}
          height={64}
          priority
          className={mark()}
          aria-hidden
        />
      )}
      {showWordmark && <span className={wordmark()}>Sophionix</span>}
    </span>
  );
}
