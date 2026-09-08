"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "@/lib/ui/icons";
import { cn } from "@/lib/ui/cn";
import { DIAL_OPTIONS } from "@/lib/data/geo";

type PhoneInputProps = {
  dialCode: string;
  onDialCodeChange: (code: string) => void;
  phone: string;
  onPhoneChange: (phone: string) => void;
  /**
   * Country ISO (lowercased) driving the flag + which entry reads as selected.
   * Several countries share a dial code (+1 is US, CA, and the Caribbean), so
   * the dial code alone can't identify the right row.
   */
  country?: string;
  className?: string;
  disabled?: boolean;
  name?: string;
};

export function PhoneInput({
  dialCode,
  onDialCodeChange,
  phone,
  onPhoneChange,
  country,
  className,
  disabled,
  name = "phone",
}: PhoneInputProps) {
  // Prefer the exact country row; fall back to the first country with this
  // dial code so the flag still renders when no country is chosen yet.
  const selected =
    (country ? DIAL_OPTIONS.find((c) => c.country === country) : undefined) ??
    DIAL_OPTIONS.find((c) => c.dialCode === dialCode);

  return (
    <div className={cn("flex gap-2", className)}>
      <SelectPrimitive.Root
        value={selected?.country ?? ""}
        onValueChange={(iso) => {
          const next = DIAL_OPTIONS.find((c) => c.country === iso);
          if (next) onDialCodeChange(next.dialCode);
        }}
        {...(disabled ? { disabled: true } : {})}
      >
        <SelectPrimitive.Trigger
          className={cn(
            "flex h-14 shrink-0 items-center gap-1.5 rounded-pill border border-white/10 bg-surface px-3",
            "transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          <span className="text-base">{selected?.flag ?? "🌐"}</span>
          <span className="text-sm text-muted-foreground">{dialCode}</span>
          <SelectPrimitive.Icon asChild>
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            className={cn(
              "relative z-50 max-h-72 min-w-60 overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-elevated",
              "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
              "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
              "data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2",
              "data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1",
            )}
            position="popper"
          >
            <SelectPrimitive.ScrollUpButton className="flex cursor-default items-center justify-center py-1">
              <ChevronUp className="size-4" />
            </SelectPrimitive.ScrollUpButton>
            <SelectPrimitive.Viewport className="p-1">
              {DIAL_OPTIONS.map((code) => (
                <SelectPrimitive.Item
                  key={code.country}
                  value={code.country}
                  className={cn(
                    "relative flex w-full cursor-default select-none items-center rounded-sm py-2 pl-8 pr-2 text-sm outline-none",
                    "focus:bg-muted focus:text-foreground",
                  )}
                >
                  <span className="absolute left-2 flex size-3.5 items-center justify-center">
                    <SelectPrimitive.ItemIndicator>
                      <Check className="size-4" />
                    </SelectPrimitive.ItemIndicator>
                  </span>
                  <SelectPrimitive.ItemText>
                    {code.flag} {code.label}
                  </SelectPrimitive.ItemText>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
            <SelectPrimitive.ScrollDownButton className="flex cursor-default items-center justify-center py-1">
              <ChevronDown className="size-4" />
            </SelectPrimitive.ScrollDownButton>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>

      <div
        className={cn(
          "flex h-14 flex-1 items-center rounded-pill border border-white/10 bg-surface px-4",
          "transition-colors focus-within:border-primary/60 focus-within:ring-1 focus-within:ring-primary/40",
        )}
      >
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="(555) 123-4567"
          value={phone}
          onChange={(e) => onPhoneChange(e.target.value.replace(/[^\d\s()-]/g, ""))}
          disabled={disabled}
          name={name}
          className="h-full w-full border-none bg-transparent text-base text-foreground placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>
    </div>
  );
}
