import type { BrowserOptions } from "@sentry/nextjs";

// In Sentry v10, explicitly setting dataCollection
// enables omitted categories by default.
export const sentryPrivacyOptions = {
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    httpBodies: [],
    urlQueryParams: false,
    databaseQueryData: false,
    stackFrameVariables: false,
    graphQL: {
      document: false,
      variables: false,
    },
    genAI: {
      inputs: false,
      outputs: false,
    },
  },
  beforeBreadcrumb(breadcrumb) {
    return breadcrumb.category === "console" ? null : breadcrumb;
  },
} satisfies Pick<BrowserOptions, "dataCollection" | "beforeBreadcrumb">;
