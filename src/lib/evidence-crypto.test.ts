import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  decryptEvidence,
  encryptEvidence,
  evidenceEncryptionConfigured,
  isEncryptedEvidence,
} from "@/lib/evidence-crypto";

const key = (byte: number) => Buffer.alloc(32, byte).toString("base64");
const plain = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

describe("enkripsi bukti", () => {
  beforeEach(() => {
    process.env.EVIDENCE_ENCRYPTION_KEY = key(7);
  });

  afterEach(() => {
    delete process.env.EVIDENCE_ENCRYPTION_KEY;
  });

  it("bolak-balik mengembalikan isi asli", () => {
    const encrypted = encryptEvidence(plain);
    expect(isEncryptedEvidence(encrypted)).toBe(true);
    expect(encrypted.equals(plain)).toBe(false);
    expect(decryptEvidence(encrypted).equals(plain)).toBe(true);
  });

  it("menolak berkas yang diubah", () => {
    const encrypted = encryptEvidence(plain);
    encrypted[encrypted.length - 1] ^= 0xff;
    expect(() => decryptEvidence(encrypted)).toThrow();
  });

  it("menolak berkas tanpa penanda enkripsi", () => {
    expect(isEncryptedEvidence(plain)).toBe(false);
    expect(() => decryptEvidence(plain)).toThrow();
  });

  it("gagal jelas saat kunci belum diatur", () => {
    delete process.env.EVIDENCE_ENCRYPTION_KEY;
    expect(evidenceEncryptionConfigured()).toBe(false);
    expect(() => encryptEvidence(plain)).toThrow(/EVIDENCE_ENCRYPTION_KEY/);
  });
});
