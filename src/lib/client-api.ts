"use client";

/** Fetch JSON dengan pesan error yang jujur: bedakan jaringan mati vs respons non-JSON. */
export async function fetchJson<T>(
  input: string,
  init?: RequestInit,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(input, init);
  } catch {
    throw new Error("Tidak dapat menghubungi server. Periksa koneksi internet.");
  }

  const text = await res.text();
  let data: T;
  try {
    data = JSON.parse(text) as T;
  } catch {
    throw new Error(
      `Server mengembalikan respons tak terduga (HTTP ${res.status}). Kemungkinan: database belum terhubung atau sesi deployment kedaluwarsa — coba muat ulang halaman.`,
    );
  }

  if (!res.ok) {
    const msg = (data as { error?: unknown }).error;
    throw new Error(
      typeof msg === "string" ? msg : `Gagal (${res.status}).`,
    );
  }

  return data;
}
