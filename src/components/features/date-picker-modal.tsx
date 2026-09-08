"use client";

import * as React from "react";
import { AppModal } from "@/components/ui/app-modal";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "@/lib/ui/icons";
import { cn } from "@/lib/ui/cn";

interface DatePickerModalProps {
  onClose: () => void;
  onDone: (date: Date | null) => void;
  selectedDate: Date | null;
  /** Set of date strings (YYYY-MM-DD) that have recordings — shown with dots */
  datesWithRecordings?: Set<string>;
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getMonthGrid(year: number, month: number): (number | null)[][] {
  const firstDay = new Date(year, month, 1);
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();

  const cells: (number | null)[] = [];

  for (let i = startDow - 1; i >= 0; i--) {
    cells.push(-(daysInPrev - i));
  }

  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(d);
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

function dotCount(dateKey: string, datesSet: Set<string>): number {
  return datesSet.has(dateKey) ? 1 : 0;
}

export function DatePickerModal({
  onClose,
  onDone,
  selectedDate,
  datesWithRecordings = new Set(),
}: DatePickerModalProps) {
  const now = new Date();
  const [viewYear, setViewYear] = React.useState(selectedDate?.getFullYear() ?? now.getFullYear());
  const [viewMonth, setViewMonth] = React.useState(selectedDate?.getMonth() ?? now.getMonth());
  const [picked, setPicked] = React.useState<Date | null>(selectedDate);

  const weeks = getMonthGrid(viewYear, viewMonth);
  const monthName = new Date(viewYear, viewMonth).toLocaleDateString("en-US", { month: "long" });

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  function handleDayClick(day: number) {
    const d = new Date(viewYear, viewMonth, day);
    setPicked(d);
  }

  const pickedKey = picked ? toDateKey(picked) : null;

  return (
    <AppModal title="Select Date" onClose={onClose}>
      <div className="flex flex-col gap-4">
        {/* Month navigation */}
        <div className="flex items-center justify-between px-2">
          <button
            type="button"
            onClick={prevMonth}
            className="flex size-8 items-center justify-center rounded-full text-foreground transition-colors hover:bg-white/10"
            aria-label="Previous month"
          >
            <ChevronLeft className="size-5" />
          </button>
          <div className="text-center">
            <p className="text-base font-semibold text-foreground">{monthName}</p>
            <p className="text-xs text-muted-foreground">{viewYear}</p>
          </div>
          <button
            type="button"
            onClick={nextMonth}
            className="flex size-8 items-center justify-center rounded-full text-foreground transition-colors hover:bg-white/10"
            aria-label="Next month"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>

        {/* Day labels */}
        <div className="grid grid-cols-7 text-center text-xs font-medium text-muted-foreground">
          {DAY_LABELS.map((d) => (
            <span key={d} className="py-1">{d}</span>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="flex flex-col">
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 text-center">
              {week.map((day, di) => {
                if (day === null || day < 1) {
                  const displayDay = day === null ? "" : String(new Date(viewYear, viewMonth, 0).getDate() + day + 1);
                  return (
                    <span
                      key={di}
                      className="flex h-10 items-center justify-center text-sm text-muted-foreground/30"
                    >
                      {displayDay}
                    </span>
                  );
                }

                const dateKey = toDateKey(new Date(viewYear, viewMonth, day));
                const isSelected = dateKey === pickedKey;
                const dots = dotCount(dateKey, datesWithRecordings);

                return (
                  <button
                    key={di}
                    type="button"
                    onClick={() => handleDayClick(day)}
                    className={cn(
                      "relative flex h-10 flex-col items-center justify-center text-sm transition-colors",
                      isSelected
                        ? "rounded-full bg-primary font-semibold text-primary-foreground"
                        : "text-foreground hover:bg-white/5",
                    )}
                  >
                    {day}
                    {dots > 0 && (
                      <span className="absolute bottom-0.5 flex gap-0.5">
                        {Array.from({ length: dots }).map((_, k) => (
                          <span
                            key={k}
                            className={cn(
                              "size-1 rounded-full",
                              isSelected ? "bg-primary-foreground" : "bg-primary",
                            )}
                          />
                        ))}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            size="lg"
            className="flex-1"
            onClick={() => {
              onDone(null);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="brand"
            size="lg"
            className="flex-1"
            onClick={() => onDone(picked)}
          >
            Done
          </Button>
        </div>
      </div>
    </AppModal>
  );
}
