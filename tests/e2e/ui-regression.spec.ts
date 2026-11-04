import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { Pool } from "pg";

import { E2E_DATABASE_URL } from "./global-setup";

const KETUA = { email: "ketua@testlab.test", password: "password" };
const TESTER = { email: "tester1@testlab.test", password: "password" };

async function loginApi(playwrightReq: {
  newContext: (options?: { baseURL?: string }) => Promise<APIRequestContext>;
}, email: string, password: string) {
  const ctx = await playwrightReq.newContext({
    baseURL: "http://127.0.0.1:3100",
  });
  const res = await ctx.post("/api/auth/login", {
    data: { email, password },
  });
  expect(res.ok()).toBeTruthy();
  return ctx;
}

async function loginUi(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Kata sandi").fill(password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

async function pickFeature(page: Page, name: string) {
  const combo = page.getByRole("combobox", { name: "Fitur yang Diuji" });
  await combo.click();
  await combo.fill(name);
  await page.getByRole("option", { name }).click();
}

async function cleanupFeature(name: string) {
  const pool = new Pool({ connectionString: E2E_DATABASE_URL });
  try {
    await pool.query(
      `DELETE FROM retest_requests WHERE feature_id IN (SELECT id FROM features WHERE name=$1)`,
      [name],
    );
    await pool.query(
      `DELETE FROM test_sessions WHERE feature_id IN (SELECT id FROM features WHERE name=$1)`,
      [name],
    );
    await pool.query(`DELETE FROM features WHERE name=$1`, [name]);
  } finally {
    await pool.end();
  }
}

test("M4 draft hilang setelah simpan; M5 alasan retest terkirim dan tersimpan", async ({
  page,
  playwright,
}) => {
  const name = `E2E UI ${Date.now()}`;
  const ketua = await loginApi(playwright.request, KETUA.email, KETUA.password);
  const created = await ketua.post("/api/v1/features", { data: { name } });
  expect(created.ok()).toBeTruthy();

  try {
    await loginUi(page, TESTER.email, TESTER.password);
    await page.goto("/pengujian-baru");
    await pickFeature(page, name);
    await page.locator("#uji-hasil").selectOption("pass");
    await page.getByRole("button", { name: "Simpan Hasil Pengujian" }).click();
    await expect(
      page.getByText("Hasil pengujian berhasil disimpan."),
    ).toBeVisible();

    // M4: setelah simpan berhasil + reload, banner draft tidak boleh muncul.
    await page.reload();
    await expect(page.getByText("Ada draft pengujian")).toHaveCount(0);

    // M5: form retest muncul dengan textarea alasan.
    await page.getByRole("radio", { name: "Ya" }).check();
    await pickFeature(page, name);
    await page.locator("#uji-hasil").selectOption("pass");
    await expect(
      page.getByRole("heading", { name: "Ajukan Permohonan Pengujian Ulang" }),
    ).toBeVisible();
    const reason = `Alasan E2E ${Date.now()}`;
    await page.locator("#retest-reason").fill(reason);
    await page.getByRole("button", { name: "Kirim Permohonan" }).click();
    await expect(
      page.getByText("Permohonan pengujian ulang telah dikirim"),
    ).toBeVisible();

    const list = await ketua.get("/api/v1/retest-requests");
    expect(list.ok()).toBeTruthy();
    const data = (await list.json()) as {
      pending: { feature_name: string; reason: string | null }[];
    };
    expect(
      data.pending.find((r) => r.feature_name === name)?.reason,
    ).toBe(reason);
  } finally {
    await cleanupFeature(name);
  }
});

test("M8 dashboard: badge kedaluwarsa + label sesuai peran", async ({
  page,
}) => {
  await loginUi(page, TESTER.email, TESTER.password);
  await page.goto("/dashboard");
  await expect(page.getByText("Kedaluwarsa").first()).toBeVisible();
  await expect(page.getByText("Fitur Belum Diuji (tim)")).toBeVisible();
  await expect(
    page.getByText("Ringkasan hasil pengujian Anda"),
  ).toBeVisible();

  await page.context().clearCookies();
  await loginUi(page, KETUA.email, KETUA.password);
  await page.goto("/dashboard");
  await expect(
    page.getByText("Ringkasan hasil pengujian tim"),
  ).toBeVisible();
  await expect(
    page.getByText("Fitur Belum Diuji", { exact: true }),
  ).toBeVisible();
});
