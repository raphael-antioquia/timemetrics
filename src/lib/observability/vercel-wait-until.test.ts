import { waitUntil } from "@vercel/functions";
import { describe, expect, it } from "vitest";

// Pins @vercel/functions@3.11.3 behavior outside Vercel; says nothing about Vercel lifecycle.
describe("@vercel/functions outside Vercel", () => {
  it("no-ops without a request context instead of throwing", () => {
    expect(waitUntil(Promise.resolve())).toBeUndefined();
  });
});
