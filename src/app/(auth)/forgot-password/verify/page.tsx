import { Suspense } from "react";
import VerifyResetForm from "./verify-form";

export default function VerifyResetPage() {
  return (
    <Suspense fallback={null}>
      <VerifyResetForm />
    </Suspense>
  );
}
