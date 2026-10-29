import { beforeEach, describe, expect, it } from "vitest";

import { GET as listSessions } from "@/app/api/v1/test-sessions/route";
import { query } from "@/lib/db";

import { createUser, loginAs, resetDb } from "./helpers";

describe("paginasi riwayat", () => {
  beforeEach(async () => {
    await resetDb();
    const tester = await createUser(undefined, "tester");
    const f = await query<{ id: number }>(
      `INSERT INTO features (name, is_active, verified) VALUES ('Fitur Page',true,true) RETURNING id`,
    );
    for (let i = 0; i < 5; i++) {
      await query(
        `INSERT INTO test_sessions (user_id, feature_id, tested_at, result, tested_as_role)
         VALUES ($1,$2,$3,'pass','tester')`,
        [tester.id, f[0].id, `2026-10-${String(10 + i).padStart(2, "0")}`],
      );
    }
    await loginAs(tester.email);
  });

  it("limit/offset + total konsisten", async () => {
    const p1 = await listSessions(
      new Request("http://test/x?limit=2&offset=0"),
    );
    expect(p1.status).toBe(200);
    const d1 = (await p1.json()) as { sessions: unknown[]; total: number; limit: number; offset: number };
    expect(d1.sessions).toHaveLength(2);
    expect(d1.total).toBe(5);
    expect(d1.limit).toBe(2);
    expect(d1.offset).toBe(0);

    const p2 = await listSessions(
      new Request("http://test/x?limit=2&offset=4"),
    );
    const d2 = (await p2.json()) as { sessions: unknown[]; total: number };
    expect(d2.sessions).toHaveLength(1);
    expect(d2.total).toBe(5);

    const ids1 = new Set((d1.sessions as { id: number }[]).map((s) => s.id));
    const ids2 = new Set((d2.sessions as { id: number }[]).map((s) => s.id));
    for (const id of ids2) expect(ids1.has(id)).toBe(false);
  });
});
