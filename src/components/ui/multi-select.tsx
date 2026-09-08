"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronDown, X } from "@/lib/ui/icons";
import { cn } from "@/lib/ui/cn";

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  selected: string[];
  onSelectedChange: (values: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
}

export function MultiSelect({
  options,
  selected,
  onSelectedChange,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyText = "No results.",
  disabled = false,
  className,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);

  const selectedSet = new Set(selected);

  function toggle(value: string) {
    const next = new Set(selectedSet);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    onSelectedChange(Array.from(next));
  }

  function remove(value: string) {
    onSelectedChange(selected.filter((v) => v !== value));
  }

  const selectedLabels = selected
    .map((v) => options.find((o) => o.value === v))
    .filter(Boolean) as MultiSelectOption[];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          className={cn(
            "flex min-h-[38px] w-full items-center justify-between rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-foreground outline-none",
            "focus:border-primary focus:ring-1 focus:ring-primary/40",
            "disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
        >
          <div className="flex flex-1 flex-wrap gap-1">
            {selectedLabels.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              selectedLabels.map((item) => (
                <Badge key={item.value} variant="secondary" className="gap-0.5 pr-1">
                  {item.label}
                  <span
                    role="button"
                    tabIndex={0}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(item.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.stopPropagation();
                        remove(item.value);
                      }
                    }}
                  >
                    <X className="size-3" />
                  </span>
                </Badge>
              ))
            )}
          </div>
          <ChevronDown className="ml-2 size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selectedSet.has(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => toggle(option.value)}
                  >
                    <div
                      className={cn(
                        "mr-2 flex size-4 items-center justify-center rounded-sm border border-border",
                        isSelected && "border-primary bg-primary text-primary-foreground",
                      )}
                    >
                      {isSelected ? <Check className="size-3" /> : null}
                    </div>
                    {option.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
