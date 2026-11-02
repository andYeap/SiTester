import { test } from "@e2e-dev/web";
import { credentials, expect } from "e2e";

test("halaman login tampil", async ({ app, screen }) => {
  await app.open("/login");
  await expect(screen.getByRole("heading", "SITester")).toBeVisible();
  await expect(screen.getByLabel("Email")).toBeVisible();
  await expect(screen.getByLabel("Kata sandi")).toBeVisible();
});

test("route terlindungi dialihkan ke login", async ({ app, browser }) => {
  await app.open("/dashboard");
  await expect(browser).toHaveURL(/\/login/);
});

test("agent: login dan dashboard tampil", async ({
  app,
  agent,
  browser,
}) => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  const model = process.env.E2E_MODEL;
  const provider = process.env.E2E_PROVIDER ?? "openrouter";
  const providerKey =
    provider === "google"
      ? process.env.GOOGLE_GENERATIVE_AI_API_KEY
      : process.env.OPENROUTER_API_KEY;

  test.skip(
    !email ||
      !password ||
      password.length < 6 ||
      !model ||
      !providerKey,
    "Butuh E2E_EMAIL, E2E_PASSWORD, E2E_MODEL, dan API key provider.",
  );

  const admin = credentials.user("admin");

  await app.open("/login");
  await agent.act("isi email {email} dan password {password}, lalu klik Masuk", {
    params: { email: admin.username, password: admin.password },
  });
  await agent.assert("dashboard pengujian SITester tampil setelah login");

  await expect(browser).toHaveURL(/\/dashboard/);
});
