import { describe, expect, it } from "vitest";
import { squareCropRect } from "./avatar";

describe("squareCropRect", () => {
  it("returns the full frame for an already-square image", () => {
    expect(squareCropRect(200, 200)).toEqual({ sx: 0, sy: 0, side: 200 });
  });

  it("crops the sides of a landscape image", () => {
    expect(squareCropRect(400, 200)).toEqual({ sx: 100, sy: 0, side: 200 });
  });

  it("crops the top and bottom of a portrait image", () => {
    expect(squareCropRect(200, 400)).toEqual({ sx: 0, sy: 100, side: 200 });
  });

  it("centers an odd-offset crop by rounding", () => {
    expect(squareCropRect(301, 200)).toEqual({ sx: 51, sy: 0, side: 200 });
  });
});
