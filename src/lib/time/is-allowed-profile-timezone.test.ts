import { describe, expect, it } from "vitest";

import { isAllowedProfileTimezone } from "./is-allowed-profile-timezone";

describe("isAllowedProfileTimezone", () => {
  it.each([
    ["UTC", true],
    ["utc", true],
    ["GMT", true],
    ["America/Toronto", true],
    ["america/toronto", true],
    ["EST", true],

    ["", false],
    ["   ", false],
    ["Definitely/Not-A-Timezone", false],
    ["Factory", false],

    ["+05:00", false],
    ["UTC+05:00", false],
    ["GMT-04:00", false],

    ["Etc/UTC", false],
    ["Etc/GMT+5", false],
    ["etc/GMT+5", false],
    ["ETC/GMT+5", false],
  ])("%j => %s", (candidate, expected) => {
    expect(
      isAllowedProfileTimezone(candidate),
    ).toBe(expected);
  });
});
