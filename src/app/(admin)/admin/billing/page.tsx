import { adminGetBillingOverview, adminListPayments } from "@/server/actions/admin/billing-ops";
import { adminListPlans } from "@/server/actions/admin/plans";
import { BillingView } from "./_components/billing-view";

export default async function AdminBillingPage() {
  const [overview, payments, plans] = await Promise.all([
    adminGetBillingOverview(),
    adminListPayments({ take: 50 }),
    adminListPlans({ take: 50 }),
  ]);

  return <BillingView overview={overview} payments={payments} plans={plans} />;
}
