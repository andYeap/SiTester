import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
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
    path.some((part) => !/^[A-Za-z0-9._-]+$/.test(part))
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
    try {
      const { get } = await import("@vercel/blob");
      const blob = await get(name, { access: "private", token });
      if (blob?.statusCode === 200) {
        return new Response(blob.stream, {
          headers: headers(blob.blob.contentType),
        });
      }
    } catch {
      // Blob tidak ada atau bukan milik store ini.
    }
  }

  return new Response("Not found", { status: 404 });
}
