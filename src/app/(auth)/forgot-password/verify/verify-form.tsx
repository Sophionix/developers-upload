"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { AuthRightColumn, OtpInput } from "@/components/features/auth";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { getErrorMessage } from "@/lib/error-messages";
import { ArrowLeft, Loader2 } from "@/lib/ui/icons";

export default function VerifyResetForm() {
  const router = useRouter();
  const search = useSearchParams();
  const email = search.get("email") ?? "";
  const intent = search.get("intent") ?? "reset";
  const [code, setCode] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (code.length < 6) {
      toast.error("Enter the 6-digit code.");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, intent }),
      });
      if (!res.ok) {
        const data: { code?: string; message?: string } = await res.json().catch(() => ({}));
        toast.error(getErrorMessage(data.code ?? "UNKNOWN", data.message ?? undefined));
        return;
      }
      toast.success("Email verified!");
      if (intent === "signup") {
        // The verify endpoint only marks the email verified — it does not
        // create a session. Sign the user in now so authenticated pages
        // (e.g. /profile) work; without this every server action there
        // throws UnauthorizedError.
        let password: string | null = null;
        try {
          password = sessionStorage.getItem("signup:pw");
          sessionStorage.removeItem("signup:pw");
        } catch {
          password = null;
        }

        if (password) {
          const result = await signIn("credentials", {
            email,
            password,
            redirect: false,
          });
          if (!result?.error) {
            router.push("/terms");
            return;
          }
        }
        // No stashed password or sign-in failed — fall back to manual login.
        toast.success("Please sign in to continue.");
        router.push(`/login?email=${encodeURIComponent(email)}`);
      } else {
        router.push(`/forgot-password/reset?email=${encodeURIComponent(email)}&token=${code}`);
      }
    });
  };

  return (
    <AuthRightColumn
      leading={
        <Button asChild variant="outline" size="icon-sm" aria-label="Go back">
          <Link href="/forgot-password">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
      }
    >
      <form className="flex flex-col gap-3 xl:gap-6" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-2xl leading-tight text-foreground xl:text-5xl">
            Enter Your Code
          </h1>
          <p className="text-sm text-muted-foreground">
            {email ? `We sent a 6-digit code to ${email}.` : "Enter the 6-digit code from your email."}
          </p>
          <span aria-hidden className="h-0.5 w-16 rounded-pill bg-brand-grad" />
        </div>

        <OtpInput value={code} onChange={setCode} autoFocus />

        <Button
          type="submit"
          variant="brand"
          size="lg"
          disabled={pending || code.length < 6}
          className="h-11 w-full xl:h-14"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          Verify
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Didn&apos;t get it?{" "}
          <button
            type="button"
            onClick={async () => {
              const res = await fetch("/api/auth/resend-verification", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
              });
              if (!res.ok) {
                const data: { code?: string } = await res.json().catch(() => ({}));
                toast.error(getErrorMessage(data.code ?? "UNKNOWN"));
                return;
              }
              toast.success("New code sent to your email.");
            }}
            className="font-semibold text-foreground underline-offset-4 hover:underline"
          >
            Resend
          </button>
          {" · "}
          <Link
            href="/forgot-password"
            className="font-semibold text-foreground underline-offset-4 hover:underline"
          >
            Change email
          </Link>
        </p>
      </form>
    </AuthRightColumn>
  );
}
