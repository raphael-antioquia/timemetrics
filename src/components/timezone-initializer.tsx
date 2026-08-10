"use client";

import { useEffect } from "react";
import { initializeUserTimezone } from "@/app/actions/time-blocks";

export function TimezoneInitializer() {
  useEffect(() => {
    const detected =
      Intl.DateTimeFormat().resolvedOptions().timeZone;

    // UTC is already the profile fallback, so there is
    // nothing useful to initialize in this case.
    if (detected === "UTC") {
      return;
    }

    void initializeUserTimezone(detected).catch(
      () => {},
    );
  }, []);

  return null;
}