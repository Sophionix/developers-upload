import { adminListCoupons } from "@/server/actions/admin/coupons";
import { CouponsView } from "./_components/coupons-view";

export default async function AdminCouponsPage() {
  const coupons = await adminListCoupons({ take: 50 });

  return <CouponsView coupons={coupons} />;
}
