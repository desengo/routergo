import type { Handler } from "@netlify/functions";

export const handler: Handler = async (event) => {
  try {
    const token = process.env.MAPBOX_TOKEN;
    if (!token) {
      return {
        statusCode: 500,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ error: "MAPBOX_TOKEN missing in Netlify env" }),
      };
    }

    const coords = event.queryStringParameters?.coords; // "lng,lat;lng,lat;..."
    if (!coords) {
      return {
        statusCode: 400,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ error: "coords required. Example: lng,lat;lng,lat" }),
      };
    }

    const profile = event.queryStringParameters?.profile || "driving";

    const url =
      `https://api.mapbox.com/directions/v5/mapbox/${encodeURIComponent(profile)}/${encodeURIComponent(coords)}` +
      `?geometries=geojson&overview=full&steps=false&access_token=${encodeURIComponent(token)}`;

    const r = await fetch(url);
    const j = await r.json();

    return {
      statusCode: r.ok ? 200 : r.status,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(j),
    };
  } catch (e: any) {
    return {
      statusCode: 500,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ error: e?.message || "server error" }),
    };
  }
};