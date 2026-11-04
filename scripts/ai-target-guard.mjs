// Penjaga egress untuk AI runner: cegah run mengarah ke alamat yang tidak
// seharusnya dibuka browser runner (metadata cloud, jaringan privat) kecuali
// operator mengizinkan target privat secara eksplisit.
import { lookup as defaultLookup } from "node:dns/promises";

// Endpoint metadata cloud yang selalu diblokir (AWS, GCP, Alibaba, dsb).
const METADATA_HOSTS = new Set([
  "169.254.169.254",
  "169.254.169.253",
  "metadata.google.internal",
  "metadata.goog",
  "100.100.100.200",
  "fd00:ec2::254",
]);

const METADATA_IPS = new Set([
  "169.254.169.254",
  "169.254.169.253",
  "100.100.100.200",
  "fd00:ec2::254",
]);

function ipv4Parts(ip) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  if (parts.some((n) => n > 255)) return null;
  return parts;
}

function ipv6Lower(ip) {
  let s = ip.toLowerCase();
  if (s.startsWith("[") && s.endsWith("]")) s = s.slice(1, -1);
  return s;
}

/** True bila IP privat, loopback, link-local, atau reserved (v4/v6). */
export function ipIsPrivateOrReserved(ip) {
  const v4 = ipv4Parts(ip);
  if (v4) {
    const [a, b] = v4;
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 0) return true;
    if (a === 192 && (b === 0 || b === 2)) return true; // 192.0.0.0/24, TEST-NET-1
    if (a === 198 && (b === 18 || b === 19)) return true; // benchmark
    if (a === 198 && b === 51 && v4[2] === 100) return true; // TEST-NET-2
    if (a === 203 && b === 0 && v4[2] === 113) return true; // TEST-NET-3
    if (a >= 224) return true; // multicast + reserved
    return false;
  }
  const s = ipv6Lower(ip);
  // IPv4-mapped: nilai ditentukan alamat v4 di dalamnya.
  const mapped = s.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return ipIsPrivateOrReserved(mapped[1]);
  if (s === "::1" || s === "::") return true;
  if (s.startsWith("fc") || s.startsWith("fd")) return true; // unique local
  if (s.startsWith("fe8") || s.startsWith("fe9") || s.startsWith("fea") || s.startsWith("feb")) return true; // link-local
  if (s.startsWith("ff")) return true; // multicast
  if (s.startsWith("2001:db8")) return true; // dokumentasi
  return false;
}

/**
 * Periksa URL target runner. Kembalikan { ok:true } atau { ok:false, reason }.
 * Metadata cloud selalu diblokir. IP privat butuh allowPrivate (env
 * AI_RUNNER_ALLOW_PRIVATE_TARGETS=1). Host yang tak bisa di-resolve ditolak
 * karena run pasti gagal juga.
 * @param {string} rawUrl
 * @param {{ allowPrivate?: boolean, dnsLookup?: (host: string, opts?: unknown) => Promise<unknown> }} [opts]
 */
export async function checkRunnerTarget(
  rawUrl,
  { allowPrivate = false, dnsLookup = defaultLookup } = {},
) {
  let url;
  try {
    url = new URL(String(rawUrl));
  } catch {
    return { ok: false, reason: `URL target tidak valid: ${rawUrl}` };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "URL target harus http(s)." };
  }
  const host = url.hostname.toLowerCase();
  if (METADATA_HOSTS.has(host)) {
    return { ok: false, reason: `Target ${host} adalah endpoint metadata cloud; diblokir.` };
  }
  let records;
  try {
    records = await dnsLookup(host, { all: true });
  } catch {
    return { ok: false, reason: `Host target tidak dapat di-resolve: ${host}.` };
  }
  const ips = (Array.isArray(records) ? records : [records]).map((r) =>
    typeof r === "string" ? r : r.address,
  );
  const found = ips.map((ip) => ipv6Lower(String(ip)));
  if (found.some((ip) => METADATA_IPS.has(ip))) {
    return { ok: false, reason: `Target ${host} mengarah ke endpoint metadata cloud; diblokir.` };
  }
  const privateIps = found.filter(ipIsPrivateOrReserved);
  if (privateIps.length > 0 && !allowPrivate) {
    return {
      ok: false,
      reason:
        `Target ${host} mengarah ke IP privat (${privateIps[0]}). ` +
        `Set AI_RUNNER_ALLOW_PRIVATE_TARGETS=1 pada runner bila memang menguji target internal.`,
    };
  }
  return { ok: true };
}
