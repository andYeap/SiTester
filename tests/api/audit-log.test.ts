import { beforeEach, describe, expect, it } from "vitest";

import { POST as createFeature } from "@/app/api/v1/features/route";
import { query } from "@/lib/db";

import { createUser, loginAs, resetDb, uid } from "./helpers";

const json = (body: unknown) =>
  new Request("http://test/x", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("audit log master", () => {
  beforeEach(async () => {
    await resetDb();
    await createUser(undefined, "ketua_tim");
    await createUser(undefined, "tester");
  });

  it("mencatat siapa melakukan apa pada master", async () => {
    const ketua = await createUser(undefined, "ketua_tim");
    await loginAs(ketua.email);
    const fname = `Fitur Audit Log ${uid()}`;

    const r = await createFeature(json({ name: fname, is_active: true }));
    expect(r.status).toBe(201);

    const logs = await query<{
      action: string;
      target: string | null;
      actor_role: string | null;
      actor_name: string | null;
    }>(`SELECT action, target, actor_role, actor_name FROM audit_logs WHERE target=$1 ORDER BY id DESC LIMIT 5`, [fname]);
    const found = logs.find((l) => l.action === "features.create");
    expect(found).toBeTruthy();
    expect(found!.target).toBe(fname);
    expect(found!.actor_role).toBe("ketua_tim");
    expect(found!.actor_name).toBeTruthy();
  });

  it("tester tidak bisa membaca audit log", async () => {
    const tester = await createUser(undefined, "tester");
    await loginAs(tester.email);
    const { GET } = await import("@/app/api/v1/audit-logs/route");
    const res = await GET(new Request("http://test/x"));
    expect(res.status).toBe(403);
  });
});
