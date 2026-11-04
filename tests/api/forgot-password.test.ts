import { beforeEach, describe, expect, it } from "vitest";

import { POST as forgotPassword } from "@/app/api/auth/forgot-password/route";
import { query } from "@/lib/db";

import { createUser, resetDb } from "./helpers";

const request = (email: string) =>
  new Request("http://test/api/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

describe("rate limit forgot-password", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("maksimal 3 token per email dalam 15 menit", async () => {
    const user = await createUser(undefined, "tester");

    for (let i = 0; i < 5; i++) {
      const res = await forgotPassword(request(user.email));
      expect(res.status).toBe(200);
    }

    const rows = await query<{ n: string }>(
      `SELECT count(*)::text AS n FROM password_reset_tokens WHERE user_id=$1`,
      [user.id],
    );
    expect(rows[0].n).toBe("3");
  });
});
