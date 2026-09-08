import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type AuthenticatorTransportFuture,
  type VerifiedRegistrationResponse,
  type VerifiedAuthenticationResponse,
  type WebAuthnCredential,
} from "@simplewebauthn/server";
import { redis } from "@/lib/redis";
import { env } from "@/lib/env";

const CHALLENGE_TTL_SEC = 300;
const challengeKey = (owner: string) => `webauthn:chal:${owner}`;

interface ExistingAuthenticator {
  credentialId: string;
  transports?: string | null;
}

export async function storeChallenge(
  owner: string,
  challenge: string,
): Promise<void> {
  await redis.set(challengeKey(owner), challenge, "EX", CHALLENGE_TTL_SEC);
}

export async function readChallenge(owner: string): Promise<string | null> {
  return redis.get(challengeKey(owner));
}

export async function deleteChallenge(owner: string): Promise<void> {
  await redis.del(challengeKey(owner));
}

const VALID_TRANSPORTS = [
  "usb",
  "nfc",
  "ble",
  "internal",
  "hybrid",
  "cable",
  "smart-card",
] as const;

function parseTransports(
  csv?: string | null,
): AuthenticatorTransportFuture[] | undefined {
  if (!csv) return undefined;
  return csv
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is AuthenticatorTransportFuture =>
      (VALID_TRANSPORTS as readonly string[]).includes(s),
    );
}

export async function generateRegistration(user: {
  id: string;
  name: string;
  email: string;
  existingAuthenticators: ExistingAuthenticator[];
}) {
  // userID: WebAuthn requires Uint8Array; encode user.id
  const userID = new TextEncoder().encode(user.id);
  return generateRegistrationOptions({
    rpName: env.WEBAUTHN_RP_NAME,
    rpID: env.WEBAUTHN_RP_ID,
    userName: user.email,
    userDisplayName: user.name,
    userID,
    attestationType: "none",
    excludeCredentials: user.existingAuthenticators.map((a) => {
      const transports = parseTransports(a.transports);
      return transports ? { id: a.credentialId, transports } : { id: a.credentialId };
    }),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });
}

export async function verifyRegistration(
  expectedChallenge: string,
  body: Parameters<typeof verifyRegistrationResponse>[0]["response"],
): Promise<VerifiedRegistrationResponse> {
  return verifyRegistrationResponse({
    response: body,
    expectedChallenge,
    expectedOrigin: env.WEBAUTHN_ORIGIN,
    expectedRPID: env.WEBAUTHN_RP_ID,
    requireUserVerification: false,
  });
}

export async function generateAuthentication(
  allowCredentials: { credentialId: string; transports?: string | null }[],
) {
  return generateAuthenticationOptions({
    rpID: env.WEBAUTHN_RP_ID,
    userVerification: "preferred",
    allowCredentials: allowCredentials.map((c) => {
      const transports = parseTransports(c.transports);
      return transports ? { id: c.credentialId, transports } : { id: c.credentialId };
    }),
  });
}

export async function verifyAuthentication(
  expectedChallenge: string,
  credential: WebAuthnCredential,
  body: Parameters<typeof verifyAuthenticationResponse>[0]["response"],
): Promise<VerifiedAuthenticationResponse> {
  return verifyAuthenticationResponse({
    response: body,
    expectedChallenge,
    expectedOrigin: env.WEBAUTHN_ORIGIN,
    expectedRPID: env.WEBAUTHN_RP_ID,
    credential,
    requireUserVerification: false,
  });
}
