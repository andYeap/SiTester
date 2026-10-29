export type TestResult = "pass" | "fail" | "bug";

export type CanTestResult = {
  allowed: boolean;
  requiresApproval: boolean;
  warning: string | null;
};

/**
 * Aturan inti pengujian ulang (mirror BR-1/BR-2/BR-4 Laravel).
 * `lastResult` = hasil terakhir dalam scope (fitur, peran, siklus), null bila belum ada.
 */
export function canTest(
  lastResult: TestResult | null,
  isRetest: boolean,
  hasApproval: boolean,
): CanTestResult {
  if (lastResult === null) {
    return { allowed: true, requiresApproval: false, warning: null };
  }

  if (lastResult === "pass") {
    if (isRetest) {
      if (hasApproval) {
        return { allowed: true, requiresApproval: false, warning: null };
      }
      return {
        allowed: false,
        requiresApproval: true,
        warning:
          "Fitur ini sudah Pass pada pengujian terakhir dalam scope ini. Pengujian ulang memerlukan persetujuan ketua tim.",
      };
    }
    return {
      allowed: false,
      requiresApproval: false,
      warning:
        'Fitur ini sudah pernah diuji dan hasil terakhirnya Pass. Gunakan opsi "Pengujian Ulang" dan ajukan persetujuan ketua tim.',
    };
  }

  // Fail/Bug: bug-fix cycle otomatis boleh.
  if (!isRetest) {
    return {
      allowed: true,
      requiresApproval: false,
      warning: `Fitur ini sudah pernah diuji dengan hasil ${lastResult.toUpperCase()}. Anda tetap dapat menguji (siklus perbaikan bug), atau gunakan opsi "Pengujian Ulang" jika ingin mencatatnya sebagai retest.`,
    };
  }
  return { allowed: true, requiresApproval: false, warning: null };
}
