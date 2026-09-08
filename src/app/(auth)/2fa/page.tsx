"use client";

import * as React from "react";
import Link from "next/link";
import { AuthRightColumn, OtpInput } from "@/components/features/auth";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { getErrorMessage } from "@/lib/error-messages";
import { ArrowLeft, Loader2 } from "@/lib/ui/icons";

const OTP_DURATION = 30;

function CountdownRing({ seconds, total }: { seconds: number; total: number }) {
  const radius = 40;
  const stroke = 4;
  const circumference = 2 * Math.PI * radius;
  const progress = seconds / total;
  const offset = circumference * (1 - progress);

  return (
    <div className="relative flex items-center justify-center">
      <svg width="100" height="100" className="-rotate-90">
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={stroke}
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-1000 ease-linear"
        />
      </svg>
      <span className="absolute font-mono text-sm text-foreground">
        {`${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`}
      </span>
    </div>
  );
}

export default function TwoFactorPage() {
  const [code, setCode] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [countdown, setCountdown] = React.useState(OTP_DURATION);
  const [canResend, setCanResend] = React.useState(false);
  const [resending, setResending] = React.useState(false);
  const submittedRef = React.useRef(false);

  React.useEffect(() => {
    fetch("/api/auth/admin/2fa/email-otp", { method: "POST" }).catch(() => {});
  }, []);

  React.useEffect(() => {
    if (countdown <= 0) {
      setCanResend(true); // eslint-disable-line react-hooks/set-state-in-effect
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleResend = async () => {
    if (resending) return;
    setResending(true);
    try {
      const res = await fetch("/api/auth/admin/2fa/email-otp", {
        method: "POST",
      });
      if (!res.ok) {
        const data: { code?: string; message?: string } = await res.json().catch(() => ({}));
        toast.error(getErrorMessage(data.code ?? "UNKNOWN", data.message ?? undefined));
        return;
      }
      setCountdown(OTP_DURATION);
      setCanResend(false);
      setCode("");
      submittedRef.current = false;
      toast.success("New OTP sent to your email.");
    } finally {
      setResending(false);
    }
  };

  React.useEffect(() => {
    if (code.length === 6 && !submittedRef.current) {
      submittedRef.current = true;
      startTransition(async () => {
        const res = await fetch("/api/auth/admin/2fa/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, intent: "email-otp" }),
        });
        if (!res.ok) {
          const data: { code?: string } = await res.json().catch(() => ({}));
          toast.error(getErrorMessage(data.code ?? "UNKNOWN"));
          setCode("");
          submittedRef.current = false;
          return;
        }
        toast.success("Verified.");
        window.location.href = "/admin";
      });
    }
  }, [code]);

  return (
    <AuthRightColumn
      leading={
        <Button asChild variant="outline" size="icon-sm" aria-label="Go back">
          <Link href="/login">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
      }
      footer={
        <p className="text-center text-sm text-muted-foreground">
          Didn&apos;t Receive OTP?{" "}
          {canResend ? (
            <button
              type="button"
              onClick={handleResend}
              className="font-semibold text-foreground underline underline-offset-4 hover:text-primary"
            >
              Resend
            </button>
          ) : (
            <span className="font-semibold text-foreground underline underline-offset-4">
              Resend
            </span>
          )}
        </p>
      }
    >
      <div className="flex flex-col items-center gap-8">
        <div className="flex w-full flex-col gap-3">
          <h1 className="font-display text-2xl leading-tight text-foreground xl:text-5xl">
            One Time Password
          </h1>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            We have sent you an email containing a 6-digit verification code.
            Please enter the code to verify your identity.
          </p>
        </div>

        <OtpInput value={code} onChange={setCode} autoFocus disabled={pending} />

        <CountdownRing seconds={countdown} total={OTP_DURATION} />

        {pending && <Loader2 className="size-5 animate-spin text-primary" />}
      </div>
    </AuthRightColumn>
  );
}
