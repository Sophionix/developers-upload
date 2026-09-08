import { Suspense } from "react";
import ResetPasswordForm from "./reset-form";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
