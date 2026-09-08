"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppModal } from "@/components/ui/app-modal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import {
  Lock,
  Sparkles,
  UserPlus,
  Loader2,
  Check,
  ArrowRight,
  CreditCard,
  Wallet,
  Plus,
} from "@/lib/ui/icons";
import { cn } from "@/lib/ui/cn";

interface GuestDeck {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  _count: { cards: number };
}

type ViewState =
  | "loading"
  | "deck"
  | "paywall"
  | "payment"
  | "processing"
  | "success"
  | "select";

/* ─── Deck Display ─── */
function DeckHero({
  deck,
  onUnlock,
}: {
  deck: GuestDeck;
  onUnlock: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-8 py-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          Card Library
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Explore the Oracle Deck. Unlock to draw cards and receive guidance.
        </p>
      </div>

      <button
        type="button"
        onClick={onUnlock}
        className="group relative flex flex-col items-center overflow-hidden rounded-2xl border border-white/10 bg-card p-8 transition-transform hover:scale-[1.02]"
      >
        {/* Deck cover */}
        <div className="relative aspect-[3/4] w-48 overflow-hidden rounded-xl border border-white/20 shadow-lg">
          {deck.coverUrl ? (
            <Image
              src={deck.coverUrl}
              alt={deck.title}
              fill
              className="object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <div className="flex size-full items-center justify-center bg-brand-grad">
              <Sparkles className="size-12 text-white/60" />
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <Lock className="size-12 text-white/80" />
          </div>
        </div>

        <div className="mt-5 flex flex-col items-center gap-1 text-center">
          <h2 className="font-display text-xl font-semibold text-foreground">
            {deck.title}
          </h2>
          {deck.description && (
            <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
              {deck.description}
            </p>
          )}
          <span className="mt-2 rounded-pill bg-accent/20 px-3 py-1 text-xs font-bold text-accent">
            {deck._count.cards} cards
          </span>
        </div>

        <div className="mt-5 flex items-center gap-2 rounded-pill bg-brand-grad px-6 py-3 text-sm font-semibold text-white shadow-glow-brand">
          <Lock className="size-4" />
          Unlock Deck — $1.99
        </div>
      </button>

      <div className="flex flex-col items-center gap-3 rounded-xl border border-white/10 bg-card p-6">
        <Sparkles className="size-6 text-accent" />
        <p className="text-center text-sm text-muted-foreground">
          Create a free account to unlock free cards, save reflections,
          and start guided journeys.
        </p>
        <Button asChild variant="brand" size="lg">
          <Link href="/signup?claim=1">
            <UserPlus className="size-4" />
            Create Free Account
          </Link>
        </Button>
      </div>
    </div>
  );
}

/* ─── Paywall Modal ─── */
function PaywallModal({
  deck,
  onClose,
  onPay,
}: {
  deck: GuestDeck;
  onClose: () => void;
  onPay: () => void;
}) {
  return (
    <AppModal title="Unlock Deck" onClose={onClose}>
      <div className="flex flex-col items-center gap-5">
        <div className="relative aspect-[3/4] w-32 overflow-hidden rounded-lg border border-white/20">
          {deck.coverUrl ? (
            <Image
              src={deck.coverUrl}
              alt={deck.title}
              fill
              className="object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center bg-brand-grad">
              <Sparkles className="size-8 text-white/60" />
            </div>
          )}
        </div>

        <div className="text-center">
          <h3 className="font-display text-lg font-semibold text-foreground">
            {deck.title}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {deck._count.cards} cards · One-time access
          </p>
        </div>

        <div className="flex w-full flex-col gap-2">
          <Button
            variant="brand"
            size="lg"
            className="w-full"
            onClick={onPay}
          >
            <CreditCard className="size-4" />
            Pay Per Use — $1.99
          </Button>
          <Button asChild variant="outline" size="md" className="w-full">
            <Link href="/subscription">
              <Sparkles className="size-4" />
              Subscribe for Unlimited
            </Link>
          </Button>
          <Button asChild variant="ghost" size="md" className="w-full">
            <Link href="/signup?claim=1">
              <UserPlus className="size-4" />
              Create Free Account
            </Link>
          </Button>
        </div>
      </div>
    </AppModal>
  );
}

/* ─── Payment Method Modal ─── */
function PaymentModal({
  onClose,
  onConfirm,
}: {
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [selected, setSelected] = React.useState("card");

  return (
    <AppModal title="Payment Method" onClose={onClose}>
      <div className="flex flex-col gap-3">
        {[
          { id: "card", label: "Credit / Debit Card", icon: CreditCard },
          { id: "wallet", label: "Digital Wallet", icon: Wallet },
        ].map((method) => (
          <label
            key={method.id}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors",
              selected === method.id
                ? "border-primary bg-primary/10"
                : "border-border bg-muted/40 hover:border-primary/50",
            )}
          >
            <method.icon className="size-5 shrink-0 text-foreground" />
            <span className="flex-1 text-sm text-foreground">{method.label}</span>
            <input
              type="radio"
              name="payment"
              value={method.id}
              checked={selected === method.id}
              onChange={() => setSelected(method.id)}
              className="size-4 accent-primary"
            />
          </label>
        ))}

        <button
          type="button"
          className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-3 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
        >
          <Plus className="size-4" />
          ADD NEW CARD
        </button>

        <Button
          variant="brand"
          size="lg"
          className="mt-1 w-full"
          onClick={onConfirm}
        >
          <CreditCard className="size-4" />
          Pay $1.99
        </Button>
      </div>
    </AppModal>
  );
}

/* ─── Success Modal ─── */
function SuccessModal({ onContinue }: { onContinue: () => void }) {
  return (
    <AppModal title="Payment Successful" showClose={false} onClose={onContinue} zIndex={70}>
      <div className="flex flex-col items-center gap-5 pt-4">
        <div className="flex size-20 items-center justify-center rounded-full bg-success shadow-[0_0_24px_rgba(34,197,94,0.5)]">
          <Check className="size-10 text-white" strokeWidth={3} />
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Your deck has been unlocked.
          <br />
          You can now draw cards.
        </p>

        <Button variant="brand" size="lg" className="w-full" onClick={onContinue}>
          Continue
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </AppModal>
  );
}

/* ─── Card Count Selection ─── */
function CardSelection({
  onSelect,
}: {
  onSelect: (count: 1 | 2) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-8 py-12">
      <div className="text-center">
        <h2 className="font-display text-2xl font-bold text-foreground">
          How many cards?
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Choose how many cards you want to draw from the deck.
        </p>
      </div>

      <div className="flex gap-4">
        <button
          type="button"
          onClick={() => onSelect(1)}
          className="flex h-32 w-32 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-white/10 bg-card transition-all hover:border-primary/50 hover:shadow-glow-brand"
        >
          <span className="font-display text-4xl font-bold text-foreground">1</span>
          <span className="text-xs text-muted-foreground">Card</span>
        </button>

        <button
          type="button"
          onClick={() => onSelect(2)}
          className="flex h-32 w-32 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-white/10 bg-card transition-all hover:border-primary/50 hover:shadow-glow-brand"
        >
          <span className="font-display text-4xl font-bold text-foreground">2</span>
          <span className="text-xs text-muted-foreground">Cards</span>
        </button>
      </div>
    </div>
  );
}

/* ─── Main Page ─── */
export default function GuestDeckPage() {
  const router = useRouter();
  const [deck, setDeck] = React.useState<GuestDeck | null>(null);
  const [view, setView] = React.useState<ViewState>("loading");

  React.useEffect(() => {
    fetch("/api/guest/deck")
      .then((r) => r.json())
      .then((data: { deck: GuestDeck | null }) => {
        setDeck(data.deck);
        setView("deck");
      })
      .catch(() => setView("deck"));
  }, []);

  const handleUnlock = React.useCallback(() => {
    setView("paywall");
  }, []);

  const handlePay = React.useCallback(() => {
    setView("payment");
  }, []);

  const handleConfirmPayment = React.useCallback(async () => {
    if (!deck) return;
    setView("processing");

    try {
      // Ask the server for (or reuse) a real Stripe unlock for this guest. The
      // endpoint returns alreadyUnlocked when a paid unlock exists in the last
      // 24h; otherwise it creates a real Stripe PaymentIntent. We only grant
      // access on a genuine paid unlock — no fake "instant success".
      const intentRes = await fetch("/api/guest/deck/pay-intent", {
        method: "POST",
      });
      const intentData = (await intentRes.json()) as {
        ok?: boolean;
        alreadyUnlocked?: boolean;
        clientSecret?: string;
        paymentId?: string;
        error?: string;
      };

      if (intentData.alreadyUnlocked) {
        setView("success");
        return;
      }

      if (!intentData.ok || !intentData.clientSecret) {
        toast.error(intentData.error || "Payment failed. Please try again.");
        setView("payment");
        return;
      }

      // A real payment requires collecting card details via Stripe. That
      // embedded card step isn't wired on this page yet, so we don't fake a
      // success. Point the guest at the account/subscription path instead.
      toast.error(
        "Card payment isn't available here yet. Create an account or subscribe to continue.",
      );
      setView("paywall");
    } catch {
      toast.error("Something went wrong. Please try again.");
      setView("payment");
    }
  }, [deck]);

  const handleSelectCount = React.useCallback(
    (count: 1 | 2) => {
      if (!deck) return;
      router.push(`/guest/cards/draw?deck=${deck.id}&count=${count}`);
    },
    [deck, router],
  );

  if (view === "loading" || !deck) {
    return (
      <div className="flex flex-col items-center gap-8 py-8">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="aspect-[3/4] w-48 rounded-xl" />
        <Skeleton className="h-12 w-64" />
      </div>
    );
  }

  return (
    <div className="relative min-h-full">
      {view === "deck" && <DeckHero deck={deck} onUnlock={handleUnlock} />}

      {view === "paywall" && (
        <PaywallModal
          deck={deck}
          onClose={() => setView("deck")}
          onPay={handlePay}
        />
      )}

      {view === "payment" && (
        <PaymentModal
          onClose={() => setView("paywall")}
          onConfirm={handleConfirmPayment}
        />
      )}

      {view === "processing" && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 rounded-2xl bg-card p-8">
            <Loader2 className="size-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Processing payment...</p>
          </div>
        </div>
      )}

      {view === "success" && (
        <SuccessModal onContinue={() => setView("select")} />
      )}

      {view === "select" && <CardSelection onSelect={handleSelectCount} />}
    </div>
  );
}
