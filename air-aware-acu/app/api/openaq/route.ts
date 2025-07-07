import { NextRequest } from "next/server";

// City name to locationId mapping
const cityLocationIds: Record<string, number> = {
  "Delhi": 5613,
  "Mumbai": 6948,
  "Agartala": 301390,
  "Ha Noi": 4946813,
  "Hong Kong": 7739,
  "Republic Of Korea": 2623178,
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const city = searchParams.get("city");
    if (!city || !(city in cityLocationIds)) {
      return new Response(JSON.stringify({ error: "Valid city required" }), { status: 400 });
    }
    const locationId = cityLocationIds[city];
    const apiKey = "eee1e8be2169f52a0d3078df0090ac42b5759ca12e419043e2ffa22c78b53d32";
    const locationUrl = `https://api.openaq.org/v3/locations/${locationId}`;
    const locationRes = await fetch(locationUrl, {
      headers: { "x-api-key": apiKey },
      cache: "no-store",
    });
    if (!locationRes.ok) {
      console.error(`Failed to fetch location ${locationId}:`, await locationRes.text());
      return new Response(JSON.stringify({ error: "Failed to fetch from OpenAQ" }), { status: 500 });
    }
    const locationData = await locationRes.json();
    const sensors = locationData.results?.[0]?.sensors || [];
    // Map pollutant name to sensor id
    const pollutantKeys = { co: null, no2: null, so2: null, pm25: null };
    for (const s of sensors) {
      if (s.parameter?.name === "co") pollutantKeys.co = s.id;
      if (s.parameter?.name === "no2") pollutantKeys.no2 = s.id;
      if (s.parameter?.name === "so2") pollutantKeys.so2 = s.id;
      if (s.parameter?.name === "pm25") pollutantKeys.pm25 = s.id;
    }
    // For each pollutant, fetch measurements
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
