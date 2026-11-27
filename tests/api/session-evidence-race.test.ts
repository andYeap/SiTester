import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST as submitSession } from "@/app/api/v1/test-sessions/route";
import { query } from "@/lib/db";

import { createUser, loginAs, resetDb, uid } from "./helpers";

const storage = vi.hoisted(() => ({
  saved: [] as string[],
  deleted: [] as string[],
}));

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

vi.mock("@/lib/storage", () => ({
  saveEvidence: vi.fn(async () => {
    const path = `evidence/test-${storage.saved.length}.enc`;
    storage.saved.push(path);
    return path;
  }),
  deleteEvidence: vi.fn(async (path: string) => {
    storage.deleted.push(path);
  }),
}));

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function fd(featureId: number) {
  const f = new FormData();
  f.set("tested_at", "2026-10-29");
  f.set("feature_id", String(featureId));
  f.set("is_retest", "0");
  f.set("tested_as_role", "tester");
  f.set("result", "pass");
  f.set("evidence", new File([PNG], "bukti.png", { type: "image/png" }));
  return new Request("http://test/api/v1/test-sessions", {
    method: "POST",
    body: f,
  });
}

async function feature() {
  const rows = await query<{ id: number }>(
    `INSERT INTO features (name, is_active, verified) VALUES ($1,true,true) RETURNING id`,
    [`Evidence race ${uid()}`],
  );
  return rows[0].id;
}

describe("bukti upload saat submit kalah balapan", () => {
  beforeEach(async () => {
    dbGate.disarm();
    await resetDb();
    storage.saved.length = 0;
    storage.deleted.length = 0;
  });

  it("menghapus bukti milik request yang ditolak", async () => {
    const tester = await createUser(undefined, "tester");
    await loginAs(tester.email);
    const featureId = await feature();
    dbGate.arm();

    const results = await Promise.all([
      submitSession(fd(featureId)),
      submitSession(fd(featureId)),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);

    const winner = await query<{ evidence_path: string }>(
      `SELECT evidence_path FROM test_sessions WHERE feature_id=$1`,
      [featureId],
    );
    expect(storage.saved).toHaveLength(2);
    const loserPath = storage.saved.find(
      (path) => path !== winner[0].evidence_path,
    );
    expect(loserPath).toBeTruthy();
    expect(storage.deleted).toContain(loserPath);
  });
});
