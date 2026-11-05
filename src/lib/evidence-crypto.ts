import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const MAGIC = Buffer.from("SITESTER-EV1\0", "utf8");
const IV_BYTES = 12;
const TAG_BYTES = 16;

function derive(raw: string): Buffer {
  // Kunci 32 byte diturunkan dari secret lingkungan; tidak disimpan di repo.
  return createHash("sha256")
    .update(`sitester-evidence:${raw}`)
    .digest();
}

function key(): Buffer | null {
  const raw = process.env.EVIDENCE_ENCRYPTION_KEY ?? "";
  if (raw.length < 20) return null;
  return derive(raw);
}

export function evidenceEncryptionConfigured(): boolean {
  return key() !== null;
}

/** Enkripsi isi bukti sebelum diunggah ke penyimpanan Blob. */
export function encryptEvidence(plain: Buffer): Buffer {
  const secret = key();
  if (!secret) {
    throw new Error(
      "Kunci enkripsi bukti belum dikonfigurasi (EVIDENCE_ENCRYPTION_KEY).",
    );
  }
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", secret, iv);
  const data = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), data]);
}

export function isEncryptedEvidence(buf: Buffer): boolean {
  return buf.length > MAGIC.length && buf.subarray(0, MAGIC.length).equals(MAGIC);
}

/** Dekripsi bukti Blob; melempar bila kunci salah atau berkas diubah. */
export function decryptEvidence(buf: Buffer): Buffer {
  const secret = key();
  if (!secret) {
    throw new Error(
      "Kunci enkripsi bukti belum dikonfigurasi (EVIDENCE_ENCRYPTION_KEY).",
    );
  }
  if (!isEncryptedEvidence(buf)) {
    throw new Error("Bukti bukan berkas terenkripsi.");
  }
  const iv = buf.subarray(MAGIC.length, MAGIC.length + IV_BYTES);
  const tag = buf.subarray(MAGIC.length + IV_BYTES, MAGIC.length + IV_BYTES + TAG_BYTES);
  const data = buf.subarray(MAGIC.length + IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv("aes-256-gcm", secret, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}
