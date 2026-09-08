import * as React from "react";

type AuthRightColumnProps = {
  /** Top-left affordance — typically a back button. */
  leading?: React.ReactNode;
  /** Top-right affordance — typically a Skip link. */
  trailing?: React.ReactNode;
  /** Optional footer content (e.g. slide dots). */
  footer?: React.ReactNode;
  /** "center" (default) for short forms, "top" for long scrollable content. */
  align?: "center" | "top";
  children: React.ReactNode;
};

/**
 * Right-column template for every auth/marketing page.
 * The outer grid + static left brand panel live in the route-group layout
 * (`(auth)/layout.tsx`, `(marketing)/layout.tsx`), so the left panel stays
 * mounted across intra-group navigation; only this template re-renders.
 */
export function AuthRightColumn({ leading, trailing, footer, align = "center", children }: AuthRightColumnProps) {
  return (
    <>
      <header className="flex shrink-0 items-center justify-between gap-4 px-4 pt-3 xl:px-8 xl:pt-5">
        <div>{leading}</div>
        <div>{trailing}</div>
      </header>
      <div className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col overflow-y-auto px-4 py-2 xl:max-w-2xl xl:px-8 xl:py-4">
        <div className={`flex min-h-0 flex-1 flex-col gap-3 xl:gap-6${align === "center" ? " my-auto" : ""}`}>
          {children}
        </div>
      </div>
      {footer ? (
        <footer className="flex shrink-0 items-center justify-center gap-3 pb-3 xl:pb-6">{footer}</footer>
      ) : null}
    </>
  );
}
