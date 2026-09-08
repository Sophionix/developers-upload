import type { NotifyChannel } from "@/generated/prisma/enums";

export interface ReminderPrefs {
  remindersEnabled: boolean;
  channel: NotifyChannel;
  scheduleCron: string | null;
  dailyCardAtHour: number | null;
  timezone: string | null;
}

export interface ReminderScheduleInput {
  prefs: ReminderPrefs;
  now?: Date;
  lastJournaledAt?: Date | null;
  suppressIfJournaledWithinHours?: number;
}

export interface ReminderSchedule {
  shouldRunAt: Date;
  channel: NotifyChannel;
}

function nextDailyRunAt(now: Date, hour: number): Date {
  const next = new Date(now);
  next.setUTCMinutes(0, 0, 0);
  next.setUTCHours(hour);
  if (next.getTime() <= now.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next;
}

export function getReminderSchedule(
  input: ReminderScheduleInput,
): ReminderSchedule | null {
  const { prefs } = input;
  const now = input.now ?? new Date();

  if (!prefs.remindersEnabled) return null;
  if (prefs.channel === "NONE") return null;
  if (prefs.dailyCardAtHour === null || prefs.dailyCardAtHour === undefined) {
    return null;
  }

  const suppressHours = input.suppressIfJournaledWithinHours;
  if (
    suppressHours !== undefined &&
    input.lastJournaledAt &&
    now.getTime() - input.lastJournaledAt.getTime() <
      suppressHours * 3_600_000
  ) {
    return null;
  }

  const shouldRunAt = nextDailyRunAt(now, prefs.dailyCardAtHour);
  return { shouldRunAt, channel: prefs.channel };
}
