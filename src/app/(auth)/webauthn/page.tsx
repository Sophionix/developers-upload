"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthRightColumn } from "@/components/features/auth";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { getErrorMessage } from "@/lib/error-messages";
import { ArrowLeft, Fingerprint, Loader2 } from "@/lib/ui/icons";

function base64urlToBuffer(b64url: string): ArrayBuffer {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function bufferToBase64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export default function WebAuthnPage() {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [supported, setSupported] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    setSupported(typeof window !== "undefined" && !!window.PublicKeyCredential); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);

  const handleAuthenticate = () => {
    startTransition(async () => {
      try {
        // Step 1: Get authentication options from server
        const optionsRes = await fetch("/api/auth/webauthn/login/options", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (!optionsRes.ok) {
          const data = await optionsRes.json().catch(() => ({}));
          toast.error(getErrorMessage(data.error ?? data.code ?? "UNKNOWN", data.message ?? undefined));
          return;
        }

        const options = await optionsRes.json();

        // Step 2: Convert options for browser API
        const publicKey: PublicKeyCredentialRequestOptions = {
          challenge: base64urlToBuffer(options.challenge),
          timeout: options.timeout,
          rpId: options.rpId,
          userVerification: options.userVerification,
          ...(options.allowCredentials?.length
            ? {
                allowCredentials: options.allowCredentials.map(
                  (cred: { id: string; type: string; transports?: string[] }) => ({
                    id: base64urlToBuffer(cred.id),
                    type: cred.type as PublicKeyCredentialType,
                    ...(cred.transports ? { transports: cred.transports } : {}),
                  }),
                ),
              }
            : {}),
        };

        const credential = (await navigator.credentials.get({
          publicKey,
        })) as PublicKeyCredential | null;

        if (!credential) {
          toast.error("Authentication was cancelled.");
          return;
        }

        const assertionResponse = credential.response as AuthenticatorAssertionResponse;

        // Step 3: Convert response for server verification
        const verifyBody = {
          response: {
            id: credential.id,
            rawId: bufferToBase64url(credential.rawId),
            type: credential.type,
            response: {
              authenticatorData: bufferToBase64url(assertionResponse.authenticatorData),
              clientDataJSON: bufferToBase64url(assertionResponse.clientDataJSON),
              signature: bufferToBase64url(assertionResponse.signature),
              ...(assertionResponse.userHandle
                ? { userHandle: bufferToBase64url(assertionResponse.userHandle) }
                : {}),
            },
            clientExtensionResults: credential.getClientExtensionResults(),
            authenticatorAttachment: credential.authenticatorAttachment ?? undefined,
          },
        };

        const verifyRes = await fetch("/api/auth/webauthn/login/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(verifyBody),
        });

        if (!verifyRes.ok) {
          const data = await verifyRes.json().catch(() => ({}));
          toast.error(getErrorMessage(data.error ?? data.code ?? "UNKNOWN", data.message ?? undefined));
          return;
        }

        toast.success("Verified with passkey.");
        router.push("/dashboard");
      } catch {
        toast.error("Authentication failed. Please try again.");
      }
    });
  };

  return (
    <AuthRightColumn
      leading={
        <Button asChild variant="outline" size="icon-sm" aria-label="Go back">
          <Link href="/login">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <h1 className="font-display text-2xl leading-tight text-foreground xl:text-5xl">
            Sign In with Your Passkey
          </h1>
          <p className="text-sm text-muted-foreground">
            {supported === false
              ? "Your device doesn't support passkeys — please use another sign-in method."
              : "Use Face ID, Touch ID, or your security key to continue."}
          </p>
          <span aria-hidden className="h-0.5 w-16 rounded-pill bg-brand-grad" />
        </div>

        <div className="flex flex-col items-center gap-6 py-2">
          <div className="grid size-20 place-items-center rounded-full bg-brand-grad text-primary-foreground shadow-glow-brand">
            <Fingerprint className="size-10" />
          </div>
          <Button
            type="button"
            variant="brand"
            size="lg"
            onClick={handleAuthenticate}
            disabled={pending || supported === false}
            className="h-14 w-full"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Fingerprint className="size-4" />}
            {pending ? "Waiting for your device..." : "Authenticate"}
          </Button>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          <Link
            href="/login"
            className="font-semibold text-foreground underline-offset-4 hover:underline"
          >
            Use email &amp; password instead
          </Link>
        </p>
      </div>
    </AuthRightColumn>
  );
}
