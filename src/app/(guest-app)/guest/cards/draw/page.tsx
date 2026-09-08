"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  OracleDeckDrawExperience,
  type DrawCard,
} from "@/components/features/oracle-deck-draw/oracle-deck-draw-experience";

export default function GuestDrawPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deckId = searchParams.get("deck") ?? "";
  const count = Math.min(
    Math.max(parseInt(searchParams.get("count") ?? "1", 10), 1),
    2,
  ) as 1 | 2;

  const onDraw = React.useCallback(async (d: string, c: 1 | 2): Promise<DrawCard[]> => {
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
  }, []);

  const onExit = React.useCallback(() => {
    router.push("/guest/dashboard");
  }, [router]);

  return (
    <OracleDeckDrawExperience
      key={`${deckId}-${count}`}
      deckId={deckId}
      count={count}
      onDraw={onDraw}
      onExit={onExit}
    />
  );
}
