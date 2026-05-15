import type {
  PainReportOutput,
  ReportStatus,
  CreateReportInput,
} from "@rivaleye/shared";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:6090";

export interface ReportRow {
  id: string;
  category: string;
  competitors: string[];
  audience: string | null;
  goal: string;
  status: ReportStatus;
  output: PainReportOutput | null;
  createdAt: string;
  updatedAt: string;
}

export const api = {
  reports: {
    async create(input: CreateReportInput): Promise<{ id: string; status: string }> {
      const res = await fetch(`${BASE}/v1/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`create report failed: ${res.status}`);
      return res.json() as Promise<{ id: string; status: string }>;
    },

    async get(id: string): Promise<ReportRow> {
      const res = await fetch(`${BASE}/v1/reports/${id}`);
      if (!res.ok) throw new Error(`get report failed: ${res.status}`);
      return res.json() as Promise<ReportRow>;
    },

    async list(): Promise<{ reports: ReportRow[] }> {
      const res = await fetch(`${BASE}/v1/reports`);
      if (!res.ok) throw new Error(`list reports failed: ${res.status}`);
      return res.json() as Promise<{ reports: ReportRow[] }>;
    },
  },
};
