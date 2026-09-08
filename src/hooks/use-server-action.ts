"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

interface UseServerActionReturn<TInput, TOutput> {
  execute: (input: TInput) => Promise<void>;
  data: TOutput | null;
  error: string | null;
  isPending: boolean;
  reset: () => void;
}

export function useServerAction<TInput, TOutput>(
  action: (input: TInput) => Promise<TOutput>,
): UseServerActionReturn<TInput, TOutput> {
  const [data, setData] = useState<TOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const actionRef = useRef(action);
  actionRef.current = action; // eslint-disable-line react-hooks/refs

  const execute = useCallback(
    (input: TInput) => {
      return new Promise<void>((resolve) => {
        startTransition(async () => {
          try {
            setError(null);
            const result = await actionRef.current(input);
            setData(result);
          } catch (err: unknown) {
            const code = extractErrorCode(err);

            if (code === "UNAUTHORIZED") {
              toast.error("Session expired, please sign in again");
              window.location.href = "/login";
              resolve();
              return;
            }

            setError(code);
          }
          resolve();
        });
      });
    },
    [startTransition],
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
  }, []);

  return { execute, data, error, isPending, reset };
}

function extractErrorCode(err: unknown): string {
  if (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    typeof (err as { code: unknown }).code === "string"
  ) {
    return (err as { code: string }).code;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "UNKNOWN_ERROR";
}
