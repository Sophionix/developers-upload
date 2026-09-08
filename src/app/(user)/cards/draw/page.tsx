"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { drawRandomFromDeck } from "@/server/actions/content";
import {
  OracleDeckDrawExperience,
  type DrawCard,
} from "@/components/features/oracle-deck-draw/oracle-deck-draw-experience";

export default function UserCardDrawPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deckId = searchParams.get("deck") ?? "";
  const count = Math.min(
    Math.max(parseInt(searchParams.get("count") ?? "1", 10), 1),
    2,
  ) as 1 | 2;

  React.useEffect(() => {
    if (!deckId) router.replace("/dashboard");
  }, [deckId, router]);

  const onDraw = React.useCallback(async (d: string, c: 1 | 2): Promise<DrawCard[]> => {
    const cards: DrawCard[] = [];
    for (let i = 0; i < c; i++) {
      const detail = await drawRandomFromDeck({ deckId: d });
      cards.push({
        id: detail.id,
        title: detail.title,
        message: detail.message,
        prompt: detail.prompt,
        imageUrl: detail.imageUrl,
      });
    }
    return cards;
  }, []);

  // Reading flows straight into the journal: instead of saving the reading on
  // its own, open the note editor with the drawn card so the reader can write
  // about it. The card is saved together with the note when the entry is saved.
  const onSaveCards = React.useCallback(
    async (cards: DrawCard[]) => {
      const first = cards[0];
      if (!first) return;
      router.push(`/journal/create?cardId=${encodeURIComponent(first.id)}`);
    },
    [router],
  );

  const onExit = React.useCallback(() => {
    router.push("/dashboard");
  }, [router]);

  if (!deckId) {
    return null;
  }

  return (
    <OracleDeckDrawExperience
      key={`${deckId}-${count}`}
      deckId={deckId}
      count={count}
      onDraw={onDraw}
      onSaveCards={onSaveCards}
      onExit={onExit}
    />
  );
}
