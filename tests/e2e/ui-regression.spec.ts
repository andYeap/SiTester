import { expect, test } from "@playwright/test";

import {
  cleanupFeature,
  KETUA,
  TESTER,
  loginApi,
  loginUi,
  pickFeature,
} from "./helpers";

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

test("M9 siklus berlingkup menyaring fitur di form pengujian", async ({
  page,
  playwright,
}) => {
  const name = `E2E Scope ${Date.now()}`;
  const cycleName = `E2E Siklus ${Date.now()}`;
  const ketua = await loginApi(playwright.request, KETUA.email, KETUA.password);
  const created = await ketua.post("/api/v1/features", { data: { name } });
  expect(created.ok()).toBeTruthy();
  const listed = await ketua.get("/api/v1/features");
  const feature = (
    (await listed.json()) as { features: { id: string; name: string }[] }
  ).features.find((f) => f.name === name);
  expect(feature).toBeTruthy();

  try {
    const cycle = await ketua.post("/api/v1/test-cycles", {
      data: { name: cycleName, feature_ids: [feature!.id] },
    });
    expect(cycle.ok()).toBeTruthy();

    await loginUi(page, TESTER.email, TESTER.password);
    await page.goto(`/pengujian-baru?cycle=${encodeURIComponent(cycleName)}`);
    await expect(page.getByText("Siklus ini mencakup 1 fitur")).toBeVisible();
    await pickFeature(page, name);
    await expect(page.getByText("Fitur ini siap diuji.")).toBeVisible();
  } finally {
    const cycles = await ketua.get("/api/v1/test-cycles");
    const found = (
      (await cycles.json()) as { cycles: { id: number; name: string }[] }
    ).cycles.find((c) => c.name === cycleName);
    if (found) await ketua.delete(`/api/v1/test-cycles/${found.id}`);
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
