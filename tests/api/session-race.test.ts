import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST as submitSession } from "@/app/api/v1/test-sessions/route";
import { query } from "@/lib/db";

import { createUser, loginAs, resetDb, uid } from "./helpers";

// Tahan kedua request tepat sebelum transaksi agar keduanya sempat mengambil
// snapshot scope sebelum salah satu insert. Tanpa ini Promise.all bisa
// berjalan berurutan dan menguji jalur yang salah.
const dbGate = vi.hoisted(() => ({
  enabled: false,
  arrivals: 0,
  release: null as (() => void) | null,
  ready: Promise.resolve(),
  arm() {
    this.enabled = true;
    this.arrivals = 0;
    this.ready = new Promise<void>((resolve) => {
      this.release = resolve;
    });
  },
  disarm() {
    this.enabled = false;
    this.release = null;
  },
  async wait() {
    if (!this.enabled) return;
    this.arrivals += 1;
    if (this.arrivals >= 2) this.release?.();
    await this.ready;
  },
}));

vi.mock("@/lib/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db")>();
  return {
    ...actual,
    withTransaction: vi.fn(
      async (fn: Parameters<typeof actual.withTransaction>[0]) => {
        await dbGate.wait();
        return actual.withTransaction(fn);
      },
    ),
  };
});

type Result = "pass" | "fail";

function fd(featureId: number, result: Result = "pass") {
  const f = new FormData();
  f.set("tested_at", "2026-10-29");
  f.set("feature_id", String(featureId));
  f.set("is_retest", "0");
  f.set("tested_as_role", "tester");
  f.set("result", result);
  if (result === "fail") {
    f.set("severity", "high");
    f.set("notes", "Catatan kegagalan minimal sepuluh karakter.");
  }
  return new Request("http://test/api/v1/test-sessions", {
    method: "POST",
    body: f,
  });
}

async function feature() {
  const rows = await query<{ id: number }>(
    `INSERT INTO features (name, is_active, verified) VALUES ($1,true,true) RETURNING id`,
    [`Race ${uid()}`],
  );
  return rows[0].id;
}

async function counts(featureId: number) {
  const rows = await query<{ sessions: string; defects: string }>(
    `SELECT
       (SELECT count(*)::text FROM test_sessions WHERE feature_id=$1) AS sessions,
       (SELECT count(*)::text FROM defects WHERE feature_id=$1) AS defects`,
    [featureId],
  );
  return rows[0];
}

describe("balapan pengujian", () => {
  beforeEach(async () => {
    dbGate.disarm();
    await resetDb();
  });

  it("dua Pass bersamaan hanya menyimpan satu sesi", async () => {
    const tester = await createUser(undefined, "tester");
    await loginAs(tester.email);
    const featureId = await feature();
    dbGate.arm();

    const results = await Promise.all([
      submitSession(fd(featureId)),
      submitSession(fd(featureId)),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);

    expect(await counts(featureId)).toEqual({ sessions: "1", defects: "0" });
  });

  it("dua Fail bersamaan hanya menyimpan satu sesi dan satu defect", async () => {
    const tester = await createUser(undefined, "tester");
    await loginAs(tester.email);
    const featureId = await feature();
    dbGate.arm();

    const results = await Promise.all([
      submitSession(fd(featureId, "fail")),
      submitSession(fd(featureId, "fail")),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);

    expect(await counts(featureId)).toEqual({ sessions: "1", defects: "1" });
  });

  it("dua Fail berurutan tetap boleh sebagai siklus perbaikan bug", async () => {
    const tester = await createUser(undefined, "tester");
    await loginAs(tester.email);
    const featureId = await feature();

    const first = await submitSession(fd(featureId, "fail"));
    expect(first.status).toBe(201);

    const second = await submitSession(fd(featureId, "fail"));
    expect(second.status).toBe(201);

    expect(await counts(featureId)).toEqual({ sessions: "2", defects: "2" });
  });
});
