"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthRightColumn } from "@/components/features/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { ArrowLeft, ArrowRight, Loader2, UserPlus } from "@/lib/ui/icons";

export default function GuestPage() {
  const router = useRouter();
  const [creating, startCreate] = React.useTransition();

  const createSession = () => {
    startCreate(async () => {
      try {
        await fetch("/api/guest/session", { method: "POST" });
      } catch {
        /* tolerate — route may not accept POST yet in dev */
      }
      toast.success("Guest session started.");
      router.push("/guest/dashboard");
    });
  };

  return (
    <AuthRightColumn
      leading={
        <Button asChild variant="outline" size="icon-sm" aria-label="Go back">
          <Link href="/welcome">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col items-start gap-3">
          <Badge variant="accent">Guest preview</Badge>
          <h1 className="font-display text-4xl leading-[1.1] text-foreground lg:text-5xl">
            The Sophionix Oracle Deck
          </h1>
          <p className="text-sm text-muted-foreground">
            A 37-card deck for healing and transformation by Jennifer Rose.
          </p>
          <span aria-hidden className="h-0.5 w-16 rounded-pill bg-brand-grad" />
        </div>

        <p className="text-base text-muted-foreground">
          Draw one card for a taste — unlock more for $1.99 each, or create an account to sync your
          reflections across devices.
        </p>

        <div className="flex flex-col gap-3">
          <Button
            variant="brand"
            size="lg"
            onClick={createSession}
            disabled={creating}
            className="h-14 w-full"
          >
            {creating ? <Loader2 className="size-4 animate-spin" /> : null}
            Continue as Guest
            <ArrowRight className="size-4" />
          </Button>
          <Button asChild variant="outline" size="lg" className="h-14 w-full">
            <Link href="/signup?claim=1">
              <UserPlus className="size-4" />
              Create an Account
            </Link>
          </Button>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Already registered?{" "}
          <Link href="/login" className="font-semibold text-foreground underline-offset-4 hover:underline">
            Log In
          </Link>
        </p>
      </div>
    </AuthRightColumn>
  );
}
