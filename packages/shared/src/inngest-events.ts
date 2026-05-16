import type { EnabledPlatformId } from "./llm/config";

export type RivalEyeEvents = {
  "scrape.fetch": {
    name: "scrape.fetch";
    data: {
      reportId: string;
      platform: EnabledPlatformId;
      competitor: string;
      category?: string;
      keywords?: string[];
    };
  };
  "llm.stage-a": {
    name: "llm.stage-a";
    data: {
      reportId: string;
      platform: EnabledPlatformId;
    };
  };
  "llm.stage-b": {
    name: "llm.stage-b";
    data: {
      reportId: string;
      platform: EnabledPlatformId;
    };
  };
  "synth.run": {
    name: "synth.run";
    data: {
      reportId: string;
      reason?: "fan-in" | "retry";
    };
  };
};

export type EventName = keyof RivalEyeEvents;
