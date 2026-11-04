import { err, needUser } from "@/lib/api";
import { getSessions, parseSessionFilters } from "@/lib/history";

export const maxDuration = 60;

const HEAD = ["Tanggal", "Tester", "Peran", "Siklus", "Fitur", "Hasil", "Severity", "Lingkungan", "Ulang", "Catatan"];

const cell = (v: unknown, max = 200): string => {
  const s = v === null || v === undefined ? "" : String(v);
  return s.length > max ? `${s.slice(0, max)}…` : s;
};

export async function GET(request: Request) {
  const user = await needUser();
  if (!user) return err("Unauthorized", 401);

  const parsed = parseSessionFilters(new URL(request.url).searchParams);
  if ("error" in parsed) return err(parsed.error, 422);

  const { rows, total } = await getSessions(
    user.id,
    user.role === "ketua_tim",
    parsed.filters,
    { limit: 5000, offset: 0 },
  );

  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text("SITester — Laporan Hasil Pengujian", 14, 14);
  doc.setFontSize(9);
  doc.text(
    `Diekspor: ${new Date().toLocaleString("id-ID")} · ${rows.length} dari ${total} baris (mengikuti filter aktif, maks 5000)`,
    14,
    21,
  );
  autoTable(doc, {
    startY: 26,
    head: [HEAD],
    body: rows.map((s) => [
      cell(s.tested_at),
      cell(s.user_name, 40),
      cell(s.tested_as_role, 20),
      cell(s.test_cycle ?? "-", 30),
      cell(s.feature_name, 40),
      cell(s.result.toUpperCase(), 10),
      cell((s.severity ?? "-").toUpperCase(), 12),
      cell(s.environment ?? "-", 30),
      cell(s.is_retest ? "Ya" : "Tidak", 8),
      cell(s.notes ?? "-", 200),
    ]),
    styles: { fontSize: 7 },
    headStyles: { fillColor: [9, 9, 11], textColor: [250, 250, 250] },
  });

  const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");
  const pdf = Buffer.from(doc.output("arraybuffer"));
  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="laporan-pengujian-${stamp}.pdf"`,
    },
  });
}
