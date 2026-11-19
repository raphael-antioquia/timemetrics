import { ROUTE_SENTINEL } from "@/lib/observability/triageharbor-preview";

export async function GET() {
  throw new Error(ROUTE_SENTINEL);
}
