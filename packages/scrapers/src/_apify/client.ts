const APIFY_BASE = "https://api.apify.com/v2";

export async function runApifyActor<T>(
  actorId: string,
  input: unknown,
  token: string,
  timeoutSecs = 120,
): Promise<T[]> {
  const actorPath = actorId.replace("/", "~");
  const url = `${APIFY_BASE}/acts/${actorPath}/run-sync-get-dataset-items?token=${token}&timeout=${timeoutSecs}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout((timeoutSecs + 10) * 1000),
    });
  } catch (err) {
    throw new Error(`Apify request failed for actor ${actorId}: ${String(err)}`);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Apify actor ${actorId} returned ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json() as unknown;
  if (!Array.isArray(data)) return [];
  return data as T[];
}

export function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export function domainFromUrl(url: string): string | null {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}
