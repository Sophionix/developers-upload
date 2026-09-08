"use client";

import Link from "next/link";
import { AppModal } from "@/components/ui/app-modal";
import { Button } from "@/components/ui/button";
import { Lock } from "@/lib/ui/icons";

type GuestAuthModalProps = {
  /** Called when the modal should close (X click or backdrop click). */
  onClose: () => void;
};

/**
 * Shown when a guest taps a locked nav item. Rather than navigating, we prompt
 * them to sign up or log in to unlock the feature.
 */
export function GuestAuthModal({ onClose }: GuestAuthModalProps) {
  return (
    <AppModal title="Members Only" onClose={onClose}>
      <div className="flex flex-col items-center gap-5 pt-4">
        <div className="flex size-20 items-center justify-center rounded-full bg-primary shadow-[0_0_24px_rgba(229,88,5,0.4)]">
          <Lock className="size-9 text-white" />
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Sign up or log in to unlock
          <br />
          this feature.
        </p>

        <div className="flex w-full gap-3">
          <Button
            asChild
            size="lg"
            variant="outline"
            className="h-12 flex-1 rounded-pill border-border bg-black/50 text-foreground hover:bg-black/70"
          >
            <Link href="/login">Login</Link>
          </Button>
          <Button
            asChild
            size="lg"
            className="h-12 flex-1 rounded-pill bg-btn-brand text-white hover:brightness-110 active:brightness-95"
          >
            <Link href="/signup?claim=1">Signup</Link>
          </Button>
        </div>
      </div>
    </AppModal>
  );
}
