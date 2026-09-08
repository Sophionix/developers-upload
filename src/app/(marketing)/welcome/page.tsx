import Link from "next/link";
import { AuthChoiceCard, AuthRightColumn } from "@/components/features/auth";
import { Button } from "@/components/ui/button";
import { ArrowLeft, LogIn, User } from "@/lib/ui/icons";

export default function WelcomePage() {
  return (
    <AuthRightColumn
      leading={
        <Button asChild variant="outline" size="icon-sm" aria-label="Go back">
          <Link href="/">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
      }
    >
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <h1 className="font-display text-4xl leading-[1.1] text-foreground lg:text-5xl">
            Welcome!
          </h1>
          <p className="text-sm text-muted-foreground">Select User</p>
          <span aria-hidden className="h-0.5 w-16 rounded-pill bg-brand-grad" />
        </div>

        <div className="flex flex-col gap-4">
          <AuthChoiceCard
            href="/guest/dashboard"
            icon={User}
            title="Continue as a Guest User"
            description="Explore without saving progress."
          />
          <AuthChoiceCard
            href="/login"
            icon={LogIn}
            title="Continue as a User"
            description="Access your journal and saved reflections."
          />
        </div>
      </div>
    </AuthRightColumn>
  );
}
