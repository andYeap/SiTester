import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { deleteEvidence, saveEvidence } from "./storage";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

describe("deleteEvidence", () => {
  it("menghapus file lokal dan aman bila file sudah tidak ada", async () => {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.BLOB_READ_WRITE_TOKEN;
    try {
      const path = await saveEvidence(
        new File([PNG], "bukti.png", { type: "image/png" }),
      );
      const file = join(process.cwd(), "uploads", path);
      expect(existsSync(file)).toBe(true);

      await deleteEvidence(path);
      expect(existsSync(file)).toBe(false);
      await expect(deleteEvidence(path)).resolves.toBeUndefined();
    } finally {
      if (token) process.env.BLOB_READ_WRITE_TOKEN = token;
    }
  });
});
