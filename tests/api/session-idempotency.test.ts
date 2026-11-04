import { beforeEach, describe, expect, it } from "vitest";

import { POST as submitSession } from "@/app/api/v1/test-sessions/route";

import { createUser, loginAs, resetDb, uid } from "./helpers";
import { query } from "@/lib/db";

function fd(obj: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(obj)) f.set(k, v);
  return f;
}

describe("idempotency test-sessions", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it(" double-submit dengan Idempotency-Key sama hanya membuat 1 sesi", async () => {
    const tester = await createUser(undefined, "tester");
    await loginAs(tester.email);
    const f = await query<{ id: number }>(
      `INSERT INTO features (name, is_active, verified) VALUES ($1,true,true) RETURNING id`,
      [`Idem ${uid()}`],
    );
    const key = `idem-${uid()}`;
    const body = () =>
      ({
        feature_id: String(f[0].id),
        tested_at: "2026-10-29",
        is_retest: "0",
        tested_as_role: "tester",
        result: "pass",
      }) as Record<string, string>;

    const mk = () =>
      new Request("http://test/api/v1/test-sessions", {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: fd(body()),
      });

    const r1 = await submitSession(mk());
    expect(r1.status).toBe(201);
    const r2 = await submitSession(mk());
    expect([200, 201].includes(r2.status)).toBe(true);

    const n = await query<{ n: string }>(
      `SELECT count(*)::text AS n FROM test_sessions WHERE feature_id=$1`,
      [f[0].id],
    );
    expect(n[0].n).toBe("1");

    const b1 = (await r1.json()) as { sessionId: number };
    const b2 = (await r2.json()) as { sessionId: number };
    expect(b2.sessionId).toBe(b1.sessionId);
  });

  it("kunci sama dari user berbeda tidak saling menimpa", async () => {
    const testerA = await createUser(undefined, "tester");
    const testerB = await createUser(undefined, "tester");
    const fA = await query<{ id: number }>(
      `INSERT INTO features (name, is_active, verified) VALUES ($1,true,true) RETURNING id`,
      [`Idem A ${uid()}`],
    );
    const fB = await query<{ id: number }>(
      `INSERT INTO features (name, is_active, verified) VALUES ($1,true,true) RETURNING id`,
      [`Idem B ${uid()}`],
    );
    const key = `idem-shared-${uid()}`;

    const mk = (featureId: number) =>
      new Request("http://test/api/v1/test-sessions", {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: fd({
          feature_id: String(featureId),
          tested_at: "2026-10-29",
          is_retest: "0",
          tested_as_role: "tester",
          result: "pass",
        }),
      });

    await loginAs(testerA.email);
    expect((await submitSession(mk(fA[0].id))).status).toBe(201);
    await loginAs(testerB.email);
    expect((await submitSession(mk(fB[0].id))).status).toBe(201);

    const n = await query<{ n: string }>(
      `SELECT count(*)::text AS n FROM test_sessions WHERE idempotency_key=$1`,
      [key],
    );
    expect(n[0].n).toBe("2");
  });

  it("double-submit bersamaan dengan kunci sama hanya membuat satu sesi", async () => {
    const tester = await createUser(undefined, "tester");
    await loginAs(tester.email);
    const f = await query<{ id: number }>(
      `INSERT INTO features (name, is_active, verified) VALUES ($1,true,true) RETURNING id`,
      [`Idem Race ${uid()}`],
    );
    const key = `idem-race-${uid()}`;
    const mk = () =>
      new Request("http://test/api/v1/test-sessions", {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: fd({
          feature_id: String(f[0].id),
          tested_at: "2026-10-29",
          is_retest: "0",
          tested_as_role: "tester",
          result: "pass",
        }),
      });

    const [r1, r2] = await Promise.all([submitSession(mk()), submitSession(mk())]);
    expect([r1.status, r2.status].sort()).toEqual([200, 201]);
    const b1 = (await r1.json()) as { sessionId: number };
    const b2 = (await r2.json()) as { sessionId: number };
    expect(b2.sessionId).toBe(b1.sessionId);

    const n = await query<{ n: string }>(
      `SELECT count(*)::text AS n FROM test_sessions WHERE feature_id=$1`,
      [f[0].id],
    );
    expect(n[0].n).toBe("1");
  });
});
