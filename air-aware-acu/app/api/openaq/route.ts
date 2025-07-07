import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { pathname, searchParams } = new URL(req.url);
    const apiKey = "eee1e8be2169f52a0d3078df0090ac42b5759ca12e419043e2ffa22c78b53d32";
    // Fetch locations dynamically
    const locationsUrl = "https://api.openaq.org/v3/locations?coordinates=22.50241%2C88.37402&radius=25000&limit=100&page=1&order_by=id&sort_order=asc";
    const locationsRes = await fetch(locationsUrl, {
      headers: { "x-api-key": apiKey },
      cache: "no-store",
    });
    if (!locationsRes.ok) {
      return new Response(JSON.stringify({ error: "Failed to fetch locations" }), { status: 500 });
    }
    const locationsData = await locationsRes.json();
    // Build cityLocationIds table
    const cityLocationIds: Record<string, number> = {};
    for (const loc of locationsData.results) {
      cityLocationIds[loc.name] = loc.id;
    }
    // If this is a request for /api/openaq-cities, return the city list
    if (pathname.endsWith("/openaq-cities")) {
      return new Response(JSON.stringify({ cities: Object.keys(cityLocationIds) }), { status: 200 });
    }
    // Otherwise, handle pollutant data as before
    const city = searchParams.get("city");
    if (!city) {
      return new Response(JSON.stringify({ error: "City required" }), { status: 400 });
    }
    if (!(city in cityLocationIds)) {
      return new Response(JSON.stringify({ error: "Valid city required" }), { status: 400 });
    }
    const locationId = cityLocationIds[city];
    // Fetch location details and measurements as before...
    const locationUrl = `https://api.openaq.org/v3/locations/${locationId}`;
    const locationRes = await fetch(locationUrl, {
      headers: { "x-api-key": apiKey },
      cache: "no-store",
    });
    if (!locationRes.ok) {
      return new Response(JSON.stringify({ error: "Failed to fetch location details" }), { status: 500 });
    }
    const locationData = await locationRes.json();
    const sensors = locationData.results?.[0]?.sensors || [];
    const pollutantKeys = { co: null, no2: null, so2: null, pm25: null };
    for (const s of sensors) {
      if (s.parameter?.name === "co") pollutantKeys.co = s.id;
      if (s.parameter?.name === "no2") pollutantKeys.no2 = s.id;
      if (s.parameter?.name === "so2") pollutantKeys.so2 = s.id;
      if (s.parameter?.name === "pm25") pollutantKeys.pm25 = s.id;
    }
    const result: Record<string, { values: number[]; times: string[]; unit?: string }> = {};
    for (const [key, sensorId] of Object.entries(pollutantKeys)) {
      if (!sensorId) {
        result[key] = { values: [], times: [] };
        continue;
      }
      const measUrl = `https://api.openaq.org/v3/sensors/${sensorId}/measurements?limit=12&sort=desc`;
      const measRes = await fetch(measUrl, {
        headers: { "x-api-key": apiKey },
        cache: "no-store",
      });
      if (!measRes.ok) {
        result[key] = { values: [], times: [] };
        continue;
      }
      const measData = await measRes.json();
      result[key] = {
        values: measData.results.map((d: any) => d.value).reverse(),
        times: measData.results.map((d: any) => d.date?.local ?? "").reverse(),
        unit: measData.results[0]?.unit,
      };
    }
    return new Response(JSON.stringify(result), { status: 200 });
  } catch (err) {
    console.error("API error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
}
