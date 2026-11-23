export type TestResult = "pass" | "fail";

export type CanTestResult = {
  allowed: boolean;
  requiresApproval: boolean;
  warning: string | null;
};

/**
 * Aturan pengujian ulang: semua retest pada fitur yang sudah punya riwayat
 * wajib disetujui ketua tim, apa pun hasil terakhirnya (termasuk Fail).
 * `lastResult` = hasil terakhir dalam scope (fitur, peran, siklus).
 */
export function canTest(
  lastResult: TestResult | null,
  isRetest: boolean,
  hasApproval: boolean,
): CanTestResult {
  if (lastResult === null) {
    return { allowed: true, requiresApproval: false, warning: null };
  }

  if (isRetest) {
    if (hasApproval) {
      return { allowed: true, requiresApproval: false, warning: null };
    }
    return {
      allowed: false,
      requiresApproval: true,
      warning:
        "Pengujian ulang memerlukan persetujuan ketua tim yang masih berlaku, termasuk untuk hasil Fail.",
    };
  }

  if (lastResult === "pass") {
    return {
      allowed: false,
      requiresApproval: false,
      warning:
        'Fitur ini sudah pernah diuji dan hasil terakhirnya Berhasil. Gunakan opsi "Pengujian Ulang" dan ajukan persetujuan ketua tim.',
    };
  }

  // Fail tanpa tanda retest: siklus perbaikan bug tetap boleh.
  return {
    allowed: true,
    requiresApproval: false,
    warning:
      "Fitur ini terakhir Gagal. Anda dapat menguji lagi sebagai siklus perbaikan bug, atau menandainya sebagai pengujian ulang (perlu persetujuan ketua tim).",
  };
}
