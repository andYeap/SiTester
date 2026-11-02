// Cek model gratis: OpenRouter (vision/tools/uptime) atau Google Gemini free tier.
const provider = process.env.E2E_PROVIDER ?? "openrouter";
const id =
  process.env.E2E_MODEL ??
  (provider === "google"
    ? "gemini-3.8-flash"
    : "nvidia/nemotron-3.5-super-vl:free");

if (provider === "google") {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) {
    console.error("GOOGLE_GENERATIVE_AI_API_KEY belum diisi.");
    process.exit(1);
  }
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`,
  );
  if (!res.ok) {
    console.error(`Gagal mengambil model Google (HTTP ${res.status}).`);
    process.exit(1);
  }
  const data = await res.json();
  const model = (data.models ?? []).find(
    (m) => m.name === `models/${id}` || m.name?.endsWith(`/${id}`),
  );
  if (!model) {
    console.error(`Model Google "${id}" tidak ditemukan untuk key ini.`);
    process.exit(1);
  }
  const methods = model.supportedGenerationMethods ?? [];
  console.log(`provider: google`);
  console.log(`model: ${model.name}`);
  console.log(`displayName: ${model.displayName}`);
  console.log(`generateContent: ${methods.includes("generateContent") ? "ya" : "tidak"}`);
  const ok = methods.includes("generateContent");
  console.log(ok ? "OK: model Gemini siap dipakai." : "GAGAL: model tidak mendukung generateContent.");
  process.exit(ok ? 0 : 1);
}

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

console.log(`provider: openrouter`);
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
