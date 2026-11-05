import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { decryptEvidence, isEncryptedEvidence } from "@/lib/evidence-crypto";
import { localUploadPath } from "@/lib/storage";

function contentType(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase();
  return ext === "png"
    ? "image/png"
    : ext === "jpg" || ext === "jpeg"
      ? "image/jpeg"
      : ext === "webp"
        ? "image/webp"
        : ext === "gif"
          ? "image/gif"
          : "application/octet-stream";
}

const headers = (type: string) => ({
  "Content-Type": type,
  "Content-Disposition": "inline",
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "private, no-store",
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  // Bukti uji hanya boleh dilihat pengguna yang sedang login.
  if (!(await getSessionUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { path } = await params;
  if (
    !path?.length ||
    path.some(
      (part) =>
        part === "." ||
        part === ".." ||
        !/^[A-Za-z0-9._-]+$/.test(part),
    )
  ) {
    return new Response("Not found", { status: 404 });
  }
  const name = path.join("/");

  const full = localUploadPath(name);
  try {
    const st = await stat(full);
    if (st.isFile()) {
      const stream = createReadStream(full);
      return new Response(stream as unknown as BodyInit, {
        headers: headers(contentType(name)),
      });
    }
  } catch {
    // Bukan file lokal; coba Vercel Blob.
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (token) {
    const { get } = await import("@vercel/blob");
    for (const access of ["private", "public"] as const) {
      try {
        const blob = await get(name, { access, token });
        if (blob?.statusCode !== 200) continue;
        const raw = Buffer.from(await new Response(blob.stream).arrayBuffer());
        const encrypted = isEncryptedEvidence(raw);
        const body = encrypted ? decryptEvidence(raw) : raw;
        const original = name.endsWith(".enc") ? name.slice(0, -4) : name;
        return new Response(body as unknown as BodyInit, {
          headers: headers(
            encrypted ? contentType(original) : blob.blob.contentType,
          ),
        });
      } catch {
        // Coba mode akses berikutnya; Blob tidak ada atau bukan milik store ini.
      }
    }
  }

  return new Response("Not found", { status: 404 });
}
