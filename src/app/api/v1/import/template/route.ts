import ExcelJS from "exceljs";

import { err, needKetua } from "@/lib/api";
import { IMPORT_HEADERS, IMPORT_TEMPLATE_SAMPLE } from "@/lib/import";

export async function GET(request: Request) {
  const ketua = await needKetua();
  if (!ketua) return err("Forbidden", 403);

  const format = new URL(request.url).searchParams.get("format") ?? "csv";

  if (format === "xlsx") {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Import Pengujian");
    sheet.addRow(IMPORT_HEADERS);
    sheet.addRow(IMPORT_TEMPLATE_SAMPLE);
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF09090B" },
    };
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFAFAFA" } };
    sheet.columns.forEach((col, index) => {
      col.width = [14, 28, 24, 8, 12, 18, 20, 14, 26, 30, 30, 36, 34, 8][index] ?? 18;
    });
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    return new Response(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="template-import-sitester.xlsx"',
      },
    });
  }

  const body =
    "\uFEFF" +
    [IMPORT_HEADERS, IMPORT_TEMPLATE_SAMPLE]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\r\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=UTF-8",
      "Content-Disposition": 'attachment; filename="template-import-sitester.csv"',
    },
  });
}
