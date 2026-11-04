import { afterEach, describe, expect, it } from "vitest";

import {
  credentialsConfigured,
  decryptCredentials,
  encryptCredentials,
} from "./ai-credentials";

const env = process.env as unknown as Record<string, string | undefined>;
const saved = {
  NODE_ENV: env.NODE_ENV,
  AI_RUNNER_TOKEN: env.AI_RUNNER_TOKEN,
  AI_CREDENTIALS_KEY: env.AI_CREDENTIALS_KEY,
};

afterEach(() => {
  env.NODE_ENV = saved.NODE_ENV;
  env.AI_RUNNER_TOKEN = saved.AI_RUNNER_TOKEN;
  env.AI_CREDENTIALS_KEY = saved.AI_CREDENTIALS_KEY;
});

describe("kunci kredensial AI", () => {
  it("dev boleh fallback ke token runner", () => {
    env.NODE_ENV = "test";
    env.AI_CREDENTIALS_KEY = "";
    env.AI_RUNNER_TOKEN = "token-dev-cukup-panjang-123";
    expect(credentialsConfigured()).toBe(true);
    const enc = encryptCredentials({ email: "a@t.test", password: "rahasia" });
    expect(enc).toBeTruthy();
    expect(decryptCredentials(enc)).toEqual({
      email: "a@t.test",
      password: "rahasia",
    });
  });

  it("produksi wajib AI_CREDENTIALS_KEY", () => {
    env.NODE_ENV = "production";
    env.AI_CREDENTIALS_KEY = "";
    env.AI_RUNNER_TOKEN = "token-prod-cukup-panjang-123";
    expect(credentialsConfigured()).toBe(false);
    expect(
      encryptCredentials({ email: "a@t.test", password: "rahasia" }),
    ).toBeNull();
  });

  it("rotasi ke kunci khusus membuat ciphertext lama tak terbaca", () => {
    env.NODE_ENV = "test";
    env.AI_CREDENTIALS_KEY = "";
    env.AI_RUNNER_TOKEN = "token-lama-cukup-panjang-123";
    const enc = encryptCredentials({ email: "a@t.test", password: "rahasia" });

    env.NODE_ENV = "production";
    env.AI_CREDENTIALS_KEY = "kunci-baru-cukup-panjang-456";
    expect(credentialsConfigured()).toBe(true);
    expect(decryptCredentials(enc)).toBeNull();
  });
});
