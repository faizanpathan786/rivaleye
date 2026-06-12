import { describe, expect, it } from "vitest";
import {
  clearSessionHint,
  readSessionHint,
  writeSessionHint,
} from "./session-hint";

function memoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (k) => store.get(k) ?? null,
    key: (i) => [...store.keys()][i] ?? null,
    removeItem: (k) => void store.delete(k),
    setItem: (k, v) => void store.set(k, v),
  };
}

describe("session hint", () => {
  it("round-trips a user snapshot", () => {
    const storage = memoryStorage();
    writeSessionHint({ id: "u1", name: "Jane" }, storage);
    expect(readSessionHint(storage)).toEqual({ id: "u1", name: "Jane" });
  });

  it("returns null when nothing is stored", () => {
    expect(readSessionHint(memoryStorage())).toBeNull();
  });

  it("returns null on corrupt data instead of throwing", () => {
    const storage = memoryStorage();
    storage.setItem("rivaleye-session-hint", "{not json");
    expect(readSessionHint(storage)).toBeNull();
  });

  it("clears the snapshot", () => {
    const storage = memoryStorage();
    writeSessionHint({ id: "u1" }, storage);
    clearSessionHint(storage);
    expect(readSessionHint(storage)).toBeNull();
  });
});
