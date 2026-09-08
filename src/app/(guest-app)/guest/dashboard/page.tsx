"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { AppModal } from "@/components/ui/app-modal";
import { toast } from "@/components/ui/toast";
import { Loader2 } from "@/lib/ui/icons";
import { CardCountModal, PayPerUseCard } from "@/components/features/billing";
import {
  OracleDeckDrawExperience,
  type DrawCard,
} from "@/components/features/oracle-deck-draw/oracle-deck-draw-experience";
import {
  OracleDeckTileFace,
  splitDeckTitleLines,
} from "@/components/features/deck/oracle-deck-tile-face";

interface GuestDeck {
  id: string;
  title: string;
  coverUrl: string | null;
}

/**
 * Guest dashboard flow: tap the deck → Subscriptions (Pay Per Use) → Stripe
 * Checkout (hosted) → back to the dashboard → pick card count → the full
 * shuffle / reveal experience (identical to the logged-in draw). Guests get
 * everything except the Save option.
 */
type Flow = null | "subscription" | "redirecting" | "confirming" | "count" | "draw";

export default function GuestDashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paidParam = searchParams.get("paid");

  const [deck, setDeck] = React.useState<GuestDeck | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [flow, setFlow] = React.useState<Flow>(null);
  const [drawCount, setDrawCount] = React.useState<1 | 2>(1);

  React.useEffect(() => {
    fetch("/api/guest/deck")
      .then((r) => r.json())
      .then((data: { deck: GuestDeck | null }) => {
        setDeck(data.deck);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Returning from Stripe Checkout: confirm the payment, then open the picker.
  const confirmStarted = React.useRef(false);
  React.useEffect(() => {
    if (!paidParam || confirmStarted.current) return;
    confirmStarted.current = true;

    if (paidParam === "cancel") {
      router.replace("/guest/dashboard");
      return;
    }

    setFlow("confirming"); // eslint-disable-line react-hooks/set-state-in-effect
    fetch("/api/guest/deck/checkout/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: paidParam }),
    })
      .then((r) => r.json())
      .then((data: { ok?: boolean; unlocked?: boolean; error?: string }) => {
        router.replace("/guest/dashboard");
        if (data?.ok && data.unlocked) {
          setFlow("count");
        } else {
          toast.error("We couldn't confirm your payment. Please try again.");
          setFlow(null);
        }
      })
      .catch(() => {
        router.replace("/guest/dashboard");
        toast.error("We couldn't confirm your payment. Please try again.");
        setFlow(null);
      });
  }, [paidParam, router]);

  const handleUnlock = React.useCallback(async () => {
    setFlow("redirecting");
    try {
      const r = await fetch("/api/guest/deck/checkout", { method: "POST" });
      const data = (await r.json()) as {
        ok?: boolean;
        url?: string;
        error?: string;
      };

      if (data.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      toast.error(
        data.error === "STRIPE_NOT_CONFIGURED"
          ? "Payments aren't available right now. Please try later."
          : "Couldn't start checkout. Please try again.",
      );
      setFlow("subscription");
    } catch {
      toast.error("Couldn't start checkout. Please try again.");
      setFlow("subscription");
    }
  }, []);

  const handleSelectCount = React.useCallback((count: 1 | 2) => {
    setDrawCount(count);
    setFlow("draw");
  }, []);

  const onDraw = React.useCallback(
    async (d: string, c: 1 | 2): Promise<DrawCard[]> => {
      const r = await fetch("/api/guest/draw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deckId: d, count: c }),
      });
      const data = (await r.json()) as { cards?: DrawCard[]; error?: string };
      if (!data?.error && data.cards && data.cards.length >= c) {
        return data.cards.slice(0, c);
      }
      return [];
    },
    [],
  );

  const coverSrc = deck?.coverUrl ?? "/card-bg.png";
  const titleSplit = deck
    ? splitDeckTitleLines(deck.title)
    : { first: "The Sophionix", second: "Oracle Deck" as string | null };

  // Full-screen draw experience (shuffle → pick → reveal), no Save option.
  if (flow === "draw" && deck) {
    return (
      <OracleDeckDrawExperience
        key={`${deck.id}-${drawCount}`}
        deckId={deck.id}
        count={drawCount}
        onDraw={onDraw}
        onExit={() => setFlow(null)}
      />
    );
  }

  return (
    <div className="relative min-h-full">
      <h1 className="mb-6 font-display text-[clamp(1.75rem,4vw,2.1875rem)] leading-tight text-white md:mb-8">
        Card Deck
      </h1>

      {loading ? (
        <div className="flex w-full max-w-[400px] flex-col items-start gap-6 rounded-[21px] border border-white/20 bg-[rgba(26,1,1,0.4)] p-8">
          <Skeleton className="aspect-[197/295] w-48 rounded-[16px]" />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setFlow("subscription")}
          aria-label="View subscription options for this deck"
          className="block w-full max-w-[400px] rounded-[21px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <div className="flex flex-col items-center rounded-[21px] border border-white/[0.28] bg-[rgba(26,1,1,0.58)] px-6 py-8 shadow-[0px_4px_34px_0px_rgba(0,0,0,0.15)] md:px-8 md:py-10">
            <div className="relative aspect-[197/295] w-[min(100%,12.5rem)] shrink-0">
              <OracleDeckTileFace
                coverSrc={coverSrc}
                titleLine1={titleSplit.first}
                titleLine2={titleSplit.second}
                footer="Author: Jennifer Rose"
                footerNote={"A 37 Card deck for\nHealing & Transformation"}
                density="hero"
              />
            </div>
          </div>
        </button>
      )}

      {flow === "subscription" ? (
        <AppModal
          title="Subscriptions"
          onClose={() => setFlow(null)}
          className="w-[720px]"
        >
          <div className="pt-2">
            <PayPerUseCard className="max-w-full" onClick={handleUnlock} />
          </div>
        </AppModal>
      ) : null}

      {flow === "redirecting" || flow === "confirming" ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 rounded-2xl bg-card p-8">
            <Loader2 className="size-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              {flow === "confirming"
                ? "Confirming your payment..."
                : "Redirecting to secure checkout..."}
            </p>
          </div>
        </div>
      ) : null}

      {flow === "count" && deck ? (
        <CardCountModal onClose={() => setFlow(null)} onSelect={handleSelectCount} />
      ) : null}
    </div>
  );
}
