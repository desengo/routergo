export default async (req, context) => {
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("q");

    if (!q) {
      return new Response(JSON.stringify({ error: "missing q" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const nominatimUrl =
      "https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" +
      encodeURIComponent(q);

    const r = await fetch(nominatimUrl, {
      headers: {
        "User-Agent": "RouterGo/1.0",
        "Accept": "application/json",
      },
    });

    const data = await r.json();

    if (!data?.length) {
      return new Response(JSON.stringify({ error: "not_found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        lat: Number(data[0].lat),
        lng: Number(data[0].lon),
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: "server_error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
};