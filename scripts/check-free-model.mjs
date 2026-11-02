// Cek model gratis OpenRouter: harga $0, vision, tool calling, endpoint online.
const id = process.env.E2E_MODEL ?? "nvidia/nemotron-3.5-super-vl:free";

const res = await fetch("https://openrouter.ai/api/v1/models");
if (!res.ok) {
  console.error(`Gagal mengambil daftar model (HTTP ${res.status}).`);
  process.exit(1);
}
const payload = await res.json();
const model = payload.data?.find((m) => m.id === id);
if (!model) {
  console.error(`Model "${id}" tidak ditemukan di OpenRouter.`);
  process.exit(1);
}

const free =
  Number(model.pricing?.prompt) === 0 && Number(model.pricing?.completion) === 0;
const vision = (model.architecture?.input_modalities ?? []).includes("image");
const tools = (model.supported_parameters ?? []).includes("tools");

console.log(`model: ${model.id}`);
console.log(`nama: ${model.name}`);
console.log(`harga: ${free ? "GRATIS ($0)" : "BERBAYAR"}`);
console.log(`vision: ${vision ? "ya" : "tidak"} | tools: ${tools ? "ya" : "tidak"}`);

const epRes = await fetch(
  `https://openrouter.ai/api/v1/models/${id}/endpoints`,
);
if (!epRes.ok) {
  console.error(`Gagal mengambil endpoint (HTTP ${epRes.status}).`);
  process.exit(1);
}
const epPayload = await epRes.json();
const endpoints = epPayload.data?.endpoints ?? [];
if (endpoints.length === 0) {
  console.error("Tidak ada endpoint/provider aktif.");
  process.exit(1);
}
for (const ep of endpoints) {
  console.log(
    `endpoint: ${ep.provider_name} | status: ${ep.status} | uptime 30m: ${ep.uptime_last_30m ?? "?"}% | uptime 1d: ${ep.uptime_last_1d ?? "?"}%`,
  );
}

const ok = free && vision && tools && endpoints.length > 0;
console.log(ok ? "OK: model gratis siap dipakai." : "GAGAL: model tidak memenuhi syarat.");
process.exit(ok ? 0 : 1);
