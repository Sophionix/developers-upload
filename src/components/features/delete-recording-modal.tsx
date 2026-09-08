"use client";

import * as React from "react";
import { AppModal } from "@/components/ui/app-modal";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from "@/lib/ui/icons";

interface DeleteRecordingModalProps {
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function DeleteRecordingModal({ onClose, onConfirm }: DeleteRecordingModalProps) {
  const [isDeleting, setIsDeleting] = React.useState(false);

  async function handleDelete() {
    setIsDeleting(true);
    try {
      await onConfirm();
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <AppModal title="Delete Note" onClose={onClose} showClose={false}>
      <div className="flex flex-col items-center gap-5 py-2">
        {/* Red trash icon */}
        <div className="flex size-20 items-center justify-center rounded-full bg-destructive shadow-lg shadow-destructive/30">
          <Trash2 className="size-9 text-white" />
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Are you sure you want to delete
          <br />
          this Recordings?
        </p>

        <div className="flex w-full gap-3">
          <Button
            variant="outline"
            size="lg"
            className="flex-1"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? <Loader2 className="size-4 animate-spin" /> : "Delete"}
          </Button>
          <Button
            variant="brand"
            size="lg"
            className="flex-1"
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </Button>
        </div>
      </div>
    </AppModal>
  );
}
