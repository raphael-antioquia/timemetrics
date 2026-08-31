import { describe, expect, it } from "vitest";

import { UUID_PATTERN } from "./uuid";

describe("UUID_PATTERN", () => {
  it("accepts a valid UUID", () => {
    expect(
      UUID_PATTERN.test(
        "550e8400-e29b-41d4-a716-446655440000",
      ),
    ).toBe(true);
  });

  it("accepts uppercase hexadecimal characters", () => {
    expect(
      UUID_PATTERN.test(
        "550E8400-E29B-41D4-A716-446655440000",
      ),
    ).toBe(true);
  });

  it("rejects an empty string", () => {
    expect(UUID_PATTERN.test("")).toBe(false);
  });

  it("rejects arbitrary text", () => {
    expect(
      UUID_PATTERN.test("not-a-uuid"),
    ).toBe(false);
  });

  it("rejects surrounding whitespace", () => {
    expect(
      UUID_PATTERN.test(
        " 550e8400-e29b-41d4-a716-446655440000 ",
      ),
    ).toBe(false);
  });

  it("rejects an incorrectly formatted UUID", () => {
    expect(
      UUID_PATTERN.test(
        "550e8400e29b41d4a716446655440000",
      ),
    ).toBe(false);
  });

  it("currently rejects UUIDv7", () => {
    expect(
      UUID_PATTERN.test(
        "01997b0f-8f4c-7c4a-b6f1-9a3c2d5e7f10",
      ),
    ).toBe(false);
  });
});