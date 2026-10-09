"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Continue",
  onConfirm,
  confirmDisabled,
  extra,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm?: () => void;
  confirmDisabled?: boolean;
  extra?: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-none border border-[#02150a] bg-[#fdf9f0] p-6 shadow-none sm:rounded-none">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-semibold normal-case tracking-tight text-primary">
            {title}
          </DialogTitle>
          <DialogDescription className="text-[15px] leading-6 text-[#424843]">
            {description}
          </DialogDescription>
        </DialogHeader>
        {extra}
        <DialogFooter className="mt-4 gap-2">
          <button
            type="button"
            className="border border-[#e6e2d9] bg-white px-4 py-2.5 text-sm font-semibold"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={confirmDisabled}
            className="bg-[#d04400] px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-55"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
