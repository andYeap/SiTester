import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";
import { Pool } from "pg";

import {
  cleanupFeature,
  E2E_DB,
  KETUA,
  TESTER,
  loginApi,
  loginUi,
  pickFeature,
} from "./helpers";

test("D1 defect: fail tercatat otomatis dan bisa difixed ketua", async ({
  page,
  playwright,
}) => {
  const name = `E2E Defect ${Date.now()}`;
  const ketua = await loginApi(playwright.request, KETUA.email, KETUA.password);
  const created = await ketua.post("/api/v1/features", { data: { name } });
  expect(created.ok()).toBeTruthy();

  try {
    await loginUi(page, TESTER.email, TESTER.password);
    await page.goto("/pengujian-baru");
    await pickFeature(page, name);
    await page.locator("#uji-hasil").selectOption("fail");
    await page.locator("#uji-severity").selectOption("high");
    await page
      .locator("#uji-notes")
      .fill("Langkah reproduksi E2E: buka halaman, klik simpan, error muncul konsisten.");
    await page.getByRole("button", { name: "Simpan Hasil Pengujian" }).click();
    await expect(
      page.getByText("Hasil pengujian berhasil disimpan."),
    ).toBeVisible();

    await page.goto("/defect");
    const row = page.locator("tbody tr", { hasText: name });
    await expect(row.getByText("OPEN", { exact: true })).toBeVisible();

    await page.context().clearCookies();
    await loginUi(page, KETUA.email, KETUA.password);
    await page.goto("/defect");
    await page
      .getByRole("combobox", { name: `Ubah status defect Temuan: ${name}` })
      .selectOption("fixed");
    await expect(
      page.getByText(`Defect "Temuan: ${name}" → fixed.`),
    ).toBeVisible();
  } finally {
    await cleanupFeature(name);
  }
});

test("I1 import CSV: pratinjau lalu commit", async ({ page }) => {
  const notes = `E2E import ${Date.now()}`;
  const today = new Date().toISOString().slice(0, 10);
  const csv = [
    "Tanggal,Email Tester,Fitur,Hasil,Peran,Siklus,Test Case,Severity,Lingkungan,Diharapkan,Terjadi,Catatan,Bukti URL,Ulang",
    `${today},${TESTER.email},Login Pengguna,Pass,tester,Lensa-ASN R1,,,,,,${notes},,0`,
  ].join("\r\n");
  mkdirSync(join(process.cwd(), "tests", "e2e", "fixtures"), {
    recursive: true,
  });
  const filePath = join(process.cwd(), "tests", "e2e", "fixtures", "e2e-import.csv");
  writeFileSync(filePath, "\uFEFF" + csv);

  const pool = new Pool({ connectionString: E2E_DB });
  try {
    await loginUi(page, KETUA.email, KETUA.password);
    await page.goto("/impor");
    await page.locator("#import-file").setInputFiles(filePath);
    await page.getByRole("button", { name: "Pratinjau" }).click();
    await page
      .getByRole("button", { name: "Import 1 baris valid" })
      .click();
    await expect(page.getByText("1 baris diimpor")).toBeVisible();

    const rows = await pool.query<{ id: number }>(
      `SELECT id FROM test_sessions WHERE notes=$1`,
      [notes],
    );
    expect(rows.rows).toHaveLength(1);
  } finally {
    await pool
      .query(`DELETE FROM test_sessions WHERE notes=$1`, [notes])
      .catch(() => undefined);
    await pool.end();
  }
});
