import {
  createHash,
  randomBytes,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";

export function sha256Hex(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export function newToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("base64url");
  return { raw, hash: sha256Hex(raw) };
}

export function newOtpCode(): { raw: string; hash: string } {
  const n = randomBytes(4).readUInt32BE(0) % 1_000_000;
  const raw = n.toString().padStart(6, "0");
  return { raw, hash: sha256Hex(raw) };
}

function keyFromB64(keyB64: string): Buffer {
  const buf = Buffer.from(keyB64, "base64");
  if (buf.length !== 32) throw new Error("aes_gcm_key_must_be_32_bytes_base64");
  return buf;
}

export function aesGcmEncrypt(plain: string, keyB64: string): string {
  const key = keyFromB64(keyB64);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${enc.toString("base64")}.${tag.toString("base64")}`;
}

export function aesGcmDecrypt(ciphertext: string, keyB64: string): string {
  const [ivB64, encB64, tagB64] = ciphertext.split(".");
  if (!ivB64 || !encB64 || !tagB64)
    throw new Error("aes_gcm_ciphertext_malformed");
  const key = keyFromB64(keyB64);
  const iv = Buffer.from(ivB64, "base64");
  const enc = Buffer.from(encB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString("utf8");
}
