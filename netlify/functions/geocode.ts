type GeocodeResult = { found: true; lat: number; lng: number; display_name?: string } | { found: false };

async function tryNominatim(q: string): Promise<GeocodeResult> {
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
      // IMPORTANTE: Nominatim gosta de identificação real
      "User-Agent": "routergo/1.0 (contact: routergo.app@gmail.com)",
      "Accept": "application/json"
    }
  });

  if (!res.ok) return { found: false };
  const data = await res.json();
  const first = data?.[0];
  if (!first) return { found: false };

  const lat = Number(first.lat);
  const lng = Number(first.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { found: false };

  return { found: true, lat, lng, display_name: first.display_name };
}

async function tryPhoton(q: string): Promise<GeocodeResult> {
  const url =
    "https://photon.komoot.io/api/?" +
    new URLSearchParams({
      q,
      limit: "1",
      lang: "pt"
    }).toString();

  const res = await fetch(url, {
    headers: { "Accept": "application/json" }
  });

  if (!res.ok) return { found: false };
  const data = await res.json();
  const f = data?.features?.[0];
  const coords = f?.geometry?.coordinates;
  if (!coords || coords.length < 2) return { found: false };

  const lng = Number(coords[0]);
  const lat = Number(coords[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { found: false };

  const display = f?.properties?.name || f?.properties?.street || f?.properties?.city;
  return { found: true, lat, lng, display_name: display };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function handler(event: any) {
  try {
    const q = (event.queryStringParameters?.q || "").toString().trim();
    if (!q) return { statusCode: 400, body: JSON.stringify({ error: "Missing q" }) };

    // 1) tenta Nominatim
    let r = await tryNominatim(q);

    // retry leve (às vezes dá rate limit / instabilidade)
    if (!r.found) {
      await sleep(600);
      r = await tryNominatim(q);
    }

    // 2) fallback Photon
    if (!r.found) {
      await sleep(300);
      r = await tryPhoton(q);
    }

    return { statusCode: 200, body: JSON.stringify(r) };
  } catch (e: any) {
    return { statusCode: 500, body: JSON.stringify({ error: e?.message || "unknown" }) };
  }
}