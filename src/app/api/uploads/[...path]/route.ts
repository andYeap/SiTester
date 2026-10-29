import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";

import { localUploadPath } from "@/lib/storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  if (!path || path.length !== 1 || path[0].includes("..")) {
    return new Response("Not found", { status: 404 });
  }

  const full = localUploadPath(path[0]);
  try {
    const st = await stat(full);
    if (!st.isFile()) return new Response("Not found", { status: 404 });
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const stream = createReadStream(full);
  const ext = path[0].split(".").pop()?.toLowerCase();
  const type =
    ext === "png"
      ? "image/png"
      : ext === "jpg" || ext === "jpeg"
        ? "image/jpeg"
        : ext === "webp"
          ? "image/webp"
          : ext === "gif"
            ? "image/gif"
            : "application/octet-stream";

  return new Response(stream as unknown as BodyInit, {
    headers: { "Content-Type": type, "Cache-Control": "public, max-age=86400" },
  });
}
