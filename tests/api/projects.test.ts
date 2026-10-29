import { beforeEach, describe, expect, it } from "vitest";

import { DELETE as deleteProject, PUT as updateProject } from "@/app/api/v1/projects/[id]/route";
import { GET as listProjects, POST as createProject } from "@/app/api/v1/projects/route";
import { POST as createFeature } from "@/app/api/v1/features/route";
import { query } from "@/lib/db";

import { createUser, loginAs, resetDb, uid } from "./helpers";

const json = (body: unknown, method = "POST") =>
  new Request("http://test/x", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const p = (id: string | number) => ({ params: Promise.resolve({ id: String(id) }) });

describe("master proyek", () => {
  let ketuaEmail = "";
  let testerEmail = "";

  beforeEach(async () => {
    await resetDb();
    ketuaEmail = (await createUser(undefined, "ketua_tim")).email;
    testerEmail = (await createUser(undefined, "tester")).email;
  });

  it("ketua bisa CRUD; tester hanya baca", async () => {
    const name = `Proyek Uji ${uid()}`;
    await loginAs(ketuaEmail);
    let r: Response = await createProject(json({ name }));
    expect(r.status).toBe(201);

    const row = await query<{ id: number }>(
      `SELECT id FROM projects WHERE name=$1`,
      [name],
    );
    expect(row.length).toBe(1);

    // duplikat ditolak
    r = await createProject(json({ name }));
    expect(r.status).toBe(422);

    // tester tidak bisa membuat
    await loginAs(testerEmail);
    r = await createProject(json({ name: `Lain ${uid()}` }));
    expect(r.status).toBe(403);

    // tapi bisa membaca (untuk dropdown filter)
    const list = await listProjects();
    expect(list.status).toBe(200);
    const data = (await list.json()) as { projects: { name: string }[] };
    expect(data.projects.some((x) => x.name === name)).toBe(true);
  });

  it("rename proyek ikut mengubah fitur terkait (transaksional)", async () => {
    const base = `Proyek Rename ${uid()}`;
    await loginAs(ketuaEmail);
    await createProject(json({ name: base }));
    const row = await query<{ id: number }>(
      `SELECT id FROM projects WHERE name=$1`,
      [base],
    );
    const renamed = `${base} Baru`;
    const upd: Response = await updateProject(
      json({ name: renamed, is_active: true }, "PUT"),
      p(row[0].id),
    );
    expect(upd.status).toBe(200);

    // fitur memakai nama baru lolos validasi
    await loginAs(testerEmail);
    const fr = await createFeature(
      json({ name: `Fitur PR ${uid()}`, project_name: renamed, is_active: true }),
    );
    expect(fr.status).toBe(201);
  });

  it("hapus proyek yang dipakai fitur ditolak; yang kosong bisa", async () => {
    const used = `Dipakai ${uid()}`;
    const free = `Bebas ${uid()}`;
    await loginAs(ketuaEmail);
    expect((await createProject(json({ name: used }))).status).toBe(201);
    expect((await createProject(json({ name: free }))).status).toBe(201);

    await loginAs(testerEmail);
    const fr = await createFeature(
      json({ name: `Fitur X ${uid()}`, project_name: used, is_active: true }),
    );
    expect(fr.status).toBe(201);

    const usedRow = await query<{ id: number }>(
      `SELECT id FROM projects WHERE name=$1`,
      [used],
    );
    const freeRow = await query<{ id: number }>(
      `SELECT id FROM projects WHERE name=$1`,
      [free],
    );
    await loginAs(ketuaEmail);
    const blocked = await deleteProject(new Request("http://test/x", { method: "DELETE" }), p(usedRow[0].id));
    expect(blocked.status).toBe(422);

    const ok = await deleteProject(new Request("http://test/x", { method: "DELETE" }), p(freeRow[0].id));
    expect(ok.status).toBe(200);
  });

  it("fitur menolak project_name yang tidak terdaftar", async () => {
    await loginAs(testerEmail);
    const r = await createFeature(
      json({ name: `Fitur Asing ${uid()}`, project_name: `Tidak Ada ${uid()}`, is_active: true }),
    );
    expect(r.status).toBe(422);
    const data = (await r.json()) as { error?: string };
    expect(data.error ?? "").toMatch(/Proyek/);
  });
});
