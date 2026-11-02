import { err, needKetua } from "@/lib/api";
import { IMPORT_HEADERS } from "@/lib/import";

export async function GET() {
  const ketua = await needKetua();
  if (!ketua) return err("Forbidden", 403);

  const sample = [
    "2026-11-01",
    "tester1@testlab.test",
    "tester",
    "Lensa-ASN R1",
    "Login Pengguna",
    "Pass",
    "",
    "Chrome 126 / Windows 11",
    "",
    "0",
  ];

  const body =
    "\uFEFF" +
    [IMPORT_HEADERS, sample]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\r\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=UTF-8",
      "Content-Disposition": 'attachment; filename="template-import-sitester.csv"',
    },
  });
}
