import { adminListScheduledDailyCards } from "@/server/actions/admin/scheduled-daily";
import { adminListCards } from "@/server/actions/admin/cards";
import { SchedulerView } from "./_components/scheduler-view";

const now = new Date();
const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

export default async function AdminSchedulerPage() {
  const [scheduled, cards] = await Promise.all([
    adminListScheduledDailyCards({ month: currentMonth }),
    adminListCards({ take: 50, isActive: true }),
  ]);
  return <SchedulerView initialSchedule={scheduled} cards={cards.items} initialMonth={currentMonth} />;
}
