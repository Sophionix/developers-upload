import { redirect } from "next/navigation";

/** Guest claim is the same surface as signup, but with `claim=1` — honor the TRD model. */
export default function GuestClaimPage() {
  redirect("/signup?claim=1");
}
