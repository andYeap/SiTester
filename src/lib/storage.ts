import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import { encryptEvidence } from "./evidence-crypto";

const LOCAL_DIR = join(process.cwd(), "uploads");

export type SniffedImage = { ext: string; mime: string };

/** Validasi isi file, bukan MIME dari klien. */
export function sniffImage(buf: Buffer): SniffedImage | null {
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return { ext: "png", mime: "image/png" };
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { ext: "jpg", mime: "image/jpeg" };
  }
  if (
    buf.length >= 6 &&
    (buf.subarray(0, 6).toString("ascii") === "GIF87a" ||
      buf.subarray(0, 6).toString("ascii") === "GIF89a")
  ) {
    return { ext: "gif", mime: "image/gif" };
  }
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString("ascii") === "RIFF" &&
    buf.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return { ext: "webp", mime: "image/webp" };
  }
  return null;
}

/** Simpan bukti upload. Return path relatif/URL untuk kolom evidence_path. */
export async function saveEvidence(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const image = sniffImage(buffer);
  if (!image) {
    throw new Error("Bukti harus berupa gambar PNG, JPEG, WebP, atau GIF.");
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (token) {
    const { put } = await import("@vercel/blob");
    const name = `evidence/${randomUUID()}.${image.ext}.enc`;
    // Isi dienkripsi sebelum keluar dari server, jadi store publik pun tidak
    // membocorkan bukti; akses tetap lewat /api/uploads yang wajib login.
    const encrypted = encryptEvidence(buffer);
    const options = { token, contentType: "application/octet-stream" };
    try {
      const blob = await put(name, encrypted, { ...options, access: "private" });
      return blob.pathname;
    } catch {
      const blob = await put(name, encrypted, { ...options, access: "public" });
      return blob.pathname;
    }
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Penyimpanan bukti belum dikonfigurasi (BLOB_READ_WRITE_TOKEN). Hubungi administrator.",
    );
  }

  await mkdir(LOCAL_DIR, { recursive: true });
  const name = `${randomUUID()}.${image.ext}`;
  await writeFile(join(LOCAL_DIR, name), buffer);
  return name;
}

export function isBlobUrl(path: string): boolean {
  return path.startsWith("http://") || path.startsWith("https://");
}

export function localUploadPath(name: string): string {
  return join(LOCAL_DIR, name);
}
