import { describe, expect, it } from "vitest";

import { GET as exportPdf } from "@/app/api/v1/export/pdf/route";

import { createUser, loginAs, resetDb } from "./helpers";
import { query } from "@/lib/db";

describe("export PDF server-side", () => {
  it("mengembalikan application/pdf dengan header %PDF", async () => {
    await resetDb();
    const tester = await createUser(undefined, "tester");
    await query(
      `INSERT INTO features (name, is_active, verified) VALUES ('F-pdf',true,true)`,
    );
    await loginAs(tester.email);

    const res = await exportPdf(
      new Request("http://test/api/v1/export/pdf?limit=10"),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/pdf");
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.slice(0, 4).toString()).toBe("%PDF");
  });
});
