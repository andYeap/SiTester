import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { Pool } from "pg";

import { E2E_DATABASE_URL } from "./global-setup";

export const E2E_DB = E2E_DATABASE_URL;
export const KETUA = { email: "ketua@testlab.test", password: "password" };
export const TESTER = { email: "tester1@testlab.test", password: "password" };

type RequestFactory = {
  newContext: (options?: { baseURL?: string }) => Promise<APIRequestContext>;
};

export async function loginApi(
  request: RequestFactory,
  email: string,
  password: string,
) {
  const ctx = await request.newContext({ baseURL: "http://127.0.0.1:3100" });
  const res = await ctx.post("/api/auth/login", { data: { email, password } });
  expect(res.ok()).toBeTruthy();
  return ctx;
}

export async function loginUi(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Kata sandi").fill(password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

export async function pickFeature(page: Page, name: string) {
  const combo = page.getByRole("combobox", { name: "Fitur yang Diuji" });
  await combo.click();
  await combo.fill(name);
  await page.getByRole("option", { name }).click();
}

export async function cleanupFeature(name: string) {
  const pool = new Pool({ connectionString: E2E_DB });
  try {
    await pool.query(
      `DELETE FROM defects WHERE session_id IN (SELECT id FROM test_sessions WHERE feature_id IN (SELECT id FROM features WHERE name=$1))`,
      [name],
    );
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
