const ALLOWED_ORIGIN = "https://miloderlackpilot-dev.github.io";

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": origin,
      "Vary": "Origin"
    }
  });
}

export default {
  async fetch(request) {
    const origin = request.headers.get("Origin") || "";
    const allowedOrigin = origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN;
    const corsHeaders = {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin"
    };

    if (request.method === "OPTIONS") {
      if (origin !== ALLOWED_ORIGIN) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (origin !== ALLOWED_ORIGIN) return json({ status: "unknown", detail: "Origin not allowed" }, 403, ALLOWED_ORIGIN);
    if (request.method !== "POST") return json({ status: "unknown", detail: "Use POST" }, 405, ALLOWED_ORIGIN);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ status: "unknown", detail: "Invalid JSON body" }, 400, ALLOWED_ORIGIN);
    }

    const username = typeof body.username === "string" ? body.username.trim() : "";
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return json({ status: "invalid", detail: "Username format is invalid" }, 200, ALLOWED_ORIGIN);
    }

    const upstreamUrl = new URL("https://auth.roblox.com/v1/usernames/validate");
    upstreamUrl.searchParams.set("request.username", username);
    upstreamUrl.searchParams.set("request.birthday", "2000-01-01T00:00:00.000Z");
    upstreamUrl.searchParams.set("request.context", "Signup");

    try {
      const upstream = await fetch(upstreamUrl, {
        method: "GET",
        headers: { "Accept": "application/json" }
      });

      if (upstream.status === 429) {
        return json({ status: "ratelimited", detail: "Roblox rate-limited this request" }, 429, ALLOWED_ORIGIN);
      }
      if (!upstream.ok) {
        return json({ status: "unknown", detail: "Roblox returned HTTP " + upstream.status }, 502, ALLOWED_ORIGIN);
      }

      const data = await upstream.json();
      const code = Number(data.code);
      if (code === 0) return json({ status: "available" }, 200, ALLOWED_ORIGIN);
      if (code === 1) return json({ status: "taken" }, 200, ALLOWED_ORIGIN);
      if (code === 2) return json({ status: "invalid" }, 200, ALLOWED_ORIGIN);
      return json({ status: "unknown", detail: "Unrecognized Roblox response" }, 200, ALLOWED_ORIGIN);
    } catch {
      return json({ status: "unknown", detail: "Could not reach Roblox" }, 502, ALLOWED_ORIGIN);
    }
  }
};
