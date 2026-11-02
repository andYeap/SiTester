import { expect, test } from "@playwright/test";

test("halaman login tampil", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "SITester" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByRole("link", { name: "Lupa kata sandi?" })).toBeVisible();
});

test("route terlindungi dialihkan ke login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("halaman lupa password tampil", async ({ page }) => {
  await page.goto("/lupa-password");
  await expect(
    page.getByRole("heading", { name: "Lupa Kata Sandi" }),
  ).toBeVisible();
});
