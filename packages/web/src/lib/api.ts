import type {
  PainReportOutput,
  ReportGoal,
  ReportStatus,
  CreateReportInput,
} from "@rivaleye/shared";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export interface ReportRow {
  id: string;
  category: string;
  competitors: string[];
  audience: string | null;
  goal: ReportGoal;
  status: ReportStatus;
  stage?: string;
  error?: string | null;
  output: PainReportOutput | null;
  createdAt: string;
  updatedAt: string;
}

export const api = {
  reports: {
    async create(input: CreateReportInput): Promise<{ id: string; stage: string }> {
      const res = await fetch(`${BASE}/v1/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`create report failed: ${res.status}`);
      return res.json() as Promise<{ id: string; stage: string }>;
    },

    async get(id: string): Promise<ReportRow> {
      const res = await fetch(`${BASE}/v1/reports/${id}`);
      if (!res.ok) throw new Error(`get report failed: ${res.status}`);
      return res.json() as Promise<ReportRow>;
    },

    async list(): Promise<{ reports: ReportRow[] }> {
      // GET /v1/reports not in MVP — history uses localStorage only
      return { reports: [] };
    },
  },
};
