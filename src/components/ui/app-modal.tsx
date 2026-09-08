"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "@/lib/ui/icons";
import { cn } from "@/lib/ui/cn";

/** Mount state never changes after hydration, so no subscription is needed. */
const subscribeNoop = () => () => {};

type AppModalProps = {
  /** Modal title shown in the header. */
  title: string;
  /** Whether to show the close (X) button in the header. Default true. */
  showClose?: boolean;
  /** Called when the modal should close (X click or backdrop click). */
  onClose: () => void;
  /** z-index layer — use higher values for stacked modals. Default 50. */
  zIndex?: 50 | 60 | 70;
  /** Additional className for the modal container. */
  className?: string;
  children: React.ReactNode;
};

export function AppModal({
  title,
  showClose = true,
  onClose,
  zIndex = 50,
  className,
  children,
}: AppModalProps) {
  const overlayRef = React.useRef<HTMLDivElement>(null);
  // Portal to <body>: callers render this from inside `overflow-hidden`
  // containers (e.g. the sidebar rail), which clip a `fixed` overlay.
  // `document` is absent during SSR, so only portal once mounted on the client.
  const mounted = React.useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );

  const zClass =
    zIndex === 70 ? "z-[70]" : zIndex === 60 ? "z-[60]" : "z-50";

  if (!mounted) return null;

  return createPortal(
    <div
      ref={overlayRef}
      className={cn(
        "fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm",
        zClass,
      )}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        className={cn(
          "flex w-112.5 max-w-[95vw] flex-col overflow-hidden rounded-pill shadow-2xl",
          className,
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between bg-btn-brand px-6 py-4">
          {showClose ? <span className="w-8" /> : null}
          <h2
            className={cn(
              "text-lg font-bold text-white",
              !showClose && "w-full text-center",
            )}
          >
            {title}
          </h2>
          {showClose ? (
            <button
              type="button"
              onClick={onClose}
              className="flex size-8 items-center justify-center rounded-full text-white/80 transition-colors hover:text-white"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
          ) : null}
        </div>

        {/* Body */}
        <div className="rounded-b-pill border border-t-0 border-white bg-transparent px-5 pb-5 pt-4">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
