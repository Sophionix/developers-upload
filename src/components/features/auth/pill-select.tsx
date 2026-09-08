"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "@/lib/ui/icons";
import type { LucideIcon } from "@/lib/ui/icons";
import { cn } from "@/lib/ui/cn";

type PillSelectProps = {
  icon?: LucideIcon;
  placeholder?: string;
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  /** Show a trailing calendar/chevron icon. Defaults to chevron. */
  trailingIcon?: LucideIcon;
};

export function PillSelect({
  icon: Icon,
  placeholder,
  value,
  onValueChange,
  children,
  className,
  disabled,
  trailingIcon: TrailingIcon,
}: PillSelectProps) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange} {...(disabled ? { disabled: true } : {})}>
      <SelectPrimitive.Trigger
        className={cn(
          "flex h-14 w-full items-center gap-3 rounded-pill border border-white/10 bg-surface pr-4",
          Icon ? "pl-1.5" : "pl-5",
          "transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "[&_.pill-select-value]:line-clamp-1",
          className,
        )}
      >
        {Icon ? (
          <span aria-hidden className="grid size-10 shrink-0 place-items-center">
            <Icon className="size-5 text-primary" />
          </span>
        ) : null}
        <span className="pill-select-value flex-1 text-left text-base text-muted-foreground">
          <SelectPrimitive.Value placeholder={placeholder} />
        </span>
        <SelectPrimitive.Icon asChild>
          {TrailingIcon ? (
            <TrailingIcon className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          )}
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          className={cn(
            "relative z-50 max-h-72 min-w-32 overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-elevated",
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
          <SelectPrimitive.Viewport className="p-1 h-(--radix-select-trigger-height) w-full min-w-(--radix-select-trigger-width)">
            {children}
          </SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton className="flex cursor-default items-center justify-center py-1">
            <ChevronDown className="size-4" />
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

export function PillSelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      className={cn(
        "relative flex w-full cursor-default select-none items-center rounded-sm py-2 pl-8 pr-2 text-sm outline-none",
        "focus:bg-muted focus:text-foreground",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <span className="absolute left-2 flex size-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="size-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}
