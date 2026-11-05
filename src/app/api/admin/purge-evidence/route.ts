import { del } from "@vercel/blob";
import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";

// SEMENTARA: hapus bukti lama yang tersimpan di store publik. Hapus route ini
// setelah pembersihan selesai.
const PREFIX =
  "https://ovbuhl72uuilmuok.public.blob.vercel-storage.com/evidence/";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user || user.role !== "ketua_tim") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    urls?: unknown;
  } | null;
  const urls = Array.isArray(body?.urls)
    ? body.urls.filter(
        (u): u is string => typeof u === "string" && u.startsWith(PREFIX),
      )
    : [];
  if (!urls.length) {
    return NextResponse.json({ error: "Tidak ada URL valid." }, { status: 400 });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "Token Blob tidak ada." }, { status: 500 });
  }

  const results = [];
  for (const url of urls) {
    try {
      await del(url, { token });
      results.push({ ok: true });
    } catch (e) {
      results.push({ ok: false, error: String(e).slice(0, 200) });
    }
  }
  return NextResponse.json({ results });
}
