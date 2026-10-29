import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const LOCAL_DIR = join(process.cwd(), "uploads");

/** Simpan bukti upload. Return path relatif untuk kolom evidence_path. */
export async function saveEvidence(file: File): Promise<string> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (token) {
    const { put } = await import("@vercel/blob");
    const ext = (file.name.split(".").pop() ?? "bin").toLowerCase();
    const blob = await put(`evidence/${randomUUID()}.${ext}`, file, {
      access: "public",
      token,
    });
    return blob.url;
  }

  await mkdir(LOCAL_DIR, { recursive: true });
  const ext = (file.name.split(".").pop() ?? "bin").toLowerCase();
  const name = `${randomUUID()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(join(LOCAL_DIR, name), buf);
  return name;
}

export function isBlobUrl(path: string): boolean {
  return path.startsWith("http://") || path.startsWith("https://");
}

export function localUploadPath(name: string): string {
  return join(LOCAL_DIR, name);
}
