"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Calendar } from "@/lib/ui/icons";
import { cn } from "@/lib/ui/cn";
import {
  adminListScheduledDailyCards,
  adminScheduleDailyCard,
  adminUnscheduleDailyCard,
} from "@/server/actions/admin/scheduled-daily";

type ScheduledItem = { id: string; date: Date; cardId: string; isGlobal: boolean; createdAt: Date };
type CardOption = { id: string; title: string };

type Props = {
  initialSchedule: { items: ScheduledItem[] };
  cards: CardOption[];
  initialMonth: string;
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function parseMonth(month: string): { year: number; monthNum: number } {
  const [y, m] = month.split("-");
  return { year: Number(y), monthNum: Number(m) };
}

function shiftMonth(month: string, delta: number): string {
  const { year, monthNum } = parseMonth(month);
  const d = new Date(year, monthNum - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function buildCalendarDays(month: string) {
  const { year, monthNum } = parseMonth(month);
  const firstDay = new Date(year, monthNum - 1, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(year, monthNum, 0).getDate();

  const today = new Date();
  const todayKey = formatDateKey(today);

  const cells: Array<{ day: number; dateKey: string; isPast: boolean; isToday: boolean } | null> = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateKey = `${year}-${String(monthNum).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const cellDate = new Date(year, monthNum - 1, d);
    const isPast = cellDate < new Date(today.getFullYear(), today.getMonth(), today.getDate());
    cells.push({ day: d, dateKey, isPast, isToday: dateKey === todayKey });
  }
  return cells;
}

function monthLabel(month: string): string {
  const { year, monthNum } = parseMonth(month);
  const d = new Date(year, monthNum - 1);
  return d.toLocaleString("default", { month: "long", year: "numeric" });
}

export function SchedulerView({ initialSchedule, cards, initialMonth }: Props) {
  const [month, setMonth] = useState(initialMonth);
  const [schedule, setSchedule] = useState(initialSchedule.items);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState("");
  const [loading, setLoading] = useState(false);

  const scheduleMap = new Map(
    schedule.map((s) => {
      // Normalize date to YYYY-MM-DD key
      const d = new Date(s.date);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
      return [key, s] as const;
    }),
  );

  const calendarCells = buildCalendarDays(month);
  const selectedScheduled = selectedDate ? scheduleMap.get(selectedDate) : undefined;

  async function navigateMonth(delta: number) {
    const next = shiftMonth(month, delta);
    setMonth(next);
    const data = await adminListScheduledDailyCards({ month: next });
    setSchedule(data.items);
  }

  function openDay(dateKey: string) {
    setSelectedDate(dateKey);
    setSelectedCardId(scheduleMap.get(dateKey)?.cardId ?? "");
  }

  async function handleSchedule() {
    if (!selectedDate || !selectedCardId) return;
    setLoading(true);
    try {
      const created = await adminScheduleDailyCard({ date: selectedDate, cardId: selectedCardId });
      setSchedule((prev) => {
        const filtered = prev.filter((s) => {
          const d = new Date(s.date);
          const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
          return key !== selectedDate;
        });
        return [...filtered, created];
      });
      setSelectedDate(null);
    } finally { setLoading(false); }
  }

  async function handleUnschedule() {
    if (!selectedDate) return;
    setLoading(true);
    try {
      await adminUnscheduleDailyCard({ date: selectedDate });
      setSchedule((prev) => prev.filter((s) => {
        const d = new Date(s.date);
        const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
        return key !== selectedDate;
      }));
      setSelectedDate(null);
    } finally { setLoading(false); }
  }

  function cardTitle(cardId: string): string {
    return cards.find((c) => c.id === cardId)?.title ?? "Unknown Card";
  }

  return (
    <div>
      <PageHeader title="Daily Card Scheduler" description="Schedule which card appears each day." />

      {/* Month navigation */}
      <div className="mb-4 flex items-center gap-3">
        <button type="button" onClick={() => navigateMonth(-1)} className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
          <ChevronLeft className="size-5" />
        </button>
        <div className="flex items-center gap-2 text-lg font-medium text-foreground">
          <Calendar className="size-5 text-muted-foreground" />
          {monthLabel(month)}
        </div>
        <button type="button" onClick={() => navigateMonth(1)} className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
          <ChevronRight className="size-5" />
        </button>
      </div>

      {/* Calendar header */}
      <div className="grid grid-cols-7 gap-1">
        {DAY_NAMES.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
        ))}

        {/* Calendar cells */}
        {calendarCells.map((cell, i) => {
          if (!cell) return <div key={`empty-${i}`} className="min-h-[80px]" />;
          const scheduled = scheduleMap.get(cell.dateKey);
          const clickable = !cell.isPast;
          return (
            <button
              key={cell.dateKey}
              type="button"
              disabled={!clickable}
              onClick={() => openDay(cell.dateKey)}
              className={cn(
                "rounded-md border border-border p-2 min-h-[80px] text-left transition-colors bg-card",
                clickable && "hover:bg-muted/50 cursor-pointer",
                cell.isPast && "opacity-50 cursor-default",
                cell.isToday && "ring-1 ring-primary",
              )}
            >
              <span className="text-xs font-medium text-foreground">{cell.day}</span>
              {scheduled && (
                <div className="mt-1">
                  <span className="inline-block bg-primary/20 text-primary text-xs rounded px-1.5 py-0.5 truncate max-w-full">
                    {cardTitle(scheduled.cardId)}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Schedule / Unschedule Dialog */}
      <Dialog open={!!selectedDate} onOpenChange={() => setSelectedDate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedScheduled ? "Edit Schedule" : "Schedule Card"}</DialogTitle>
            <DialogDescription>
              {selectedScheduled ? `Currently scheduled: ${cardTitle(selectedScheduled.cardId)}` : `Assign a card for ${selectedDate}.`}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-xs text-muted-foreground">Card</label>
            <Select value={selectedCardId} onValueChange={setSelectedCardId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select a card" />
              </SelectTrigger>
              <SelectContent>
                {cards.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            {selectedScheduled && (
              <button type="button" onClick={handleUnschedule} disabled={loading} className="mr-auto rounded-md bg-destructive px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                {loading ? "Removing..." : "Unschedule"}
              </button>
            )}
            <button type="button" onClick={() => setSelectedDate(null)} className="rounded-md border border-border px-4 py-2 text-sm text-foreground">Cancel</button>
            <button type="button" onClick={handleSchedule} disabled={loading || !selectedCardId} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
              {loading ? "Saving..." : "Schedule"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
