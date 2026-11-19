import { connection } from "next/server";

import { RENDER_SENTINEL } from "@/lib/observability/triageharbor-preview";

export default async function SyntheticRenderPage() {
  await connection(); // Force request-time rendering, not static prerendering.
  throw new Error(RENDER_SENTINEL);
}
