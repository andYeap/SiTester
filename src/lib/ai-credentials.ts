import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

type Credentials = { email: string; password: string };

function key(): Buffer | null {
  const raw =
    process.env.AI_CREDENTIALS_KEY || process.env.AI_RUNNER_TOKEN || "";
  if (raw.length < 20) return null;
  // Turunkan 32 byte dari secret yang sudah ada; tidak disimpan terpisah.
  return createHash("sha256")
    .update(`sitester-ai-credentials:${raw}`)
    .digest();
}

export function credentialsConfigured(): boolean {
  return key() !== null;
}

export function encryptCredentials(creds: Credentials): string | null {
  const secret = key();
  if (!secret) return null;

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secret, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(creds), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptCredentials(payload: string | null): Credentials | null {
  if (!payload) return null;
  const secret = key();
  if (!secret) return null;

  try {
    const [version, ivPart, tagPart, dataPart] = payload.split(".");
    if (version !== "v1" || !ivPart || !tagPart || !dataPart) return null;
    const decipher = createDecipheriv(
      "aes-256-gcm",
      secret,
      Buffer.from(ivPart, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataPart, "base64url")),
      decipher.final(),
    ]);
    const parsed = JSON.parse(decrypted.toString("utf8")) as Partial<Credentials>;
    if (
      typeof parsed.email !== "string" ||
      typeof parsed.password !== "string"
    ) {
      return null;
    }
    return { email: parsed.email, password: parsed.password };
  } catch {
    return null;
  }
}
