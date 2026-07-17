// Shared guard for the /metrics endpoints. When METRICS_TOKEN is unset the
// endpoint is open (safe: aggregate counts only, no secrets/PII). When set,
// callers must present it as a bearer token.
export function requireMetricsAuth(
  authorizationHeader: string | undefined,
): { message: string; error: string } | null {
  const token = process.env.METRICS_TOKEN;
  if (!token) return null;

  const expected = `Bearer ${token}`;
  if (authorizationHeader === expected) return null;

  return { message: "Unauthorized", error: "UNAUTHORIZED" };
}
