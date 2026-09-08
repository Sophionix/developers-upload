"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useOptimisticList<T extends { id: string }>(
  initialItems: T[],
) {
  const [items, setItems] = useState<T[]>(initialItems);
  const snapshotRef = useRef<T[]>(initialItems);

  useEffect(() => {
    setItems(initialItems); // eslint-disable-line react-hooks/set-state-in-effect
    snapshotRef.current = initialItems;
  }, [initialItems]);

  const optimisticRemove = useCallback((id: string) => {
    setItems((prev) => {
      snapshotRef.current = prev;
      return prev.filter((item) => item.id !== id);
    });
  }, []);

  const optimisticAdd = useCallback((item: T) => {
    setItems((prev) => {
      snapshotRef.current = prev;
      return [item, ...prev];
    });
  }, []);

  const rollback = useCallback(() => {
    setItems(snapshotRef.current);
  }, []);

  return { items, optimisticRemove, optimisticAdd, rollback };
}
