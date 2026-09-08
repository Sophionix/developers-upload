"use client";

import { Toaster as SonnerToaster, toast } from "sonner";

/**
 * Sonner-based toast. Mount <Toaster/> once at the app root; trigger with `toast(...)`.
 * Re-exports `toast` so callers can import from one place: `import { toast, Toaster } from "@/components/ui/toast"`.
 */
export function Toaster(props: React.ComponentProps<typeof SonnerToaster>) {
  return (
    <SonnerToaster
      theme="dark"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-popover group-[.toaster]:text-popover-foreground group-[.toaster]:border-border group-[.toaster]:shadow-elevated",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
}

export { toast };
