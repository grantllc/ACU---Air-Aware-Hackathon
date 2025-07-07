import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const apiKey = "eee1e8be2169f52a0d3078df0090ac42b5759ca12e419043e2ffa22c78b53d32";
  const locationsUrl = "https://api.openaq.org/v3/locations?coordinates=22.50241%2C88.37402&radius=25000&limit=100&page=1&order_by=id&sort_order=asc";
  const locationsRes = await fetch(locationsUrl, {
    headers: { "x-api-key": apiKey },
    cache: "no-store",
  });
  if (!locationsRes.ok) {
    return new Response(JSON.stringify({ error: "Failed to fetch locations" }), { status: 500 });
  }
  const locationsData = await locationsRes.json();
  const cityLocationIds: Record<string, number> = {};
  for (const loc of locationsData.results) {
    cityLocationIds[loc.name] = loc.id;
  }
  return new Response(JSON.stringify({ cities: Object.keys(cityLocationIds) }), { status: 200 });
}
