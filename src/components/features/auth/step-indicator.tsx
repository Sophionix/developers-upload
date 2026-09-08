import { cn } from "@/lib/ui/cn";

type StepIndicatorProps = {
  total: number;
  current: number;
  className?: string;
};

export function StepIndicator({ total, current, className }: StepIndicatorProps) {
  return (
    <div className={cn("flex items-center justify-center gap-2", className)} aria-label={`Step ${current + 1} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          aria-hidden
          className={cn(
            "h-1.5 rounded-pill transition-all duration-(--duration-standard) ease-(--ease-brand)",
            i === current ? "w-8 bg-primary" : "w-4 bg-muted",
          )}
        />
      ))}
    </div>
  );
}
