export async function handler(event: any) {
  try {
    const q = (event.queryStringParameters?.q || "").toString().trim();
    if (!q) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing q" }) };
    }

    const url =
      "https://nominatim.openstreetmap.org/search?" +
      new URLSearchParams({
        q,
        format: "json",
        addressdetails: "1",
        limit: "1"
      }).toString();

    const res = await fetch(url, {
      headers: {
        "User-Agent": "routergo/1.0 (contact: suporte@routergo.local)"
      }
    });

    if (!res.ok) {
      return { statusCode: 502, body: JSON.stringify({ error: "Geocode upstream failed" }) };
    }

    const data = await res.json();
    const first = data?.[0];
    if (!first) {
      return { statusCode: 200, body: JSON.stringify({ found: false }) };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        found: true,
        lat: Number(first.lat),
        lng: Number(first.lon),
        display_name: first.display_name
      })
    };
  } catch (e: any) {
    return { statusCode: 500, body: JSON.stringify({ error: e?.message || "unknown" }) };
  }
}
