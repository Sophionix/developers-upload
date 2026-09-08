"use client";

import { AppModal } from "@/components/ui/app-modal";
import { Button } from "@/components/ui/button";
import { LogOut } from "@/lib/ui/icons";

type LogoutModalProps = {
  onConfirm: () => void;
  onCancel: () => void;
};

export function LogoutModal({ onConfirm, onCancel }: LogoutModalProps) {
  return (
    <AppModal title="Logout" onClose={onCancel}>
      <div className="flex flex-col items-center gap-5 pt-4">
        <div className="flex size-20 items-center justify-center rounded-full bg-primary shadow-[0_0_24px_rgba(229,88,5,0.4)]">
          <LogOut className="size-9 text-white" />
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Are you sure you want to
          <br />
          logout?
        </p>

        <div className="flex w-full gap-3">
          <Button
            size="lg"
            variant="outline"
            onClick={onConfirm}
            className="h-12 flex-1 rounded-pill border-border bg-black/50 text-foreground hover:bg-black/70"
          >
            Logout
          </Button>
          <Button
            size="lg"
            onClick={onCancel}
            className="h-12 flex-1 rounded-pill bg-btn-brand text-white hover:brightness-110 active:brightness-95"
          >
            Cancel
          </Button>
        </div>
      </div>
    </AppModal>
  );
}
