import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { GET } from "@/app/api/uploads/[...path]/route";

import { createUser, loginAs, resetDb } from "./helpers";

const NAME = "uji-auth-test.png";
// 1x1 PNG
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

describe("upload butuh login", () => {
  beforeEach(async () => {
    await resetDb();
    await mkdir("uploads", { recursive: true });
    await writeFile(join("uploads", NAME), PNG);
    await createUser(undefined, "tester");
  });

  it("anonim ditolak, login boleh lihat", async () => {
    const anon = await GET(new Request("http://test/x"), {
      params: Promise.resolve({ path: [NAME] }),
    });
    expect(anon.status).toBe(401);

    const tester = await createUser(undefined, "tester");
    await loginAs(tester.email);
    const ok = await GET(new Request("http://test/x"), {
      params: Promise.resolve({ path: [NAME] }),
    });
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toContain("image/png");
  });
});
