import { describe, expect, it } from "vitest";
import { createRandom } from "./generate-demo-data";

describe("createRandom", () => {
  it("produces the same sequence for the same seed", () => {
    const a = createRandom(42);
    const b = createRandom(42);

    const seqA = Array.from({ length: 5 }, a);
    const seqB = Array.from({ length: 5 }, b);

    expect(seqA).toEqual(seqB);
    expect(seqA.every((n) => n >= 0 && n < 1)).toBe(true);
  });

  it("produces different sequences for different seeds", () => {
    expect(createRandom(42)()).not.toBe(createRandom(43)());
  });
});
