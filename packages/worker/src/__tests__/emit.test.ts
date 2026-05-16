import { describe, it, expect, vi } from "vitest";

const insertedRows: any[] = [];

vi.mock("../db", () => ({
  db: {
    insert: () => ({
      values: (row: any) => {
        insertedRows.push(row);
        return Promise.resolve([row]);
      },
    }),
  },
}));

import { emit } from "../events/emit";

describe("emit", () => {
  it("writes a pipeline_events row with the expected fields", async () => {
    insertedRows.length = 0;
    await emit({
      reportId: "00000000-0000-0000-0000-000000000001",
      platform: "reddit",
      stage: "scrape.fetch",
      event: "completed",
      attempt: 2,
      durationMs: 1234,
      metadata: { mentions: 42 },
    });

    expect(insertedRows).toHaveLength(1);
    const row = insertedRows[0];
    expect(row.report_id).toBe("00000000-0000-0000-0000-000000000001");
    expect(row.platform).toBe("reddit");
    expect(row.stage).toBe("scrape.fetch");
    expect(row.event).toBe("completed");
    expect(row.attempt).toBe(2);
    expect(row.duration_ms).toBe(1234);
    expect(row.metadata).toEqual({ mentions: 42 });
  });

  it("accepts an error string", async () => {
    insertedRows.length = 0;
    await emit({
      reportId: "00000000-0000-0000-0000-000000000002",
      stage: "synth.run",
      event: "failed",
      error: "boom",
    });
    expect(insertedRows[0].error).toBe("boom");
    expect(insertedRows[0].platform).toBeNull();
    expect(insertedRows[0].attempt).toBe(1);
  });
});
