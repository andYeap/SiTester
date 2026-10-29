import { vi } from "vitest";

import { cookieStore } from "./cookie-store";

if (!process.env.TEST_DATABASE_URL?.includes("testlab_test")) {
  throw new Error(
    "TEST_DATABASE_URL harus menunjuk database testlab_test (aman untuk di-TRUNCATE).",
  );
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const v = cookieStore().get(name);
      return v === undefined ? undefined : { value: v };
    },
    set: (name: string, value: string) => {
      cookieStore().set(name, value);
    },
    delete: (name: string) => {
      cookieStore().delete(name);
    },
  }),
}));
