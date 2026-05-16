import { describe, it, expect, vi, beforeEach } from "vitest";

const sentEvents: any[] = [];
let mockJobs: { status: string }[] = [];
let synthAlreadyStarted = false;

vi.mock("../db", () => {
  const tx = {
    execute: vi.fn().mockResolvedValue(undefined),
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(synthAlreadyStarted ? [{ id: 1 }] : []),
        }),
      }),
    }),
  };
  return {
    db: {
      transaction: async (fn: (tx: any) => Promise<void>) => {
        // First select call returns jobs; second returns synth-already.
        let call = 0;
        const customTx = {
          execute: vi.fn().mockResolvedValue(undefined),
          select: () => ({
            from: () => ({
              where: () => ({
                limit: () => {
                  call += 1;
                  if (call === 1) return Promise.resolve(mockJobs);
                  return Promise.resolve(synthAlreadyStarted ? [{ id: 1 }] : []);
                },
              }),
            }),
          }),
        };
        // The fan-in helper uses select().from().where() without limit() for jobs.
        // Provide both shapes:
        const realTx = {
          execute: customTx.execute,
          select: () => ({
            from: () => ({
              where: () => {
                call += 1;
                if (call === 1) {
                  return Promise.resolve(mockJobs);
                }
                return {
                  limit: () =>
                    Promise.resolve(synthAlreadyStarted ? [{ id: 1 }] : []),
                };
              },
            }),
          }),
        };
        await fn(realTx);
      },
    },
  };
});

vi.mock("../inngest/client", () => ({
  inngest: {
    send: async (e: any) => {
      sentEvents.push(e);
    },
  },
}));

import { fanInCheck } from "../llm/fan-in";

beforeEach(() => {
  sentEvents.length = 0;
  mockJobs = [];
  synthAlreadyStarted = false;
});

describe("fanInCheck", () => {
  it("does nothing if any job is still queued", async () => {
    mockJobs = [{ status: "completed" }, { status: "queued" }];
    await fanInCheck("00000000-0000-0000-0000-000000000010");
    expect(sentEvents).toHaveLength(0);
  });

  it("does nothing if any job is still running", async () => {
    mockJobs = [{ status: "completed" }, { status: "running" }];
    await fanInCheck("00000000-0000-0000-0000-000000000011");
    expect(sentEvents).toHaveLength(0);
  });

  it("sends synth.run when all jobs are terminal and synth not started", async () => {
    mockJobs = [{ status: "completed" }, { status: "failed" }, { status: "completed" }];
    await fanInCheck("00000000-0000-0000-0000-000000000012");
    expect(sentEvents).toHaveLength(1);
    expect(sentEvents[0].name).toBe("synth.run");
    expect(sentEvents[0].data.reportId).toBe("00000000-0000-0000-0000-000000000012");
  });

  it("skips synth.run when already started", async () => {
    mockJobs = [{ status: "completed" }, { status: "completed" }];
    synthAlreadyStarted = true;
    await fanInCheck("00000000-0000-0000-0000-000000000013");
    expect(sentEvents).toHaveLength(0);
  });
});
