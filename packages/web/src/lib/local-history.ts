import type { ReportGoal } from "@rivaleye/shared";

const STORAGE_KEY = "rivaleye.history.v1";
const MAX_ENTRIES = 50;

export type LocalHistoryEntry = {
  id: string;
  competitor: string;
  goal: ReportGoal;
  createdAt: string; // ISO string
};

type LocalHistory = {
  version: 1;
  reports: LocalHistoryEntry[];
};

function readStorage(): LocalHistory {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { version: 1, reports: [] };
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null || (parsed as { version?: unknown }).version !== 1) {
      return { version: 1, reports: [] };
    }
    return parsed as LocalHistory;
  } catch {
    return { version: 1, reports: [] };
  }
}

function writeStorage(data: LocalHistory): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage disabled or quota exceeded — fail silently
  }
}

export function getHistory(): LocalHistory {
  return readStorage();
}

export function addReport(entry: LocalHistoryEntry): void {
  const history = readStorage();
  // Remove existing entry with same id if present
  const filtered = history.reports.filter((r) => r.id !== entry.id);
  // Add to front
  filtered.unshift(entry);
  // Cap to MAX_ENTRIES
  const capped = filtered.slice(0, MAX_ENTRIES);
  writeStorage({ version: 1, reports: capped });
}

export function removeReport(id: string): void {
  const history = readStorage();
  writeStorage({ version: 1, reports: history.reports.filter((r) => r.id !== id) });
}

export function clearHistory(): void {
  writeStorage({ version: 1, reports: [] });
}
